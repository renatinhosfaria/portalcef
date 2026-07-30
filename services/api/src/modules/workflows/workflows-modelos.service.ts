import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  asc,
  eq,
  ilike,
  inArray,
  workflowCategorias,
  workflowEtapaProgresso,
  workflowEtapas,
  workflowExecucoes,
  workflowFases,
  workflowModelos,
  workflowOrientacoes,
} from "@essencia/db";
import type { Database, WorkflowModeloStatus } from "@essencia/db";

import { DatabaseService } from "../../common/database/database.service";
import type {
  AtualizarModeloDto,
  CriarModeloDto,
  ListarModelosDto,
} from "./dto/workflows.dto";
import { WORKFLOW_GESTAO_ROLES } from "./workflows.constants";
import { WorkflowsHistoricoService } from "./workflows-historico.service";
import type { WorkflowUserContext } from "./workflows.types";

type DbTransaction = Parameters<Database["transaction"]>[0] extends (
  tx: infer T,
) => unknown
  ? T
  : never;

type EtapaAtual = {
  id: string;
  titulo: string;
  instrucao: string | null;
  ordem: number;
  versao: number;
};

type FaseAtual = {
  id: string;
  nome: string;
  ordem: number;
  etapas?: EtapaAtual[];
};

type ModeloComColecoes = {
  id: string;
  schoolId: string;
  unitId: string;
  categoriaId: string;
  nome: string;
  descricaoCurta: string;
  status: WorkflowModeloStatus;
  criadoPor: string;
  orientacoes?: Array<{
    id: string;
    titulo: string;
    conteudo: string;
    ordem: number;
  }>;
  fases?: FaseAtual[];
};

type FaseDto = CriarModeloDto["fases"][number];
type EtapaDto = FaseDto["etapas"][number];

type EtapaAlterada = {
  etapaId: string;
  novaVersao: number;
};

@Injectable()
export class WorkflowsModelosService {
  constructor(
    private readonly database: DatabaseService,
    private readonly historicoService: WorkflowsHistoricoService,
  ) {}

  private validarTenant(
    session: WorkflowUserContext,
  ): asserts session is WorkflowUserContext & {
    schoolId: string;
    unitId: string;
  } {
    if (!session.schoolId || !session.unitId) {
      throw new BadRequestException(
        "Sessao invalida: escola e unidade sao obrigatorias",
      );
    }
  }

  private ehGestao(session: WorkflowUserContext) {
    return (WORKFLOW_GESTAO_ROLES as readonly string[]).includes(session.role);
  }

  private exigirGestao(session: WorkflowUserContext) {
    if (!this.ehGestao(session)) {
      throw new ForbiddenException(
        "Voce nao tem permissao para gerenciar modelos de workflows",
      );
    }
  }

  private relacoesModelo() {
    return {
      categoria: true,
      orientacoes: {
        orderBy: asc(workflowOrientacoes.ordem),
      },
      fases: {
        orderBy: asc(workflowFases.ordem),
        with: {
          etapas: {
            orderBy: asc(workflowEtapas.ordem),
          },
        },
      },
    };
  }

  private async buscarCategoriaDaUnidade(
    session: WorkflowUserContext & { schoolId: string; unitId: string },
    categoriaId: string,
  ) {
    const categoria = await this.database.db.query.workflowCategorias.findFirst({
      where: and(
        eq(workflowCategorias.id, categoriaId),
        eq(workflowCategorias.schoolId, session.schoolId),
        eq(workflowCategorias.unitId, session.unitId),
      ),
    });

    if (!categoria) {
      throw new NotFoundException("Categoria nao encontrada");
    }

    if (categoria.ativo === false) {
      throw new BadRequestException(
        "Categoria inativa não pode ser atribuída ao modelo",
      );
    }

    return categoria;
  }

