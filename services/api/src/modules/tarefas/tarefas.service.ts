import { Injectable } from "@nestjs/common";
import { eq } from "@essencia/db";
import { tarefas, tarefaContextos } from "@essencia/db";
import type {
  Tarefa,
  TarefaPrioridade,
  TarefaTipoOrigem,
  TarefaContextoModulo,
} from "@essencia/shared/types";
import { DatabaseService } from "../../common/database/database.service";

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

    // Inserir tarefa
    const [tarefaCriada] = await db
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
      throw new Error("Falha ao criar tarefa");
    }

    // Inserir contextos se houver
    if (params.contextos.length > 0) {
      for (const contexto of params.contextos) {
        await db.insert(tarefaContextos).values({
          tarefaId: tarefaCriada.id,
          modulo: contexto.modulo,
          quinzenaId: contexto.quinzenaId ?? null,
          etapaId: contexto.etapaId ?? null,
          turmaId: contexto.turmaId ?? null,
          professoraId: contexto.professoraId ?? null,
        });
      }
    }

    return this.mapTarefaToDto(tarefaCriada);
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

    // Buscar tarefa
    const tarefaDb = await db.query.tarefas.findFirst({
      where: eq(tarefas.id, tarefaId),
    });

    if (!tarefaDb) {
      throw new Error("Tarefa não encontrada");
    }

    // Validar que usuário é responsável
    if (tarefaDb.responsavel !== userId) {
      throw new Error("Usuário não é responsável pela tarefa");
    }

    // Validar que tarefa não está concluída
    if (tarefaDb.status === "CONCLUIDA") {
      throw new Error("Tarefa já foi concluída");
    }

    // Atualizar tarefa
    const [tarefaAtualizada] = await db
      .update(tarefas)
      .set({
        status: "CONCLUIDA",
        concluidaEm: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tarefas.id, tarefaId))
      .returning();

    if (!tarefaAtualizada) {
      throw new Error("Falha ao concluir tarefa");
    }

    return this.mapTarefaToDto(tarefaAtualizada);
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
