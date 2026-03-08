import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { eq, and, or, desc, sql } from "@essencia/db";
import {
  tarefas,
  tarefaContextos,
  tarefaHistorico,
  users,
  turmas,
  educationStages,
} from "@essencia/db";
import { TarefaHistoricoService } from "./tarefa-historico.service";
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
import type { AtualizarTarefaDto } from "./dto/tarefas.dto";
import { DatabaseService } from "../../common/database/database.service";
import { validarContextosPorRole } from "./utils/validacoes";

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
    if (session.role === "professora" && dto.responsavel !== session.userId) {
      throw new ForbiddenException(
        "Professoras só podem criar tarefas para si mesmas",
      );
    }

    // Validar que prazo não está no passado (comparação em nível de dia)
    const agoraInicioDoDia = new Date();
    agoraInicioDoDia.setHours(0, 0, 0, 0);
    const prazoInicioDoDia = new Date(dto.prazo);
    prazoInicioDoDia.setHours(0, 0, 0, 0);

    if (prazoInicioDoDia < agoraInicioDoDia) {
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
      etapaId?: string | null;
      turmaId?: string | null;
      professoraId?: string | null;
    }>;
  }): Promise<Tarefa> {
    // Validar que todos os contextos têm módulo definido
    const contextosInvalidos = params.contextos.filter((c) => !c.modulo);
    if (contextosInvalidos.length > 0) {
      throw new BadRequestException(
        "Todos os contextos devem ter um módulo definido",
      );
    }

    return this.create({
      ...params,
      tipoOrigem: "AUTOMATICA",
    });
  }

  /**
   * Cria uma nova tarefa com contextos
   *
   * @param params Parâmetros da tarefa
   * @returns Tarefa criada
   */
  async create(params: {
    schoolId: string;
    unitId: string | null;
    titulo: string;
    descricao: string | null;
    prioridade: TarefaPrioridade;
    prazo: Date;
    criadoPor: string;
    responsavel: string;
    tipoOrigem: TarefaTipoOrigem;
    contextos: Array<{
      modulo: TarefaContextoModulo;
      quinzenaId?: string | null;
      etapaId?: string | null;
      turmaId?: string | null;
      professoraId?: string | null;
    }>;
  }): Promise<Tarefa> {
    const db = this.db.db;

    // Usar transação para garantir atomicidade
    return await db.transaction(async (tx: DbTransaction) => {
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
          etapaId: contexto.etapaId ?? null,
          turmaId: contexto.turmaId ?? null,
          professoraId: contexto.professoraId ?? null,
        }));

        await tx.insert(tarefaContextos).values(contextosValues);
      }

      // Registrar histórico de criação
      await this.historicoService.registrar(tx, {
        tarefaId: tarefaCriada.id,
        userId: params.criadoPor,
        userName: params.tipoOrigem === "AUTOMATICA" ? "Sistema" : "Usuário",
        userRole: params.tipoOrigem === "AUTOMATICA" ? "sistema" : "usuario",
        acao: "CRIADA",
      });

      return this.mapTarefaToDto(tarefaCriada);
    });
  }

  /**
   * Busca tarefa por ID
   *
   * @param id ID da tarefa
   * @returns Tarefa encontrada ou null
   */
  async findById(id: string): Promise<Tarefa | null> {
    const db = this.db.db;

    const tarefaDb = await db.query.tarefas.findFirst({
      where: eq(tarefas.id, id),
    });

    if (!tarefaDb) {
      return null;
    }

    return this.mapTarefaToDto(tarefaDb);
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
      const agoraInicioDoDia = new Date();
      agoraInicioDoDia.setHours(0, 0, 0, 0);
      const prazoInicioDoDia = new Date(dto.prazo);
      prazoInicioDoDia.setHours(0, 0, 0, 0);
      if (prazoInicioDoDia < agoraInicioDoDia) {
        throw new BadRequestException("Prazo não pode estar no passado");
      }
    }

    const setCampos: Partial<typeof tarefas.$inferInsert> = {
      updatedAt: new Date(),
    };

    // Rastrear campos alterados para histórico
    const camposAlterados: Array<{
      campo: string;
      anterior: string;
      novo: string;
    }> = [];

    if (dto.titulo !== undefined && dto.titulo !== tarefaDb.titulo) {
      setCampos.titulo = dto.titulo;
      camposAlterados.push({
        campo: "titulo",
        anterior: tarefaDb.titulo,
        novo: dto.titulo,
      });
    }
    if (dto.descricao !== undefined && dto.descricao !== tarefaDb.descricao) {
      setCampos.descricao = dto.descricao;
      camposAlterados.push({
        campo: "descricao",
        anterior: tarefaDb.descricao ?? "",
        novo: dto.descricao ?? "",
      });
    }
    if (
      dto.prioridade !== undefined &&
      dto.prioridade !== tarefaDb.prioridade
    ) {
      setCampos.prioridade = dto.prioridade;
      camposAlterados.push({
        campo: "prioridade",
        anterior: tarefaDb.prioridade,
        novo: dto.prioridade,
      });
    }
    if (dto.prazo !== undefined) {
      const novoPrazo = new Date(dto.prazo);
      if (novoPrazo.getTime() !== tarefaDb.prazo.getTime()) {
        setCampos.prazo = novoPrazo;
        camposAlterados.push({
          campo: "prazo",
          anterior: tarefaDb.prazo.toISOString(),
          novo: novoPrazo.toISOString(),
        });
      }
    }
    if (
      dto.responsavel !== undefined &&
      dto.responsavel !== tarefaDb.responsavel
    ) {
      setCampos.responsavel = dto.responsavel;
      camposAlterados.push({
        campo: "responsavel",
        anterior: tarefaDb.responsavel,
        novo: dto.responsavel,
      });
    }

    return await db.transaction(async (tx: DbTransaction) => {
      const [tarefaAtualizada] = await tx
        .update(tarefas)
        .set(setCampos)
        .where(eq(tarefas.id, id))
        .returning();

      if (!tarefaAtualizada) {
        throw new ConflictException("Falha ao atualizar tarefa");
      }

      // Registrar histórico para cada campo alterado
      for (const c of camposAlterados) {
        await this.historicoService.registrar(tx, {
          tarefaId: id,
          userId,
          userName: "Usuário",
          userRole: "usuario",
          acao: "EDITADA",
          campoAlterado: c.campo,
          valorAnterior: c.anterior,
          valorNovo: c.novo,
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
  async cancelar(tarefaId: string, userId: string): Promise<Tarefa> {
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
        .where(eq(tarefas.id, tarefaId))
        .returning();

      if (!tarefaAtualizada) {
        throw new ConflictException("Falha ao cancelar tarefa");
      }

      // Registrar histórico
      await this.historicoService.registrar(tx, {
        tarefaId,
        userId,
        userName: "Usuário",
        userRole: "usuario",
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
  async concluir(tarefaId: string, userId: string): Promise<Tarefa> {
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

      // Atualizar tarefa
      const [tarefaAtualizada] = await tx
        .update(tarefas)
        .set({
          status: "CONCLUIDA",
          concluidaEm: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tarefas.id, tarefaId))
        .returning();

      if (!tarefaAtualizada) {
        throw new ConflictException("Falha ao concluir tarefa");
      }

      // Registrar histórico
      await this.historicoService.registrar(tx, {
        tarefaId,
        userId,
        userName: "Usuário",
        userRole: "usuario",
        acao: "CONCLUIDA",
      });

      return this.mapTarefaToDto(tarefaAtualizada);
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
    filtros: {
      status?: "PENDENTE" | "CONCLUIDA" | "CANCELADA";
      prioridade?: "ALTA" | "MEDIA" | "BAIXA";
      modulo?: string;
      quinzenaId?: string;
      tipo?: "criadas" | "atribuidas" | "todas";
      page?: number;
      limit?: number;
    },
  ): Promise<{
    data: Tarefa[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const db = this.db.db;
    const page = filtros.page || 1;
    const limit = Math.min(filtros.limit || 20, 100); // Max 100 por página
    const offset = (page - 1) * limit;

    // Construir condições de filtro
    const conditions: ReturnType<typeof eq>[] = [
      eq(tarefas.schoolId, session.schoolId),
    ];

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

    // Buscar tarefas com paginação
    const tarefasDb: TarefaDb[] = await db
      .select()
      .from(tarefas)
      .where(and(...conditions))
      .orderBy(desc(tarefas.prazo))
      .limit(limit)
      .offset(offset);

    // Contar total (para paginação)
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tarefas)
      .where(and(...conditions));

    const totalPages = Math.ceil(count / limit);

    return {
      data: tarefasDb.map((t) => this.mapTarefaToDto(t)),
      pagination: {
        total: count,
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
  ): Promise<{
    pendentes: number;
    atrasadas: number;
    concluidasHoje: number;
    concluidasSemana: number;
  }> {
    const db = this.db.db;
    const agora = new Date();
    const inicioHoje = new Date(
      agora.getFullYear(),
      agora.getMonth(),
      agora.getDate(),
    );
    const inicioDaSemana = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Query para tarefas pendentes
    const [{ pendentes }] = await db
      .select({ pendentes: sql<number>`count(*)::int` })
      .from(tarefas)
      .where(
        and(
          eq(tarefas.schoolId, schoolId),
          eq(tarefas.responsavel, userId),
          eq(tarefas.status, "PENDENTE"),
        ),
      );

    // Query para tarefas atrasadas (pendentes com prazo < hoje)
    const [{ atrasadas }] = await db
      .select({ atrasadas: sql<number>`count(*)::int` })
      .from(tarefas)
      .where(
        and(
          eq(tarefas.schoolId, schoolId),
          eq(tarefas.responsavel, userId),
          eq(tarefas.status, "PENDENTE"),
          sql`${tarefas.prazo} < ${agora.toISOString()}`,
        ),
      );

    // Query para tarefas concluídas hoje
    const [{ concluidasHoje }] = await db
      .select({ concluidasHoje: sql<number>`count(*)::int` })
      .from(tarefas)
      .where(
        and(
          eq(tarefas.schoolId, schoolId),
          eq(tarefas.responsavel, userId),
          eq(tarefas.status, "CONCLUIDA"),
          sql`${tarefas.concluidaEm} >= ${inicioHoje.toISOString()}`,
        ),
      );

    // Query para tarefas concluídas na última semana
    const [{ concluidasSemana }] = await db
      .select({ concluidasSemana: sql<number>`count(*)::int` })
      .from(tarefas)
      .where(
        and(
          eq(tarefas.schoolId, schoolId),
          eq(tarefas.responsavel, userId),
          eq(tarefas.status, "CONCLUIDA"),
          sql`${tarefas.concluidaEm} >= ${inicioDaSemana.toISOString()}`,
        ),
      );

    return {
      pendentes,
      atrasadas,
      concluidasHoje,
      concluidasSemana,
    };
  }

  /**
   * Retorna histórico de ações de uma tarefa
   */
  async getHistorico(tarefaId: string) {
    const db = this.db.db;
    return await db.query.tarefaHistorico.findMany({
      where: eq(tarefaHistorico.tarefaId, tarefaId),
      orderBy: [desc(tarefaHistorico.createdAt)],
    });
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
