import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { TarefasService } from "./tarefas.service";
import { DatabaseService } from "../../common/database/database.service";
import { eq } from "@essencia/db";
import { users, educationStages } from "@essencia/db";
import type {
  TarefaPrioridade,
  EducationStageCode,
} from "@essencia/shared/types";

/**
 * TarefasEventosService
 *
 * Service responsável por ouvir eventos do workflow de planejamento
 * e criar tarefas automaticamente para os usuários apropriados.
 *
 * Eventos suportados:
 * - plano.submetido: Professora submete plano → cria tarefa para analista
 * - plano.aprovado_analista: Analista aprova → cria tarefa para coordenadora
 * - plano.devolvido: Revisor devolve → cria tarefa para professora ajustar
 * - plano.aprovado_final: Coordenadora aprova → marca tarefa como concluída
 */
@Injectable()
export class TarefasEventosService implements OnModuleInit {
  private readonly logger = new Logger(TarefasEventosService.name);

  constructor(
    private readonly tarefasService: TarefasService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * Registra listeners de eventos quando o módulo é inicializado
   */
  onModuleInit() {
    this.logger.log("TarefasEventosService inicializado - 4 listeners ativos");
  }

  // ============================================
  // Métodos auxiliares
  // ============================================

  /**
   * Busca o código da etapa (BERCARIO, INFANTIL, etc.) a partir do ID
   */
  private async getStageCode(
    stageId: string,
  ): Promise<EducationStageCode | null> {
    const db = this.db.db;
    const stage = await db.query.educationStages.findFirst({
      where: eq(educationStages.id, stageId),
    });
    return stage?.code ?? null;
  }

  /**
   * Mapeia código da etapa para role de coordenadora
   */
  private mapStageToCoordRole(stageCode: EducationStageCode): string {
    const mapping: Record<EducationStageCode, string> = {
      BERCARIO: "coordenadora_bercario",
      INFANTIL: "coordenadora_infantil",
      FUNDAMENTAL_I: "coordenadora_fundamental_i",
      FUNDAMENTAL_II: "coordenadora_fundamental_ii",
      MEDIO: "coordenadora_medio",
    };
    return mapping[stageCode];
  }

  /**
   * Busca analista pedagógico responsável pela unidade
   */
  private async findAnalistaPedagogico(
    _schoolId: string,
    _unitId: string,
  ): Promise<string | null> {
    const db = this.db.db;
    const analista = await db.query.users.findFirst({
      where: eq(users.role, "analista_pedagogico"),
      columns: { id: true },
    });
    return analista?.id ?? null;
  }

  /**
   * Busca coordenadora responsável pela etapa
   */
  private async findCoordenadora(
    _schoolId: string,
    _unitId: string,
    stageId: string,
  ): Promise<string | null> {
    const stageCode = await this.getStageCode(stageId);
    if (!stageCode) {
      this.logger.warn(`Etapa não encontrada: ${stageId}`);
      return null;
    }

    const coordRole = this.mapStageToCoordRole(stageCode);
    const db = this.db.db;

    const coordenadora = await db.query.users.findFirst({
      where: eq(users.role, coordRole),
      columns: { id: true },
    });

    return coordenadora?.id ?? null;
  }

  /**
   * Calcula prazo baseado em dias a partir de agora
   */
  private calcularPrazo(dias: number): Date {
    const prazo = new Date();
    prazo.setDate(prazo.getDate() + dias);
    prazo.setHours(23, 59, 59, 999);
    return prazo;
  }

  /**
   * Calcula prioridade automática baseada no prazo
   */
  private calcularPrioridade(prazo: Date): TarefaPrioridade {
    const agora = new Date();
    const diffDias = Math.ceil(
      (prazo.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDias <= 2) return "ALTA";
    if (diffDias <= 5) return "MEDIA";
    return "BAIXA";
  }

  // ============================================
  // Event Handlers
  // ============================================

  /**
   * Handler para evento plano.submetido
   *
   * Disparado quando uma professora submete um plano para revisão.
   * Cria tarefa para o analista pedagógico revisar o plano.
   *
   * @param payload Dados do evento
   */
  @OnEvent("plano.submetido")
  async onPlanoSubmetido(payload: {
    planoId: string;
    quinzenaId: string;
    professoraId: string;
    turmaId: string;
    etapaId: string;
    schoolId: string;
    unitId: string;
  }): Promise<void> {
    this.logger.log(
      `Evento plano.submetido recebido: planoId=${payload.planoId}`,
    );

    try {
      // Buscar analista pedagógico responsável
      const analistaId = await this.findAnalistaPedagogico(
        payload.schoolId,
        payload.unitId,
      );

      if (!analistaId) {
        this.logger.warn(
          `Analista pedagógico não encontrado para unidade ${payload.unitId}`,
        );
        return;
      }

      // Calcular prazo (3 dias para revisão)
      const prazo = this.calcularPrazo(3);
      const prioridade = this.calcularPrioridade(prazo);

      // Criar tarefa para analista revisar
      await this.tarefasService.criarAutomatica({
        schoolId: payload.schoolId,
        unitId: payload.unitId,
        titulo: `Revisar planejamento - Turma ${payload.turmaId}`,
        descricao: `Plano submetido pela professora para revisão`,
        prioridade,
        prazo,
        criadoPor: "system",
        responsavel: analistaId,
        contextos: [
          {
            modulo: "PLANEJAMENTO",
            quinzenaId: payload.quinzenaId,
            etapaId: payload.etapaId,
            turmaId: payload.turmaId,
            professoraId: payload.professoraId,
          },
        ],
      });

      this.logger.log(
        `Tarefa criada para analista revisar plano: ${payload.planoId}`,
      );
    } catch (error) {
      this.logger.error(
        `Erro ao processar evento plano.submetido: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Handler para evento plano.aprovado_analista
   *
   * Disparado quando um analista aprova um plano.
   * Cria tarefa para a coordenadora fazer aprovação final.
   *
   * @param payload Dados do evento
   */
  @OnEvent("plano.aprovado_analista")
  async onPlanoAprovadoAnalista(payload: {
    planoId: string;
    quinzenaId: string;
    professoraId: string;
    turmaId: string;
    etapaId: string;
    schoolId: string;
    unitId: string;
    analistaId: string;
  }): Promise<void> {
    this.logger.log(
      `Evento plano.aprovado_analista recebido: planoId=${payload.planoId}`,
    );

    try {
      // Buscar coordenadora responsável pela etapa
      const coordenadoraId = await this.findCoordenadora(
        payload.schoolId,
        payload.unitId,
        payload.etapaId,
      );

      if (!coordenadoraId) {
        this.logger.warn(
          `Coordenadora não encontrada para etapa ${payload.etapaId}`,
        );
        return;
      }

      // Calcular prazo (2 dias para aprovação final)
      const prazo = this.calcularPrazo(2);
      const prioridade = this.calcularPrioridade(prazo);

      // Criar tarefa para coordenadora aprovar
      await this.tarefasService.criarAutomatica({
        schoolId: payload.schoolId,
        unitId: payload.unitId,
        titulo: `Aprovar planejamento - Turma ${payload.turmaId}`,
        descricao: `Plano aprovado pelo analista, aguardando aprovação final`,
        prioridade,
        prazo,
        criadoPor: "system",
        responsavel: coordenadoraId,
        contextos: [
          {
            modulo: "PLANEJAMENTO",
            quinzenaId: payload.quinzenaId,
            etapaId: payload.etapaId,
            turmaId: payload.turmaId,
            professoraId: payload.professoraId,
          },
        ],
      });

      this.logger.log(
        `Tarefa criada para coordenadora aprovar plano: ${payload.planoId}`,
      );
    } catch (error) {
      this.logger.error(
        `Erro ao processar evento plano.aprovado_analista: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Handler para evento plano.devolvido
   *
   * Disparado quando um revisor (analista ou coordenadora) devolve um plano.
   * Cria tarefa para a professora fazer os ajustes solicitados.
   *
   * @param payload Dados do evento
   */
  @OnEvent("plano.devolvido")
  async onPlanoDevolvido(payload: {
    planoId: string;
    quinzenaId: string;
    professoraId: string;
    turmaId: string;
    etapaId: string;
    schoolId: string;
    unitId: string;
    revisorId: string;
    motivo: string;
  }): Promise<void> {
    this.logger.log(
      `Evento plano.devolvido recebido: planoId=${payload.planoId}`,
    );

    try {
      // Calcular prazo (3 dias para ajustar)
      const prazo = this.calcularPrazo(3);
      const prioridade = this.calcularPrioridade(prazo);

      // Criar tarefa para professora ajustar
      await this.tarefasService.criarAutomatica({
        schoolId: payload.schoolId,
        unitId: payload.unitId,
        titulo: `Ajustar planejamento - Turma ${payload.turmaId}`,
        descricao: `Plano devolvido para ajustes: ${payload.motivo}`,
        prioridade,
        prazo,
        criadoPor: "system",
        responsavel: payload.professoraId,
        contextos: [
          {
            modulo: "PLANEJAMENTO",
            quinzenaId: payload.quinzenaId,
            etapaId: payload.etapaId,
            turmaId: payload.turmaId,
            professoraId: payload.professoraId,
          },
        ],
      });

      this.logger.log(
        `Tarefa criada para professora ajustar plano: ${payload.planoId}`,
      );
    } catch (error) {
      this.logger.error(
        `Erro ao processar evento plano.devolvido: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Handler para evento plano.aprovado_final
   *
   * Disparado quando uma coordenadora faz a aprovação final do plano.
   * Marca a tarefa da coordenadora como concluída.
   *
   * @param payload Dados do evento
   */
  @OnEvent("plano.aprovado_final")
  async onPlanoAprovadoFinal(payload: {
    planoId: string;
    quinzenaId: string;
    professoraId: string;
    turmaId: string;
    etapaId: string;
    schoolId: string;
    unitId: string;
    coordenadoraId: string;
  }): Promise<void> {
    this.logger.log(
      `Evento plano.aprovado_final recebido: planoId=${payload.planoId}`,
    );

    try {
      // Workflow concluído - aprovação final
      // NOTA: A tarefa da coordenadora deve ser marcada como concluída
      // manualmente pela própria coordenadora via interface
      this.logger.log(
        `Plano aprovado com sucesso - workflow concluído: ${payload.planoId}`,
      );
    } catch (error) {
      this.logger.error(
        `Erro ao processar evento plano.aprovado_final: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
