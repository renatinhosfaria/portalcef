import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import {
  eq,
  and,
  or,
  asc,
  desc,
  gte,
  lte,
  inArray,
  isNull,
  sql,
} from "@essencia/db";
import {
  tarefas,
  tarefaContextos,
  tarefaHistorico,
  users,
  turmas,
  educationStages,
} from "@essencia/db";
import type {
  Tarefa,
  TarefaEnriquecida,
  TarefaContextoEnriquecido,
  TarefaPrioridade,
  TarefaTipoOrigem,
  TarefaContextoModulo,
} from "@essencia/shared/types";

type ContextoComRelacoes = typeof tarefaContextos.$inferSelect & {
  turma: typeof turmas.$inferSelect | null;
  etapa: typeof educationStages.$inferSelect | null;
  professora: typeof users.$inferSelect | null;
};
import type { AtualizarTarefaDto, ListarTarefasDto } from "./dto/tarefas.dto";
import { DatabaseService } from "../../common/database/database.service";
import { validarContextosPorRole } from "./utils/validacoes";
import { TarefaHistoricoService } from "./tarefa-historico.service";
import {
  normalizarEstatisticasTarefas,
  type EstatisticasTarefas,
} from "./tarefas-stats";

/**
 * Tipos auxiliares para transações do Drizzle
 */
type Db = ReturnType<DatabaseService["db"]["db"]>;
type DbTransaction = Parameters<Db["transaction"]>[0] extends (
  tx: infer T,
) => Promise<unknown>
  ? T
  : never;
type TarefaDb = typeof tarefas.$inferSelect;
type TarefaContextoEntrada = {
  modulo: TarefaContextoModulo;
  quinzenaId?: string | null;
  planoId?: string | null;
  provaId?: string | null;
  etapaId?: string | null;
  turmaId?: string | null;
  professoraId?: string | null;
};
type CriarTarefaParams = {
  schoolId: string;
  unitId: string | null;
  titulo: string;
  descricao: string | null;
  prioridade: TarefaPrioridade;
  prazo: Date;
  criadoPor: string;
  responsavel: string;
  tipoOrigem: TarefaTipoOrigem;
  contextos: TarefaContextoEntrada[];
  session?: { userId: string; role: string };
};

/**
 * Interface de contexto do usuário (da sessão)
 */
export interface UserContext {
  userId: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
  stageId: string | null;
}

/**
 * TarefasService
 *
 * Service responsável pelo gerenciamento de tarefas:
 * - CRUD de tarefas manuais e automáticas
 * - Filtros avançados com contextos estruturados
 * - Validações de permissões e acesso
 * - Integração com workflow via eventos
 */
@Injectable()
export class TarefasService {
  constructor(
    private readonly db: DatabaseService,
    private readonly historicoService: TarefaHistoricoService,
  ) {}

  /**
   * Cria tarefa manual com validações de role e permissões
   *
   * @param dto Dados da tarefa
   * @param session Contexto do usuário da sessão
   * @returns Tarefa criada
   */
  async criarManual(
    dto: {
      titulo: string;
      descricao: string | null;
      prioridade: TarefaPrioridade;
      prazo: Date;
      responsavel: string;
      contextos: Array<{
        modulo: TarefaContextoModulo;
        quinzenaId?: string | null;
        planoId?: string | null;
        provaId?: string | null;
        etapaId?: string | null;
        turmaId?: string | null;
        professoraId?: string | null;
      }>;
    },
    session: UserContext,
  ): Promise<Tarefa> {
    // Validar que schoolId e unitId existem na sessão
    if (!session.schoolId || !session.unitId) {
      throw new BadRequestException(
        "Sessão inválida: schoolId e unitId são obrigatórios",
      );
    }

    // Validar contextos baseados na role
    validarContextosPorRole(session.role, dto.contextos);

    // Validar que professora só pode criar tarefas para ela mesma
    if (
      (session.role === "professora" || session.role === "auxiliar_sala") &&
      dto.responsavel !== session.userId
    ) {
      throw new ForbiddenException(
        "Professoras só podem criar tarefas para si mesmas",
      );
    }

    // O prazo representa um instante, inclusive quando a tarefa é criada no mesmo dia.
    if (dto.prazo.getTime() < Date.now()) {
      throw new BadRequestException("Prazo não pode estar no passado");
    }

    // Criar tarefa usando método base
    return this.create({
      schoolId: session.schoolId,
      unitId: session.unitId,
      titulo: dto.titulo,
      descricao: dto.descricao,
      prioridade: dto.prioridade,
      prazo: dto.prazo,
      criadoPor: session.userId,
      responsavel: dto.responsavel,
      tipoOrigem: "MANUAL",
      contextos: dto.contextos,
      session: { userId: session.userId, role: session.role },
    });
  }

