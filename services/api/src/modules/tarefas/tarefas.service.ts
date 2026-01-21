import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { eq } from "@essencia/db";
import { tarefas, tarefaContextos } from "@essencia/db";
import type {
  Tarefa,
  TarefaPrioridade,
  TarefaTipoOrigem,
  TarefaContextoModulo,
} from "@essencia/shared/types";
import { DatabaseService } from "../../common/database/database.service";
import {
  validarContextosPorRole,
  calcularPrioridadeAutomatica,
} from "./utils/validacoes";

/**
 * Tipos auxiliares para transações do Drizzle
 */
type Db = ReturnType<DatabaseService["db"]["db"]>;
type DbTransaction = Parameters<Db["transaction"]>[0] extends (
  tx: infer T,
) => Promise<unknown>
  ? T
  : never;

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
  constructor(private readonly db: DatabaseService) {}

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

    // Validar que prazo não está no passado
    const agora = new Date();
    if (dto.prazo < agora) {
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
        throw new ForbiddenException(
          "Usuário não é responsável pela tarefa",
        );
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

      return this.mapTarefaToDto(tarefaAtualizada);
    });
  }

  /**
   * Mapeia tarefa do banco para DTO
   *
   * @param tarefa Tarefa do banco
   * @returns Tarefa formatada (com ISO strings)
   */
  private mapTarefaToDto(tarefa: {
    id: string;
    schoolId: string;
    unitId: string | null;
    titulo: string;
    descricao: string | null;
    status: string;
    prioridade: string;
    prazo: Date;
    criadoPor: string;
    responsavel: string;
    tipoOrigem: string;
    createdAt: Date;
    updatedAt: Date;
    concluidaEm: Date | null;
  }): Tarefa {
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
