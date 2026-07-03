import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  workflowAnexos,
  workflowEtapaProgresso,
  workflowEtapas,
  workflowExecucoes,
  workflowFases,
  workflowHistorico,
  workflowModelos,
  workflowOrientacoes,
} from "@essencia/db";
import type {
  Database,
  WorkflowExecucaoStatus,
  WorkflowModeloStatus,
} from "@essencia/db";

import { DatabaseService } from "../../common/database/database.service";
import { StorageService } from "../../common/storage/storage.service";
import type {
  AtualizarEtapaDto,
  EditarTituloExecucaoDto,
  IniciarExecucaoDto,
  ListarExecucoesDto,
  MotivoObrigatorioDto,
} from "./dto/workflows.dto";
import { WORKFLOW_GESTAO_ROLES } from "./workflows.constants";
import { WorkflowsHistoricoService } from "./workflows-historico.service";
import type { WorkflowUserContext } from "./workflows.types";

type DbTransaction = Parameters<Database["transaction"]>[0] extends (
  tx: infer T,
) => unknown
  ? T
  : never;

type EtapaDoModelo = {
  id: string;
  titulo?: string;
  versao?: number;
};

type FaseDoModelo = {
  nome: string;
  etapas?: EtapaDoModelo[];
};

type ModeloComEtapas = {
  id: string;
  status: WorkflowModeloStatus;
  fases?: FaseDoModelo[];
};

type ProgressoEtapa = {
  etapaId: string;
  concluida: boolean;
  observacao?: string | null;
};

type UsuarioRelacionado = {
  name?: string | null;
  nome?: string | null;
  email?: string | null;
};

type AnexoExecucao = {
  storageKey?: string;
  enviadoPorUser?: UsuarioRelacionado | null;
  [key: string]: unknown;
};

type ExecucaoComRelacoes = {
  id: string;
  schoolId: string;
  unitId: string;
  modeloId?: string;
  titulo?: string;
  status: WorkflowExecucaoStatus;
  teste: boolean;
  iniciadoPor: string;
  modelo?: ModeloComEtapas;
  progresso?: ProgressoEtapa[];
  anexos?: AnexoExecucao[];
  historico?: Array<{
    autor?: UsuarioRelacionado | null;
  }>;
};