  /**
   * Cria tarefa automática (sem validações de role)
   *
   * Usado por eventos do sistema (ex: planejamento reprovado)
   *
   * @param params Parâmetros da tarefa
   * @returns Tarefa criada
   */
  async criarAutomatica(params: {
    schoolId: string;
    unitId: string | null;
    titulo: string;
    descricao: string | null;
    prioridade: TarefaPrioridade;
    prazo: Date;
    criadoPor: string;
    responsavel: string;
    contextos: Array<{
      modulo: TarefaContextoModulo;
      quinzenaId?: string | null;
      planoId?: string | null;
      provaId?: string | null;
      etapaId?: string | null;
      turmaId?: string | null;
      professoraId?: string | null;
    }>;
    chaveIdempotencia?: string;
  }): Promise<Tarefa> {
    // Validar que todos os contextos têm módulo definido
    const contextosInvalidos = params.contextos.filter((c) => !c.modulo);
    if (contextosInvalidos.length > 0) {
      throw new BadRequestException(
        "Todos os contextos devem ter um módulo definido",
      );
    }

    return this.db.db.transaction(async (tx: DbTransaction) => {
      // Serializa o par evento/plano durante a transação. Assim duas entregas
      // simultâneas não passam pela mesma verificação de tarefa pendente.
      if (params.chaveIdempotencia) {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${params.chaveIdempotencia}))`,
        );
      }

      const tarefasPendentes = await tx.query.tarefas.findMany({
        where: and(
          eq(tarefas.schoolId, params.schoolId),
          params.unitId
            ? eq(tarefas.unitId, params.unitId)
            : isNull(tarefas.unitId),
          eq(tarefas.responsavel, params.responsavel),
          eq(tarefas.titulo, params.titulo),
          eq(tarefas.status, "PENDENTE"),
          eq(tarefas.tipoOrigem, "AUTOMATICA"),
        ),
        with: { contextos: true },
      });

      const contextoIgual = (
        atual: (typeof params.contextos)[number],
        existente: typeof tarefaContextos.$inferSelect,
      ) =>
        atual.modulo === existente.modulo &&
        (atual.quinzenaId ?? null) === existente.quinzenaId &&
        (atual.planoId ?? null) === existente.planoId &&
        (atual.provaId ?? null) === existente.provaId &&
        (atual.etapaId ?? null) === existente.etapaId &&
        (atual.turmaId ?? null) === existente.turmaId &&
        (atual.professoraId ?? null) === existente.professoraId;

      const tarefaExistente = (
        tarefasPendentes as Array<
          TarefaDb & { contextos: Array<typeof tarefaContextos.$inferSelect> }
        >
      ).find(
        (tarefa) =>
          tarefa.contextos.length === params.contextos.length &&
          params.contextos.every((contexto) =>
            tarefa.contextos.some(
              (existente: typeof tarefaContextos.$inferSelect) =>
                contextoIgual(contexto, existente),
            ),
          ),
      );

      if (tarefaExistente) {
        return this.mapTarefaToDto(tarefaExistente);
      }

      return this.criarDentroDaTransacao(tx, {
        ...params,
        tipoOrigem: "AUTOMATICA",
      });
    });
  }

  /**
   * Cria uma nova tarefa com contextos
   *
   * @param params Parâmetros da tarefa
   * @returns Tarefa criada
   */
  async create(params: CriarTarefaParams): Promise<Tarefa> {
    return this.db.db.transaction((tx: DbTransaction) =>
      this.criarDentroDaTransacao(tx, params),
    );
  }

  private async criarDentroDaTransacao(
    tx: DbTransaction,
    params: CriarTarefaParams,
  ): Promise<Tarefa> {
    // Inserir tarefa
    const [tarefaCriada] = await tx
      .insert(tarefas)
      .values({
        schoolId: params.schoolId,
        unitId: params.unitId,
        titulo: params.titulo,
        descricao: params.descricao,
        prioridade: params.prioridade,
        prazo: params.prazo,
        criadoPor: params.criadoPor,
        responsavel: params.responsavel,
        tipoOrigem: params.tipoOrigem,
        status: "PENDENTE",
      })
      .returning();

    if (!tarefaCriada) {
      throw new ConflictException("Falha ao criar tarefa");
    }

    // Inserir contextos em bulk se houver
    if (params.contextos.length > 0) {
      const contextosValues = params.contextos.map((contexto) => ({
        tarefaId: tarefaCriada.id,
        modulo: contexto.modulo,
        quinzenaId: contexto.quinzenaId ?? null,
        planoId: contexto.planoId ?? null,
        provaId: contexto.provaId ?? null,
        etapaId: contexto.etapaId ?? null,
        turmaId: contexto.turmaId ?? null,
        professoraId: contexto.professoraId ?? null,
      }));

      await tx.insert(tarefaContextos).values(contextosValues);
    }

    // Registrar historico de criacao
    if (params.session) {
      const userName = await this.getUserName(params.session.userId);
      await this.historicoService.registrar(tx, {
        tarefaId: tarefaCriada.id,
        userId: params.session.userId,
        userName,
        userRole: params.session.role,
        acao: "CRIADA",
      });
    }

    return this.mapTarefaToDto(tarefaCriada);
  }

  /**
   * Busca tarefa por ID
   *
   * @param id ID da tarefa
   * @returns Tarefa encontrada ou null
   */
  async findById(id: string): Promise<TarefaEnriquecida | null> {
    const db = this.db.db;

    const tarefaDb = await db.query.tarefas.findFirst({
      where: eq(tarefas.id, id),
    });

    if (!tarefaDb) {
      return null;
    }

    const userIds = [...new Set([tarefaDb.criadoPor, tarefaDb.responsavel])];
    const usersData = (await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, userIds))) as { id: string; name: string }[];
    const userMap = new Map<string, string>(
      usersData.map((u) => [u.id, u.name]),
    );

    return {
      ...this.mapTarefaToDto(tarefaDb),
      criadoPorNome: userMap.get(tarefaDb.criadoPor) ?? "",
      responsavelNome: userMap.get(tarefaDb.responsavel) ?? "",
      contextos: [],
    };
  }

  /**
   * Busca tarefa por ID com dados enriquecidos (nomes, contextos, turma/etapa/professora)
   *
   * @param id ID da tarefa
   * @returns TarefaEnriquecida ou null
   */
  async findByIdEnriquecido(id: string): Promise<TarefaEnriquecida | null> {
    const db = this.db.db;

    const tarefaDb = await db.query.tarefas.findFirst({
      where: eq(tarefas.id, id),
      with: {
        criadoPorUser: true,
        responsavelUser: true,
        contextos: {
          with: {
            turma: true,
            etapa: true,
            professora: true,
          },
        },
      },
    });

    if (!tarefaDb) {
      return null;
    }

    const contextosMapeados: TarefaContextoEnriquecido[] = (
      tarefaDb.contextos as ContextoComRelacoes[]
    ).map((c) => ({
      id: c.id,
      tarefaId: c.tarefaId,
      modulo: c.modulo as TarefaContextoEnriquecido["modulo"],
      quinzenaId: c.quinzenaId ?? null,
      planoId: c.planoId ?? null,
      provaId: c.provaId ?? null,
      etapaId: c.etapaId ?? null,
      turmaId: c.turmaId ?? null,
      professoraId: c.professoraId ?? null,
      turmaName: c.turma?.name ?? undefined,
      etapaName: c.etapa?.name ?? undefined,
      professoraName: c.professora?.name ?? undefined,
    }));

    return {
      ...this.mapTarefaToDto(tarefaDb),
      criadoPorNome: tarefaDb.criadoPorUser.name,
      responsavelNome: tarefaDb.responsavelUser.name,
      contextos: contextosMapeados,
    };
  }

  /**
   * Atualiza campos de uma tarefa existente
   *
   * @param id ID da tarefa
   * @param dto Campos a atualizar (parcial)
   * @returns Tarefa atualizada
   */
  async atualizar(
    id: string,
    dto: AtualizarTarefaDto,
    userId: string,
    userRole: string,
  ): Promise<Tarefa> {
    const db = this.db.db;

    const tarefaDb = await db.query.tarefas.findFirst({
      where: eq(tarefas.id, id),
    });

    if (!tarefaDb) {
      throw new NotFoundException("Tarefa não encontrada");
    }

    if (tarefaDb.criadoPor !== userId && tarefaDb.responsavel !== userId) {
      throw new ForbiddenException(
        "Somente o criador ou responsável pode editar esta tarefa",
      );
    }

    if (tarefaDb.status === "CONCLUIDA" || tarefaDb.status === "CANCELADA") {
      throw new ConflictException(
        "Tarefa concluída ou cancelada não pode ser editada",
      );
    }

    if (dto.responsavel) {
      const responsavelDb = await db.query.users.findFirst({
        where: eq(users.id, dto.responsavel),
      });
      if (!responsavelDb) {
        throw new NotFoundException("Responsável não encontrado");
      }
    }

    if (dto.prazo) {
      if (new Date(dto.prazo).getTime() < Date.now()) {
        throw new BadRequestException("Prazo não pode estar no passado");
      }
    }

    const setCampos: Partial<typeof tarefas.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (dto.titulo !== undefined) setCampos.titulo = dto.titulo;
    if (dto.descricao !== undefined) setCampos.descricao = dto.descricao;
    if (dto.prioridade !== undefined) setCampos.prioridade = dto.prioridade;
    if (dto.prazo !== undefined) setCampos.prazo = new Date(dto.prazo);
    if (dto.responsavel !== undefined) setCampos.responsavel = dto.responsavel;

    return await db.transaction(async (tx: DbTransaction) => {
      const [tarefaAtualizada] = await tx
        .update(tarefas)
        .set(setCampos)
        .where(and(eq(tarefas.id, id), eq(tarefas.status, "PENDENTE")))
        .returning();

      if (!tarefaAtualizada) {
        throw new ConflictException("Falha ao atualizar tarefa");
      }

      // Registrar historico para cada campo alterado
      const userName = await this.getUserName(userId);
      const campos: Array<{ campo: string; anterior: string; novo: string }> =
        [];

      if (dto.titulo !== undefined && dto.titulo !== tarefaDb.titulo) {
        campos.push({
          campo: "titulo",
          anterior: tarefaDb.titulo,
          novo: dto.titulo,
        });
      }
      if (
        dto.descricao !== undefined &&
        (dto.descricao || "") !== (tarefaDb.descricao || "")
      ) {
        campos.push({
          campo: "descricao",
          anterior: tarefaDb.descricao || "",
          novo: dto.descricao || "",
        });
      }
      if (
        dto.prioridade !== undefined &&
        dto.prioridade !== tarefaDb.prioridade
      ) {
        campos.push({
          campo: "prioridade",
          anterior: tarefaDb.prioridade,
          novo: dto.prioridade,
        });
      }
      if (
        dto.prazo !== undefined &&
        dto.prazo !== tarefaDb.prazo.toISOString()
      ) {
        campos.push({
          campo: "prazo",
          anterior: tarefaDb.prazo.toISOString(),
          novo: dto.prazo,
        });
      }
      if (
        dto.responsavel !== undefined &&
        dto.responsavel !== tarefaDb.responsavel
      ) {
        campos.push({
          campo: "responsavel",
          anterior: tarefaDb.responsavel,
          novo: dto.responsavel,
        });
      }

      for (const campo of campos) {
        await this.historicoService.registrar(tx, {
          tarefaId: id,
          userId,
          userName,
          userRole,
          acao: "EDITADA",
          campoAlterado: campo.campo,
          valorAnterior: campo.anterior,
          valorNovo: campo.novo,
        });
      }

      return this.mapTarefaToDto(tarefaAtualizada);
    });
  }

  /**
   * Cancela uma tarefa
   *
   * @param tarefaId ID da tarefa
   * @returns Tarefa cancelada
   */
  async cancelar(
    tarefaId: string,
    userId: string,
    userRole: string,
  ): Promise<Tarefa> {
    const db = this.db.db;

    const tarefaDb = await db.query.tarefas.findFirst({
      where: eq(tarefas.id, tarefaId),
    });

    if (!tarefaDb) {
      throw new NotFoundException("Tarefa não encontrada");
    }

    if (tarefaDb.criadoPor !== userId && tarefaDb.responsavel !== userId) {
      throw new ForbiddenException(
        "Somente o criador ou responsável pode cancelar esta tarefa",
      );
    }

    if (tarefaDb.status === "CONCLUIDA" || tarefaDb.status === "CANCELADA") {
      throw new ConflictException("Tarefa já foi concluída ou cancelada");
    }

    return await db.transaction(async (tx: DbTransaction) => {
      const [tarefaAtualizada] = await tx
        .update(tarefas)
        .set({ status: "CANCELADA", updatedAt: new Date() })
        .where(and(eq(tarefas.id, tarefaId), eq(tarefas.status, "PENDENTE")))
        .returning();

      if (!tarefaAtualizada) {
        throw new ConflictException("Falha ao cancelar tarefa");
      }

      // Registrar historico de cancelamento
      const userName = await this.getUserName(userId);
      await this.historicoService.registrar(tx, {
        tarefaId,
        userId,
        userName,
        userRole,
        acao: "CANCELADA",
      });

      return this.mapTarefaToDto(tarefaAtualizada);
    });
  }

  /**
   * Conclui uma tarefa
   *
   * @param tarefaId ID da tarefa
   * @param userId ID do usuário que está concluindo
   * @returns Tarefa atualizada
   */
  async concluir(
    tarefaId: string,
    userId: string,
    userRole: string,
  ): Promise<Tarefa> {
    const db = this.db.db;

    // Usar transação para evitar race conditions
    return await db.transaction(async (tx: DbTransaction) => {
      // Buscar tarefa
      const tarefaDb = await tx.query.tarefas.findFirst({
        where: eq(tarefas.id, tarefaId),
      });

      if (!tarefaDb) {
        throw new NotFoundException("Tarefa não encontrada");
      }

      // Validar que usuário é responsável
      if (tarefaDb.responsavel !== userId) {
        throw new ForbiddenException("Usuário não é responsável pela tarefa");
      }

      // Validar que tarefa não está concluída
      if (tarefaDb.status === "CONCLUIDA") {
        throw new ConflictException("Tarefa já foi concluída");
      }

      if (tarefaDb.status === "CANCELADA") {
        throw new ConflictException("Tarefa já foi cancelada");
      }

      // Atualizar tarefa
      const [tarefaAtualizada] = await tx
        .update(tarefas)
        .set({
          status: "CONCLUIDA",
          concluidaEm: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(tarefas.id, tarefaId), eq(tarefas.status, "PENDENTE")))
        .returning();

      if (!tarefaAtualizada) {
        throw new ConflictException("Falha ao concluir tarefa");
      }

      // Registrar historico de conclusao
      const userName = await this.getUserName(userId);
      await this.historicoService.registrar(tx, {
        tarefaId,
        userId,
        userName,
        userRole,
        acao: "CONCLUIDA",
      });

      return this.mapTarefaToDto(tarefaAtualizada);
    });
  }

  async concluirPorContexto(params: {
    planoId: string;
    quinzenaId: string;
    professoraId: string;
    turmaId: string;
    etapaId: string;
    schoolId: string;
    unitId: string;
    usuarioId: string;
    titulo: string;
  }): Promise<Tarefa | null> {
    const tarefasAutomaticas = await this.db.db.query.tarefas.findMany({
      where: and(
        eq(tarefas.schoolId, params.schoolId),
        eq(tarefas.unitId, params.unitId),
        eq(tarefas.tipoOrigem, "AUTOMATICA"),
        eq(tarefas.titulo, params.titulo),
        eq(tarefas.status, "PENDENTE"),
      ),
      with: { contextos: true },
    });

    const tarefa = (
      tarefasAutomaticas as Array<
        TarefaDb & { contextos: Array<typeof tarefaContextos.$inferSelect> }
      >
    ).find(
      (candidata) =>
        candidata.tipoOrigem === "AUTOMATICA" &&
        candidata.titulo === params.titulo &&
        candidata.contextos.some(
          (contexto: typeof tarefaContextos.$inferSelect) =>
            contexto.modulo === "PLANEJAMENTO" &&
            contexto.planoId === params.planoId &&
            contexto.quinzenaId === params.quinzenaId &&
            contexto.professoraId === params.professoraId &&
            contexto.turmaId === params.turmaId &&
            contexto.etapaId === params.etapaId,
        ),
    );

    if (!tarefa) return null;

    const usuario = await this.db.db.query.users.findFirst({
      where: eq(users.id, params.usuarioId),
      columns: { role: true, name: true },
    });
    if (!usuario)
      throw new NotFoundException("Usuário do evento não encontrado");

    return this.db.db.transaction(async (tx: DbTransaction) => {
      const [atualizada] = await tx
        .update(tarefas)
        .set({
          status: "CONCLUIDA",
          concluidaEm: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(tarefas.id, tarefa.id), eq(tarefas.status, "PENDENTE")))
        .returning();

      // Outra entrega pode ter encerrado a mesma tarefa enquanto o evento era processado.
      if (!atualizada) return null;
      await this.historicoService.registrar(tx, {
        tarefaId: tarefa.id,
        userId: params.usuarioId,
        userName: usuario.name,
        userRole: usuario.role,
        acao: "CONCLUIDA",
      });
      return this.mapTarefaToDto(atualizada);
    });
  }

  /**
   * Lista tarefas com filtros e paginação
   *
   * @param session Contexto do usuário
   * @param filtros Filtros de busca
   * @returns Lista paginada de tarefas
   */
  async listar(
    session: UserContext,
    filtros: ListarTarefasDto,
  ): Promise<{
    data: TarefaEnriquecida[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const db = this.db.db;
    if (!session.schoolId) {
      throw new BadRequestException("Sessão inválida: schoolId é obrigatório");
    }
    const page = filtros.page ?? 1;
    const limit = Math.min(filtros.limit ?? 20, 100); // Max 100 por página
    const offset = (page - 1) * limit;

    // Construir condições de filtro
    const conditions: Array<ReturnType<typeof eq>> = [];

    conditions.push(eq(tarefas.schoolId, session.schoolId));

    // Filtro por tipo (criadas/atribuidas/todas)
    if (filtros.tipo === "criadas") {
      conditions.push(eq(tarefas.criadoPor, session.userId));
    } else if (filtros.tipo === "atribuidas") {
      conditions.push(eq(tarefas.responsavel, session.userId));
    } else {
      // "todas" - criadas OU atribuidas
      const todasCondicoes = or(
        eq(tarefas.criadoPor, session.userId),
        eq(tarefas.responsavel, session.userId),
      );
      if (todasCondicoes) {
        conditions.push(todasCondicoes);
      }
    }

    // Filtro por status
    if (filtros.status) {
      conditions.push(eq(tarefas.status, filtros.status));
    }

    // Filtro por prioridade
    if (filtros.prioridade) {
      conditions.push(eq(tarefas.prioridade, filtros.prioridade));
    }

    if (filtros.responsavel) {
      conditions.push(eq(tarefas.responsavel, filtros.responsavel));
    }

    if (filtros.criadoPor) {
      conditions.push(eq(tarefas.criadoPor, filtros.criadoPor));
    }

    if (filtros.prazoInicio) {
      conditions.push(gte(tarefas.prazo, new Date(filtros.prazoInicio)));
    }

    if (filtros.prazoFim) {
      conditions.push(lte(tarefas.prazo, new Date(filtros.prazoFim)));
    }

    const filtrosContexto = [
      filtros.modulo ? sql`tc.modulo = ${filtros.modulo}` : undefined,
      filtros.quinzenaId
        ? sql`tc.quinzena_id = ${filtros.quinzenaId}`
        : undefined,
      filtros.planoId ? sql`tc.plano_id = ${filtros.planoId}` : undefined,
      filtros.provaId ? sql`tc.prova_id = ${filtros.provaId}` : undefined,
      filtros.etapaId ? sql`tc.etapa_id = ${filtros.etapaId}` : undefined,
      filtros.turmaId ? sql`tc.turma_id = ${filtros.turmaId}` : undefined,
    ].filter((filtro): filtro is ReturnType<typeof sql> => Boolean(filtro));

    if (filtrosContexto.length > 0) {
      conditions.push(
        sql`EXISTS (
        SELECT 1
        FROM tarefa_contextos tc
        WHERE tc.tarefa_id = ${tarefas.id}
          AND ${sql.join(filtrosContexto, sql` AND `)}
      )` as ReturnType<typeof eq>,
      );
    }

    const colunaOrdenacao =
      filtros.orderBy === "prioridade"
        ? sql<number>`CASE ${tarefas.prioridade}
            WHEN 'ALTA' THEN 1
            WHEN 'MEDIA' THEN 2
            WHEN 'BAIXA' THEN 3
            ELSE 4
          END`
        : {
            prazo: tarefas.prazo,
            createdAt: tarefas.createdAt,
            updatedAt: tarefas.updatedAt,
          }[filtros.orderBy ?? "prazo"];
    const ordenar = filtros.orderDir === "desc" ? desc : asc;

    // Buscar tarefas com paginação
    const tarefasDb: TarefaDb[] = await db
      .select()
      .from(tarefas)
      .where(and(...conditions))
      .orderBy(ordenar(colunaOrdenacao), asc(tarefas.id))
      .limit(limit)
      .offset(offset);

    // Contar total (para paginação)
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tarefas)
      .where(and(...conditions));

    // Buscar nomes dos usuários em lote
    const userIds = [
      ...new Set(tarefasDb.flatMap((t) => [t.criadoPor, t.responsavel])),
    ];
    const usersData: { id: string; name: string }[] =
      userIds.length > 0
        ? ((await db
            .select({ id: users.id, name: users.name })
            .from(users)
            .where(inArray(users.id, userIds))) as {
            id: string;
            name: string;
          }[])
        : [];
    const userMap = new Map<string, string>(
      usersData.map((u) => [u.id, u.name]),
    );

    const contextosPorTarefa = new Map<string, TarefaContextoEnriquecido[]>();
    const tarefaIds = tarefasDb.map((tarefa) => tarefa.id);
    if (tarefaIds.length > 0) {
      const contextos = await db
        .select()
        .from(tarefaContextos)
        .where(inArray(tarefaContextos.tarefaId, tarefaIds));

      for (const contexto of contextos) {
        const lista = contextosPorTarefa.get(contexto.tarefaId) ?? [];
        lista.push({
          id: contexto.id,
          tarefaId: contexto.tarefaId,
          modulo: contexto.modulo as TarefaContextoEnriquecido["modulo"],
          quinzenaId: contexto.quinzenaId ?? null,
          planoId: contexto.planoId ?? null,
          provaId: contexto.provaId ?? null,
          etapaId: contexto.etapaId ?? null,
          turmaId: contexto.turmaId ?? null,
          professoraId: contexto.professoraId ?? null,
        });
        contextosPorTarefa.set(contexto.tarefaId, lista);
      }
    }

    const totalPages = Math.ceil(count / limit);

    return {
      data: tarefasDb.map((t) => ({
        ...this.mapTarefaToDto(t),
        criadoPorNome: userMap.get(t.criadoPor) ?? "",
        responsavelNome: userMap.get(t.responsavel) ?? "",
        contextos: contextosPorTarefa.get(t.id) ?? [],
      })),
      pagination: {
        total: Number(count),
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Retorna estatísticas de tarefas do usuário
   *
   * @param userId ID do usuário
   * @param schoolId ID da escola (isolamento de tenant)
   * @returns Estatísticas de tarefas
   */
  async getStats(
    userId: string,
    schoolId: string,
  ): Promise<EstatisticasTarefas> {
    const db = this.db.db;
    const agora = new Date();
    const limiteProximoVencimento = new Date(
      agora.getTime() + 3 * 24 * 60 * 60 * 1000,
    );

    const [valores] = await db
      .select({
        total: sql<number>`count(*)::int`,
        pendentes: sql<number>`count(*) FILTER (WHERE ${tarefas.status} = 'PENDENTE')::int`,
        concluidas: sql<number>`count(*) FILTER (WHERE ${tarefas.status} = 'CONCLUIDA')::int`,
        canceladas: sql<number>`count(*) FILTER (WHERE ${tarefas.status} = 'CANCELADA')::int`,
        atrasadas: sql<number>`count(*) FILTER (WHERE ${tarefas.status} = 'PENDENTE' AND ${tarefas.prazo} < ${agora})::int`,
        proximasVencer: sql<number>`count(*) FILTER (WHERE ${tarefas.status} = 'PENDENTE' AND ${tarefas.prazo} >= ${agora} AND ${tarefas.prazo} <= ${limiteProximoVencimento})::int`,
      })
      .from(tarefas)
      .where(
        and(eq(tarefas.schoolId, schoolId), eq(tarefas.responsavel, userId)),
      );

    return normalizarEstatisticasTarefas(valores ?? {});
  }

  /**
   * Busca historico de acoes de uma tarefa
   *
   * @param tarefaId ID da tarefa
   * @returns Lista de entradas do historico ordenadas por data
   */
  async buscarHistorico(tarefaId: string) {
    const db = this.db.db;
    return db
      .select()
      .from(tarefaHistorico)
      .where(eq(tarefaHistorico.tarefaId, tarefaId))
      .orderBy(desc(tarefaHistorico.createdAt));
  }

  /**
   * Busca nome do usuario por ID
   */
  private async getUserName(userId: string): Promise<string> {
    const db = this.db.db;
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    return user?.name || "Usuario Desconhecido";
  }

  /**
   * Mapeia tarefa do banco para DTO
   *
   * @param tarefa Tarefa do banco
   * @returns Tarefa formatada (com ISO strings)
   */
  private mapTarefaToDto(tarefa: TarefaDb): Tarefa {
    return {
      id: tarefa.id,
      schoolId: tarefa.schoolId,
      unitId: tarefa.unitId,
      titulo: tarefa.titulo,
      descricao: tarefa.descricao,
      status: tarefa.status as Tarefa["status"],
      prioridade: tarefa.prioridade as Tarefa["prioridade"],
      prazo: tarefa.prazo.toISOString(),
      criadoPor: tarefa.criadoPor,
      responsavel: tarefa.responsavel,
      tipoOrigem: tarefa.tipoOrigem as Tarefa["tipoOrigem"],
      createdAt: tarefa.createdAt.toISOString(),
      updatedAt: tarefa.updatedAt.toISOString(),
      concluidaEm: tarefa.concluidaEm ? tarefa.concluidaEm.toISOString() : null,
    };
  }
}