  private async buscarModeloDaUnidade(
    session: WorkflowUserContext & { schoolId: string; unitId: string },
    modeloId: string,
    options?: { apenasPublicado?: boolean },
  ) {
    const filtros = [
      eq(workflowModelos.id, modeloId),
      eq(workflowModelos.schoolId, session.schoolId),
      eq(workflowModelos.unitId, session.unitId),
    ];

    if (options?.apenasPublicado) {
      filtros.push(eq(workflowModelos.status, "PUBLICADO"));
    }

    const modelo = await this.database.db.query.workflowModelos.findFirst({
      where: and(...filtros),
      with: this.relacoesModelo(),
    });

    if (!modelo) {
      throw new NotFoundException("Modelo de workflow nao encontrado");
    }

    return modelo as ModeloComColecoes;
  }

  private temFaseEEtapa(fases: FaseDto[] | FaseAtual[] | undefined) {
    return (
      Array.isArray(fases) &&
      fases.length > 0 &&
      fases.some((fase) => Array.isArray(fase.etapas) && fase.etapas.length > 0)
    );
  }

  private mapaEtapas(modelo: ModeloComColecoes) {
    const etapas = new Map<string, EtapaAtual>();

    for (const fase of modelo.fases ?? []) {
      for (const etapa of fase.etapas ?? []) {
        etapas.set(etapa.id, etapa);
      }
    }

    return etapas;
  }

  private identificarEtapasAlteradas(
    modelo: ModeloComColecoes,
    fases?: FaseDto[],
  ): EtapaAlterada[] {
    if (modelo.status !== "PUBLICADO" || !fases) {
      return [];
    }

    const etapasAtuais = this.mapaEtapas(modelo);
    const alteradas: EtapaAlterada[] = [];

    for (const fase of fases) {
      for (const etapa of fase.etapas) {
        if (!etapa.id) continue;

        const etapaAtual = etapasAtuais.get(etapa.id);
        if (!etapaAtual || !this.etapaMudou(etapaAtual, etapa)) continue;

        alteradas.push({
          etapaId: etapa.id,
          novaVersao: etapaAtual.versao + 1,
        });
      }
    }

    return alteradas;
  }

  private validarEstruturaPublicada(modelo: ModeloComColecoes, fases: FaseDto[]) {
    if (modelo.status !== "PUBLICADO") {
      return;
    }

    const fasesAtuais = new Map(
      (modelo.fases ?? []).map((fase) => [fase.id, fase]),
    );
    const faseIdsNovas = new Set<string>();

    for (const fase of fases) {
      if (!fase.id) {
        throw new BadRequestException(
          "Modelos publicados nao permitem adicionar fases",
        );
      }

      const faseAtual = fasesAtuais.get(fase.id);
      if (!faseAtual) {
        throw new BadRequestException(
          "Modelos publicados nao permitem usar fase desconhecida",
        );
      }
      if (fase.ordem !== faseAtual.ordem) {
        throw new BadRequestException(
          "Modelos publicados nao permitem reordenar fases",
        );
      }
      faseIdsNovas.add(fase.id);

      this.validarEtapasPublicadas(faseAtual, fase.etapas);
    }

    for (const faseId of fasesAtuais.keys()) {
      if (!faseIdsNovas.has(faseId)) {
        throw new BadRequestException(
          "Modelos publicados nao permitem remover fases",
        );
      }
    }
  }

  private validarEtapasPublicadas(faseAtual: FaseAtual, etapas: EtapaDto[]) {
    const etapasAtuais = new Map(
      (faseAtual.etapas ?? []).map((etapa) => [etapa.id, etapa]),
    );
    const etapaIdsNovas = new Set<string>();

    for (const etapa of etapas) {
      if (!etapa.id) {
        throw new BadRequestException(
          "Modelos publicados nao permitem adicionar etapas",
        );
      }

      const etapaAtual = etapasAtuais.get(etapa.id);
      if (!etapaAtual) {
        throw new BadRequestException(
          "Modelos publicados nao permitem usar etapa desconhecida ou mover etapa entre fases",
        );
      }
      if (etapa.ordem !== etapaAtual.ordem) {
        throw new BadRequestException(
          "Modelos publicados nao permitem reordenar etapas",
        );
      }

      etapaIdsNovas.add(etapa.id);
    }

    for (const etapaId of etapasAtuais.keys()) {
      if (!etapaIdsNovas.has(etapaId)) {
        throw new BadRequestException(
          "Modelos publicados nao permitem remover etapas",
        );
      }
    }
  }