@Injectable()
export class WorkflowsExecucoesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly historicoService: WorkflowsHistoricoService,
    private readonly storageService: StorageService,
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

  private isGestao(role: string) {
    return (WORKFLOW_GESTAO_ROLES as readonly string[]).includes(role);
  }

  private exigirGestao(session: WorkflowUserContext) {
    if (!this.isGestao(session.role)) {
      throw new ForbiddenException(
        "Voce nao tem permissao para gerenciar execucoes de workflows",
      );
    }
  }

  private podeVerExecucao(
    session: WorkflowUserContext,
    execucao: { iniciadoPor: string; teste: boolean },
  ) {
    if (this.isGestao(session.role)) return true;
    return !execucao.teste && execucao.iniciadoPor === session.userId;
  }

  private exigirPodeAlterarExecucao(
    session: WorkflowUserContext,
    execucao: { iniciadoPor: string; teste: boolean },
  ) {
    if (this.isGestao(session.role)) return;
    if (execucao.teste || execucao.iniciadoPor !== session.userId) {
      throw new ForbiddenException(
        "Voce nao tem permissao para alterar esta execucao",
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

  private relacoesExecucao() {
    return {
      modelo: {
        with: this.relacoesModelo(),
      },
      progresso: true,
      anexos: {
        orderBy: desc(workflowAnexos.createdAt),
        with: {
          enviadoPorUser: true,
        },
      },
      historico: {
        orderBy: desc(workflowHistorico.createdAt),
        with: {
          autor: true,
        },
      },
    };
  }

  private relacoesExecucaoResumo() {
    return {
      modelo: {
        with: this.relacoesModelo(),
      },
      progresso: true,
    };
  }

  private etapasDoModelo(modelo: ModeloComEtapas) {
    return (modelo.fases ?? []).flatMap((fase) => fase.etapas ?? []);
  }

  private todasEtapasConcluidas(
    modelo: ModeloComEtapas,
    progresso: ProgressoEtapa[] = [],
  ) {
    const concluidas = new Set(
      progresso.filter((item) => item.concluida).map((item) => item.etapaId),
    );
    const etapas = this.etapasDoModelo(modelo);

    return (
      etapas.length > 0 && etapas.every((etapa) => concluidas.has(etapa.id))
    );
  }

  private calcularFaseAtual(
    modelo: ModeloComEtapas,
    progresso: ProgressoEtapa[] = [],
  ) {
    const concluidas = new Set(
      progresso.filter((item) => item.concluida).map((item) => item.etapaId),
    );
    const primeiraPendente = (modelo.fases ?? []).find((fase) =>
      (fase.etapas ?? []).some((etapa) => !concluidas.has(etapa.id)),
    );

    return primeiraPendente?.nome ?? null;
  }

  private calcularProgressoPercentual(
    modelo: ModeloComEtapas,
    progresso: ProgressoEtapa[] = [],
  ) {
    const etapas = this.etapasDoModelo(modelo);
    if (etapas.length === 0) return 0;

    const concluidas = new Set(
      progresso.filter((item) => item.concluida).map((item) => item.etapaId),
    );
    const totalConcluidas = etapas.filter((etapa) =>
      concluidas.has(etapa.id),
    ).length;

    return Math.round((totalConcluidas / etapas.length) * 100);
  }

  private nomeUsuario(usuario?: UsuarioRelacionado | null) {
    return usuario?.name ?? usuario?.nome ?? usuario?.email ?? null;
  }

  private normalizarExecucao<T extends ExecucaoComRelacoes>(execucao: T) {
    const modelo = execucao.modelo;
    const progresso = execucao.progresso ?? [];

    return {
      ...execucao,
      progresso,
      anexos: (execucao.anexos ?? []).map((anexo) => {
        const { enviadoPorUser, ...dadosAnexo } = anexo;

        return {
          ...dadosAnexo,
          enviadoPorNome: this.nomeUsuario(enviadoPorUser),
        };
      }),
      historico: (execucao.historico ?? []).map((item) => ({
        ...item,
        autorNome: this.nomeUsuario(item.autor),
      })),
      faseAtual: modelo ? this.calcularFaseAtual(modelo, progresso) : null,
      progressoPercentual: modelo
        ? this.calcularProgressoPercentual(modelo, progresso)
        : 0,
    };
  }

  private async buscarModeloDaUnidade(
    session: WorkflowUserContext & { schoolId: string; unitId: string },
    modeloId: string,
  ) {
    const modelo = await this.database.db.query.workflowModelos.findFirst({
      where: and(
        eq(workflowModelos.id, modeloId),
        eq(workflowModelos.schoolId, session.schoolId),
        eq(workflowModelos.unitId, session.unitId),
      ),
      with: this.relacoesModelo(),
    });

    if (!modelo) {
      throw new NotFoundException("Modelo de workflow nao encontrado");
    }

    return modelo as ModeloComEtapas;
  }

  private async buscarExecucaoDaUnidade(
    session: WorkflowUserContext & { schoolId: string; unitId: string },
    execucaoId: string,
  ) {
    const execucao = await this.database.db.query.workflowExecucoes.findFirst({
      where: and(
        eq(workflowExecucoes.id, execucaoId),
        eq(workflowExecucoes.schoolId, session.schoolId),
        eq(workflowExecucoes.unitId, session.unitId),
      ),
      with: this.relacoesExecucao(),
    });

    if (!execucao) {
      throw new NotFoundException("Execucao de workflow nao encontrada");
    }

    return execucao as ExecucaoComRelacoes;
  }

  private validarInicio(
    session: WorkflowUserContext,
    modelo: ModeloComEtapas,
    teste: boolean,
  ) {
    const gestao = this.isGestao(session.role);

    if (modelo.status === "INATIVO") {
      throw new BadRequestException("Modelo inativo nao pode iniciar execucao");
    }

    if (!gestao) {
      if (teste || modelo.status !== "PUBLICADO") {
        throw new ForbiddenException(
          "Usuarios comuns so podem iniciar execucoes reais de modelos publicados",
        );
      }
      return;
    }

    if (modelo.status === "RASCUNHO" && !teste) {
      throw new BadRequestException(
        "Modelos em rascunho so podem iniciar execucao de teste",
      );
    }
  }

  private localizarEtapa(modelo: ModeloComEtapas, etapaId: string) {
    return this.etapasDoModelo(modelo).find((etapa) => etapa.id === etapaId);
  }

  private localizarProgresso(
    execucao: ExecucaoComRelacoes,
    etapaId: string,
  ) {
    return (execucao.progresso ?? []).find(
      (item) => item.etapaId === etapaId,
    );
  }

  async iniciar(
    session: WorkflowUserContext,
    modeloId: string,
    dto: IniciarExecucaoDto,
  ) {
    this.validarTenant(session);

    const modelo = await this.buscarModeloDaUnidade(session, modeloId);
    const teste = dto.teste ?? false;
    this.validarInicio(session, modelo, teste);

    const etapas = this.etapasDoModelo(modelo);
    if (etapas.length === 0) {
      throw new BadRequestException(
        "Modelo precisa ter ao menos uma etapa para iniciar execucao",
      );
    }

    const execucaoCriada = await this.database.db.transaction(
      async (tx: DbTransaction) => {
      const [execucao] = (await tx
        .insert(workflowExecucoes)
        .values({
          schoolId: session.schoolId,
          unitId: session.unitId,
          modeloId,
          titulo: dto.titulo,
          status: "EM_ANDAMENTO",
          teste,
          iniciadoPor: session.userId,
        })
        .returning()) as Array<{ id: string }>;

      if (!execucao) {
        throw new BadRequestException("Falha ao iniciar workflow");
      }

      await tx.insert(workflowEtapaProgresso).values(
        etapas.map((etapa) => ({
          execucaoId: execucao.id,
          etapaId: etapa.id,
          etapaVersao: etapa.versao ?? 1,
          concluida: false,
        })),
      );

      await this.historicoService.registrar(
        {
          execucaoId: execucao.id,
          tipo: "WORKFLOW_INICIADO",
          descricao: "Workflow iniciado",
          autorId: session.userId,
          metadata: {
            modeloId,
            titulo: dto.titulo,
            teste,
          },
        },
        tx,
      );

      return execucao;
      },
    );

    return this.buscarPorId(session, execucaoCriada.id);
  }

  async listar(session: WorkflowUserContext, dto: ListarExecucoesDto) {
    this.validarTenant(session);

    const filtros = [
      eq(workflowExecucoes.schoolId, session.schoolId),
      eq(workflowExecucoes.unitId, session.unitId),
    ];

    if (dto.status !== "todos") {
      filtros.push(eq(workflowExecucoes.status, dto.status));
    }
    if (dto.busca) {
      filtros.push(ilike(workflowExecucoes.titulo, `%${dto.busca}%`));
    }

    if (this.isGestao(session.role)) {
      if (dto.teste !== undefined) {
        filtros.push(eq(workflowExecucoes.teste, dto.teste));
      }
    } else {
      filtros.push(eq(workflowExecucoes.iniciadoPor, session.userId));
      filtros.push(eq(workflowExecucoes.teste, false));
    }

    const execucoes = (await this.database.db.query.workflowExecucoes.findMany({
      where: and(...filtros),
      with: this.relacoesExecucaoResumo(),
      orderBy: [
        desc(workflowExecucoes.updatedAt),
        desc(workflowExecucoes.createdAt),
      ],
    })) as ExecucaoComRelacoes[];

    return execucoes.map((execucao) => this.normalizarExecucao(execucao));
  }

  async buscarPorId(session: WorkflowUserContext, execucaoId: string) {
    this.validarTenant(session);

    const execucao = await this.buscarExecucaoDaUnidade(session, execucaoId);
    if (!this.podeVerExecucao(session, execucao)) {
      throw new ForbiddenException(
        "Voce nao tem permissao para visualizar esta execucao",
      );
    }

    return this.normalizarExecucao(execucao);
  }

  async editarTitulo(
    session: WorkflowUserContext,
    execucaoId: string,
    dto: EditarTituloExecucaoDto,
  ) {
    this.validarTenant(session);

    const execucao = await this.buscarExecucaoDaUnidade(session, execucaoId);
    this.exigirPodeAlterarExecucao(session, execucao);

    await this.database.db.transaction(async (tx: DbTransaction) => {
      const [atualizada] = (await tx
        .update(workflowExecucoes)
        .set({ titulo: dto.titulo, updatedAt: new Date() })
        .where(
          and(
            eq(workflowExecucoes.id, execucaoId),
            eq(workflowExecucoes.schoolId, session.schoolId),
            eq(workflowExecucoes.unitId, session.unitId),
          ),
        )
        .returning()) as Array<{ id: string }>;

      if (!atualizada) {
        throw new NotFoundException("Execucao de workflow nao encontrada");
      }

      await this.historicoService.registrar(
        {
          execucaoId,
          tipo: "TITULO_EXECUCAO_EDITADO",
          descricao: "Titulo da execucao editado",
          autorId: session.userId,
          metadata: {
            tituloAnterior: execucao.titulo,
            tituloNovo: dto.titulo,
          },
        },
        tx,
      );
    });

    return this.buscarPorId(session, execucaoId);
  }

  async atualizarEtapa(
    session: WorkflowUserContext,
    execucaoId: string,
    etapaId: string,
    dto: AtualizarEtapaDto,
  ) {
    this.validarTenant(session);

    if (dto.concluida === undefined && dto.observacao === undefined) {
      throw new BadRequestException("Informe ao menos um campo para atualizar");
    }

    const execucao = await this.buscarExecucaoDaUnidade(session, execucaoId);
    if (execucao.status !== "EM_ANDAMENTO") {
      throw new BadRequestException(
        "Somente execucoes em andamento podem atualizar etapas",
      );
    }
    this.exigirPodeAlterarExecucao(session, execucao);

    if (!execucao.modelo) {
      throw new BadRequestException("Execucao sem modelo associado");
    }

    const etapa = this.localizarEtapa(execucao.modelo, etapaId);
    if (!etapa) {
      throw new NotFoundException("Etapa nao encontrada nesta execucao");
    }

    const progressoAtual = this.localizarProgresso(execucao, etapaId);
    if (!progressoAtual) {
      throw new NotFoundException("Progresso da etapa nao encontrado");
    }

    const dadosAtualizacao: Partial<
      typeof workflowEtapaProgresso.$inferInsert
    > = {
      updatedAt: new Date(),
    };

    if (dto.concluida !== undefined) {
      dadosAtualizacao.concluida = dto.concluida;
      dadosAtualizacao.concluidaPor = dto.concluida ? session.userId : null;
      dadosAtualizacao.concluidaAt = dto.concluida ? new Date() : null;
    }
    if (dto.observacao !== undefined) {
      dadosAtualizacao.observacao = dto.observacao ?? null;
    }

    await this.database.db.transaction(async (tx: DbTransaction) => {
      const [progressoAtualizado] = (await tx
        .update(workflowEtapaProgresso)
        .set(dadosAtualizacao)
        .where(
          and(
            eq(workflowEtapaProgresso.execucaoId, execucaoId),
            eq(workflowEtapaProgresso.etapaId, etapaId),
          ),
        )
        .returning()) as Array<{ id: string }>;

      if (!progressoAtualizado) {
        throw new NotFoundException("Progresso da etapa nao encontrado");
      }

      if (
        dto.concluida !== undefined &&
        dto.concluida !== progressoAtual.concluida
      ) {
        await this.historicoService.registrar(
          {
            execucaoId,
            tipo: dto.concluida ? "ETAPA_CONCLUIDA" : "ETAPA_PENDENTE",
            descricao: dto.concluida
              ? "Etapa concluida"
              : "Etapa marcada pendente",
            autorId: session.userId,
            metadata: {
              etapaId,
              etapaTitulo: etapa.titulo,
            },
          },
          tx,
        );
      }

      if (
        dto.observacao !== undefined &&
        (dto.observacao ?? null) !== (progressoAtual.observacao ?? null)
      ) {
        await this.historicoService.registrar(
          {
            execucaoId,
            tipo: "OBSERVACAO_ETAPA_ALTERADA",
            descricao: "Observacao da etapa alterada",
            autorId: session.userId,
            metadata: {
              etapaId,
              etapaTitulo: etapa.titulo,
            },
          },
          tx,
        );
      }
    });

    return this.buscarPorId(session, execucaoId);
  }

  async concluir(session: WorkflowUserContext, execucaoId: string) {
    this.validarTenant(session);

    const execucao = await this.buscarExecucaoDaUnidade(session, execucaoId);
    if (execucao.status !== "EM_ANDAMENTO") {
      throw new BadRequestException(
        "Somente execucoes em andamento podem ser concluidas",
      );
    }
    this.exigirPodeAlterarExecucao(session, execucao);

    if (
      !execucao.modelo ||
      !this.todasEtapasConcluidas(execucao.modelo, execucao.progresso ?? [])
    ) {
      throw new BadRequestException(
        "Todas as etapas precisam estar concluidas para encerrar o workflow",
      );
    }

    await this.database.db.transaction(async (tx: DbTransaction) => {
      const [atualizada] = (await tx
        .update(workflowExecucoes)
        .set({
          status: "CONCLUIDA",
          concluidoAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(workflowExecucoes.id, execucaoId),
            eq(workflowExecucoes.schoolId, session.schoolId),
            eq(workflowExecucoes.unitId, session.unitId),
          ),
        )
        .returning()) as Array<{ id: string }>;

      if (!atualizada) {
        throw new NotFoundException("Execucao de workflow nao encontrada");
      }

      await this.historicoService.registrar(
        {
          execucaoId,
          tipo: "EXECUCAO_CONCLUIDA",
          descricao: "Execucao concluida",
          autorId: session.userId,
        },
        tx,
      );
    });

    return this.buscarPorId(session, execucaoId);
  }

  async cancelar(
    session: WorkflowUserContext,
    execucaoId: string,
    dto: MotivoObrigatorioDto,
  ) {
    this.validarTenant(session);

    const execucao = await this.buscarExecucaoDaUnidade(session, execucaoId);
    this.exigirPodeAlterarExecucao(session, execucao);
    if (execucao.status !== "EM_ANDAMENTO") {
      throw new BadRequestException(
        "Somente execucoes em andamento podem ser canceladas",
      );
    }

    await this.database.db.transaction(async (tx: DbTransaction) => {
      const [atualizada] = (await tx
        .update(workflowExecucoes)
        .set({
          status: "CANCELADA",
          canceladoAt: new Date(),
          motivoCancelamento: dto.motivo,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(workflowExecucoes.id, execucaoId),
            eq(workflowExecucoes.schoolId, session.schoolId),
            eq(workflowExecucoes.unitId, session.unitId),
          ),
        )
        .returning()) as Array<{ id: string }>;

      if (!atualizada) {
        throw new NotFoundException("Execucao de workflow nao encontrada");
      }

      await this.historicoService.registrar(
        {
          execucaoId,
          tipo: "EXECUCAO_CANCELADA",
          descricao: "Execucao cancelada",
          motivo: dto.motivo,
          autorId: session.userId,
        },
        tx,
      );
    });

    return this.buscarPorId(session, execucaoId);
  }

  async reabrir(
    session: WorkflowUserContext,
    execucaoId: string,
    dto: MotivoObrigatorioDto,
  ) {
    this.validarTenant(session);
    this.exigirGestao(session);

    const execucao = await this.buscarExecucaoDaUnidade(session, execucaoId);
    if (execucao.status !== "CONCLUIDA") {
      throw new BadRequestException(
        "Somente execucoes concluidas podem ser reabertas",
      );
    }

    await this.database.db.transaction(async (tx: DbTransaction) => {
      const [atualizada] = (await tx
        .update(workflowExecucoes)
        .set({
          status: "EM_ANDAMENTO",
          concluidoAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(workflowExecucoes.id, execucaoId),
            eq(workflowExecucoes.schoolId, session.schoolId),
            eq(workflowExecucoes.unitId, session.unitId),
          ),
        )
        .returning()) as Array<{ id: string }>;

      if (!atualizada) {
        throw new NotFoundException("Execucao de workflow nao encontrada");
      }

      await this.historicoService.registrar(
        {
          execucaoId,
          tipo: "EXECUCAO_REABERTA",
          descricao: "Execucao reaberta",
          motivo: dto.motivo,
          autorId: session.userId,
        },
        tx,
      );
    });

    return this.buscarPorId(session, execucaoId);
  }

  async descartarTeste(session: WorkflowUserContext, execucaoId: string) {
    this.validarTenant(session);
    this.exigirGestao(session);

    const execucao = await this.buscarExecucaoDaUnidade(session, execucaoId);
    if (!execucao.teste) {
      throw new BadRequestException(
        "Apenas execucoes de teste podem ser descartadas",
      );
    }

    await this.database.db.transaction(async (tx: DbTransaction) => {
      await this.historicoService.registrar(
        {
          execucaoId,
          tipo: "EXECUCAO_DESCARTADA",
          descricao: "Execucao de teste descartada",
          autorId: session.userId,
          metadata: {
            titulo: execucao.titulo,
            modeloId: execucao.modeloId,
          },
        },
        tx,
      );

      await tx
        .delete(workflowExecucoes)
        .where(
          and(
            eq(workflowExecucoes.id, execucaoId),
            eq(workflowExecucoes.schoolId, session.schoolId),
            eq(workflowExecucoes.unitId, session.unitId),
          ),
        );
    });

    await Promise.all(
      (execucao.anexos ?? [])
        .filter(
          (anexo): anexo is AnexoExecucao & { storageKey: string } =>
            typeof anexo.storageKey === "string" && anexo.storageKey.length > 0,
        )
        .map((anexo) => this.storageService.deleteFile(anexo.storageKey)),
    );

    return undefined;
  }
}