  private async inserirOrientacoes(
    tx: DbTransaction,
    modeloId: string,
    orientacoes: CriarModeloDto["orientacoes"],
  ) {
    if (orientacoes.length === 0) {
      return;
    }

    await tx.insert(workflowOrientacoes).values(
      orientacoes.map((orientacao) => ({
        modeloId,
        titulo: orientacao.titulo,
        conteudo: orientacao.conteudo,
        ordem: orientacao.ordem,
      })),
    );
  }

  private async inserirFasesEtapas(
    tx: DbTransaction,
    modeloId: string,
    fases: CriarModeloDto["fases"],
  ) {
    for (const fase of fases) {
      const [faseCriada] = await tx
        .insert(workflowFases)
        .values({
          modeloId,
          nome: fase.nome,
          ordem: fase.ordem,
        })
        .returning();

      if (!faseCriada) {
        throw new BadRequestException("Falha ao criar fase do modelo");
      }

      await tx.insert(workflowEtapas).values(
        fase.etapas.map((etapa) => ({
          faseId: faseCriada.id,
          titulo: etapa.titulo,
          instrucao: etapa.instrucao ?? null,
          ordem: etapa.ordem,
        })),
      );
    }
  }

  private async substituirOrientacoes(
    tx: DbTransaction,
    modeloId: string,
    orientacoes: CriarModeloDto["orientacoes"],
  ) {
    await tx
      .delete(workflowOrientacoes)
      .where(eq(workflowOrientacoes.modeloId, modeloId));

    await this.inserirOrientacoes(tx, modeloId, orientacoes);
  }

  private async sincronizarFasesEtapas(
    tx: DbTransaction,
    modelo: ModeloComColecoes,
    fases: FaseDto[],
    etapasAlteradas: EtapaAlterada[],
  ) {
    const fasesAtuais = new Map(
      (modelo.fases ?? []).map((fase) => [fase.id, fase]),
    );
    const etapasAtuais = this.mapaEtapas(modelo);
    const etapasAlteradasPorId = new Map(
      etapasAlteradas.map((etapa) => [etapa.etapaId, etapa.novaVersao]),
    );
    const fasesMantidas = new Set<string>();
    const etapasMantidas = new Set<string>();

    for (const fase of fases) {
      let faseId = fase.id;

      if (faseId && fasesAtuais.has(faseId)) {
        fasesMantidas.add(faseId);

        await tx
          .update(workflowFases)
          .set({ nome: fase.nome, ordem: fase.ordem })
          .where(
            and(
              eq(workflowFases.id, faseId),
              eq(workflowFases.modeloId, modelo.id),
            ),
          );
      } else {
        const [faseCriada] = await tx
          .insert(workflowFases)
          .values({
            modeloId: modelo.id,
            nome: fase.nome,
            ordem: fase.ordem,
          })
          .returning();

        if (!faseCriada) {
          throw new BadRequestException("Falha ao criar fase do modelo");
        }

        faseId = faseCriada.id;
      }

      if (!faseId) {
        throw new BadRequestException("Falha ao identificar fase do modelo");
      }

      for (const etapa of fase.etapas) {
        await this.sincronizarEtapa(
          tx,
          faseId,
          etapa,
          etapasAtuais,
          etapasAlteradasPorId,
          etapasMantidas,
        );
      }
    }

    const etapasRemovidas = Array.from(etapasAtuais.keys()).filter(
      (etapaId) => !etapasMantidas.has(etapaId),
    );
    if (etapasRemovidas.length > 0) {
      await tx
        .delete(workflowEtapas)
        .where(inArray(workflowEtapas.id, etapasRemovidas));
    }

    const fasesRemovidas = Array.from(fasesAtuais.keys()).filter(
      (faseId) => !fasesMantidas.has(faseId),
    );
    if (fasesRemovidas.length > 0) {
      await tx
        .delete(workflowFases)
        .where(inArray(workflowFases.id, fasesRemovidas));
    }
  }

  private async sincronizarEtapa(
    tx: DbTransaction,
    faseId: string,
    etapa: EtapaDto,
    etapasAtuais: Map<string, EtapaAtual>,
    etapasAlteradasPorId: Map<string, number>,
    etapasMantidas: Set<string>,
  ) {
    if (etapa.id && etapasAtuais.has(etapa.id)) {
      const etapaAtual = etapasAtuais.get(etapa.id)!;
      const novaVersao = etapasAlteradasPorId.get(etapa.id) ?? etapaAtual.versao;
      etapasMantidas.add(etapa.id);

      await tx
        .update(workflowEtapas)
        .set({
          faseId,
          titulo: etapa.titulo,
          instrucao: etapa.instrucao ?? null,
          ordem: etapa.ordem,
          versao: novaVersao,
          updatedAt: new Date(),
        })
        .where(eq(workflowEtapas.id, etapa.id));

      return;
    }

    await tx.insert(workflowEtapas).values({
      faseId,
      titulo: etapa.titulo,
      instrucao: etapa.instrucao ?? null,
      ordem: etapa.ordem,
    });
  }

  private async buscarExecucoesAbertasImpactadas(
    session: WorkflowUserContext & { schoolId: string; unitId: string },
    modeloId: string,
  ) {
    return (await this.database.db.query.workflowExecucoes.findMany({
      columns: { id: true },
      where: and(
        eq(workflowExecucoes.modeloId, modeloId),
        eq(workflowExecucoes.schoolId, session.schoolId),
        eq(workflowExecucoes.unitId, session.unitId),
        eq(workflowExecucoes.status, "EM_ANDAMENTO"),
      ),
    })) as Array<{ id: string }>;
  }

  private async resetarEtapasAlteradas(
    tx: DbTransaction,
    modeloId: string,
    execucaoIds: string[],
    etapasAlteradas: EtapaAlterada[],
  ) {
    for (const etapa of etapasAlteradas) {
      await tx
        .update(workflowEtapaProgresso)
        .set({
          concluida: false,
          concluidaPor: null,
          concluidaAt: null,
          etapaVersao: etapa.novaVersao,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(workflowEtapaProgresso.etapaId, etapa.etapaId),
            inArray(workflowEtapaProgresso.execucaoId, execucaoIds),
          ),
        );
    }

    await tx
      .update(workflowExecucoes)
      .set({ modeloAtualizado: true, updatedAt: new Date() })
      .where(
        and(
          eq(workflowExecucoes.modeloId, modeloId),
          eq(workflowExecucoes.status, "EM_ANDAMENTO"),
          inArray(workflowExecucoes.id, execucaoIds),
        ),
      );
  }

  private async registrarHistoricoModeloAtualizado(
    session: WorkflowUserContext,
    modeloId: string,
    execucaoIds: string[],
    etapasAlteradas: EtapaAlterada[],
    executor: DbTransaction,
  ) {
    await Promise.all(
      execucaoIds.map((execucaoId) =>
        this.historicoService.registrar(
          {
            execucaoId,
            tipo: "MODELO_ATUALIZADO",
            descricao: "Workflow modelo atualizado pela gestao",
            autorId: session.userId,
            metadata: {
              modeloId,
              etapasAtualizadas: etapasAlteradas.map((etapa) => etapa.etapaId),
            },
          },
          executor,
        ),
      ),
    );
  }

  private etapaMudou(
    etapaAtual: { titulo: string; instrucao: string | null },
    etapaNova: { titulo: string; instrucao?: string | null },
  ) {
    return (
      etapaAtual.titulo !== etapaNova.titulo ||
      (etapaAtual.instrucao ?? null) !== (etapaNova.instrucao ?? null)
    );
  }

  async listar(session: WorkflowUserContext, dto: ListarModelosDto) {
    this.validarTenant(session);

    const status = this.ehGestao(session) ? dto.status : "PUBLICADO";
    const filtros = [
      eq(workflowModelos.schoolId, session.schoolId),
      eq(workflowModelos.unitId, session.unitId),
    ];

    if (status !== "todos") {
      filtros.push(eq(workflowModelos.status, status));
    }
    if (dto.categoriaId) {
      filtros.push(eq(workflowModelos.categoriaId, dto.categoriaId));
    }
    if (dto.busca) {
      filtros.push(ilike(workflowModelos.nome, `%${dto.busca}%`));
    }

    return this.database.db.query.workflowModelos.findMany({
      where: and(...filtros),
      with: this.relacoesModelo(),
      orderBy: [asc(workflowModelos.nome)],
    });
  }

  async criar(session: WorkflowUserContext, dto: CriarModeloDto) {
    this.validarTenant(session);
    this.exigirGestao(session);
    await this.buscarCategoriaDaUnidade(session, dto.categoriaId);

    return this.database.db.transaction(async (tx: DbTransaction) => {
      const [modelo] = await tx
        .insert(workflowModelos)
        .values({
          schoolId: session.schoolId,
          unitId: session.unitId,
          categoriaId: dto.categoriaId,
          nome: dto.nome,
          descricaoCurta: dto.descricaoCurta,
          status: "RASCUNHO",
          criadoPor: session.userId,
        })
        .returning();

      if (!modelo) {
        throw new BadRequestException("Falha ao criar modelo de workflow");
      }

      await this.inserirOrientacoes(tx, modelo.id, dto.orientacoes);
      await this.inserirFasesEtapas(tx, modelo.id, dto.fases);

      return modelo;
    });
  }

  async buscarPorId(session: WorkflowUserContext, modeloId: string) {
    this.validarTenant(session);

    return this.buscarModeloDaUnidade(session, modeloId, {
      apenasPublicado: !this.ehGestao(session),
    });
  }

  async atualizar(
    session: WorkflowUserContext,
    modeloId: string,
    dto: AtualizarModeloDto,
  ) {
    this.validarTenant(session);
    this.exigirGestao(session);

    const modelo = await this.buscarModeloDaUnidade(session, modeloId);

    if (
      dto.categoriaId !== undefined &&
      dto.categoriaId !== modelo.categoriaId
    ) {
      await this.buscarCategoriaDaUnidade(session, dto.categoriaId);
    }

    const fasesPublicacao = dto.fases ?? modelo.fases;
    if (dto.status === "PUBLICADO" && !this.temFaseEEtapa(fasesPublicacao)) {
      throw new BadRequestException(
        "Modelo precisa ter ao menos uma fase e uma etapa para publicar",
      );
    }
    if (dto.fases !== undefined) {
      this.validarEstruturaPublicada(modelo, dto.fases);
    }

    const etapasAlteradas = this.identificarEtapasAlteradas(modelo, dto.fases);
    const execucoesImpactadas =
      etapasAlteradas.length > 0
        ? await this.buscarExecucoesAbertasImpactadas(session, modeloId)
        : [];
    const execucaoIds = execucoesImpactadas.map((execucao) => execucao.id);

    await this.database.db.transaction(async (tx: DbTransaction) => {
      const dadosModelo: Partial<typeof workflowModelos.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (dto.categoriaId !== undefined) dadosModelo.categoriaId = dto.categoriaId;
      if (dto.nome !== undefined) dadosModelo.nome = dto.nome;
      if (dto.descricaoCurta !== undefined) {
        dadosModelo.descricaoCurta = dto.descricaoCurta;
      }
      if (dto.status !== undefined) dadosModelo.status = dto.status;

      await tx
        .update(workflowModelos)
        .set(dadosModelo)
        .where(
          and(
            eq(workflowModelos.id, modeloId),
            eq(workflowModelos.schoolId, session.schoolId),
            eq(workflowModelos.unitId, session.unitId),
          ),
        );

      if (dto.orientacoes !== undefined) {
        await this.substituirOrientacoes(tx, modeloId, dto.orientacoes);
      }

      if (dto.fases !== undefined) {
        await this.sincronizarFasesEtapas(
          tx,
          modelo,
          dto.fases,
          etapasAlteradas,
        );
      }

      if (execucaoIds.length > 0 && etapasAlteradas.length > 0) {
        await this.resetarEtapasAlteradas(
          tx,
          modeloId,
          execucaoIds,
          etapasAlteradas,
        );

        await this.registrarHistoricoModeloAtualizado(
          session,
          modeloId,
          execucaoIds,
          etapasAlteradas,
          tx,
        );
      }
    });
    return this.buscarModeloDaUnidade(session, modeloId);
  }

  async publicar(session: WorkflowUserContext, modeloId: string) {
    this.validarTenant(session);
    this.exigirGestao(session);

    const modelo = await this.buscarModeloDaUnidade(session, modeloId);
    if (!this.temFaseEEtapa(modelo.fases)) {
      throw new BadRequestException(
        "Modelo precisa ter ao menos uma fase e uma etapa para publicar",
      );
    }

    const [modeloAtualizado] = await this.database.db
      .update(workflowModelos)
      .set({ status: "PUBLICADO", updatedAt: new Date() })
      .where(
        and(
          eq(workflowModelos.id, modeloId),
          eq(workflowModelos.schoolId, session.schoolId),
          eq(workflowModelos.unitId, session.unitId),
        ),
      )
      .returning();

    if (!modeloAtualizado) {
      throw new NotFoundException("Modelo de workflow nao encontrado");
    }

    return modeloAtualizado;
  }

  async inativar(session: WorkflowUserContext, modeloId: string) {
    this.validarTenant(session);
    this.exigirGestao(session);

    const [modeloAtualizado] = await this.database.db
      .update(workflowModelos)
      .set({ status: "INATIVO", updatedAt: new Date() })
      .where(
        and(
          eq(workflowModelos.id, modeloId),
          eq(workflowModelos.schoolId, session.schoolId),
          eq(workflowModelos.unitId, session.unitId),
        ),
      )
      .returning();

    if (!modeloAtualizado) {
      throw new NotFoundException("Modelo de workflow nao encontrado");
    }

    return modeloAtualizado;
  }

  async duplicar(session: WorkflowUserContext, modeloId: string) {
    this.validarTenant(session);
    this.exigirGestao(session);

    const modelo = await this.buscarModeloDaUnidade(session, modeloId);
    await this.buscarCategoriaDaUnidade(session, modelo.categoriaId);

    return this.database.db.transaction(async (tx: DbTransaction) => {
      const [modeloDuplicado] = await tx
        .insert(workflowModelos)
        .values({
          schoolId: session.schoolId,
          unitId: session.unitId,
          categoriaId: modelo.categoriaId,
          nome: `Copia de ${modelo.nome}`,
          descricaoCurta: modelo.descricaoCurta,
          status: "RASCUNHO",
          criadoPor: session.userId,
        })
        .returning();

      if (!modeloDuplicado) {
        throw new BadRequestException("Falha ao duplicar modelo de workflow");
      }

      await this.inserirOrientacoes(
        tx,
        modeloDuplicado.id,
        (modelo.orientacoes ?? []).map((orientacao) => ({
          titulo: orientacao.titulo,
          conteudo: orientacao.conteudo,
          ordem: orientacao.ordem,
        })),
      );
      await this.inserirFasesEtapas(
        tx,
        modeloDuplicado.id,
        (modelo.fases ?? []).map((fase) => ({
          nome: fase.nome,
          ordem: fase.ordem,
          etapas: (fase.etapas ?? []).map((etapa) => ({
            titulo: etapa.titulo,
            instrucao: etapa.instrucao,
            ordem: etapa.ordem,
          })),
        })),
      );

      return modeloDuplicado;
    });
  }
}
