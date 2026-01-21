import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { TarefasService } from "./tarefas.service";
import { calcularPrioridadeAutomatica } from "./utils/validacoes";

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
    private readonly eventEmitter: EventEmitter2,
    private readonly tarefasService: TarefasService,
  ) {}

  /**
   * Registra listeners de eventos quando o módulo é inicializado
   */
  onModuleInit() {
    this.logger.log("Registrando listeners de eventos do planejamento");
  }

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
      // TODO: Buscar analista pedagógico responsável pela etapa
      // const analista = await this.buscarAnalistaPorEtapa(payload.etapaId);

      // TODO: Calcular prazo baseado em regras de negócio
      // const prazo = calcularPrazoRevisao(payload.quinzenaId);

      // TODO: Criar tarefa para analista revisar
      // const prioridade = calcularPrioridadeAutomatica(prazo);
      // await this.tarefasService.criarAutomatica({
      //   schoolId: payload.schoolId,
      //   unitId: payload.unitId,
      //   titulo: `Revisar planejamento - Turma ${payload.turmaId}`,
      //   descricao: `Plano submetido pela professora para revisão`,
      //   prioridade,
      //   prazo,
      //   criadoPor: "system",
      //   responsavel: analista.id,
      //   contextos: [{
      //     modulo: "PLANEJAMENTO",
      //     quinzenaId: payload.quinzenaId,
      //     etapaId: payload.etapaId,
      //     turmaId: payload.turmaId,
      //     professoraId: payload.professoraId,
      //   }],
      // });

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
      // TODO: Buscar coordenadora responsável pela etapa
      // const coordenadora = await this.buscarCoordenadoraPorEtapa(payload.etapaId);

      // TODO: Calcular prazo baseado em regras de negócio
      // const prazo = calcularPrazoAprovacaoFinal(payload.quinzenaId);

      // TODO: Criar tarefa para coordenadora aprovar
      // const prioridade = calcularPrioridadeAutomatica(prazo);
      // await this.tarefasService.criarAutomatica({
      //   schoolId: payload.schoolId,
      //   unitId: payload.unitId,
      //   titulo: `Aprovar planejamento - Turma ${payload.turmaId}`,
      //   descricao: `Plano aprovado pelo analista, aguardando aprovação final`,
      //   prioridade,
      //   prazo,
      //   criadoPor: "system",
      //   responsavel: coordenadora.id,
      //   contextos: [{
      //     modulo: "PLANEJAMENTO",
      //     quinzenaId: payload.quinzenaId,
      //     etapaId: payload.etapaId,
      //     turmaId: payload.turmaId,
      //     professoraId: payload.professoraId,
      //   }],
      // });

      // TODO: Marcar tarefa do analista como concluída
      // await this.tarefasService.concluir(tarefaAnalistaId, payload.analistaId);

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
      // TODO: Calcular prazo baseado em regras de negócio
      // const prazo = calcularPrazoAjuste(payload.quinzenaId);

      // TODO: Criar tarefa para professora ajustar
      // const prioridade = calcularPrioridadeAutomatica(prazo);
      // await this.tarefasService.criarAutomatica({
      //   schoolId: payload.schoolId,
      //   unitId: payload.unitId,
      //   titulo: `Ajustar planejamento - Turma ${payload.turmaId}`,
      //   descricao: `Plano devolvido para ajustes: ${payload.motivo}`,
      //   prioridade,
      //   prazo,
      //   criadoPor: "system",
      //   responsavel: payload.professoraId,
      //   contextos: [{
      //     modulo: "PLANEJAMENTO",
      //     quinzenaId: payload.quinzenaId,
      //     etapaId: payload.etapaId,
      //     turmaId: payload.turmaId,
      //     professoraId: payload.professoraId,
      //   }],
      // });

      // TODO: Marcar tarefa do revisor como concluída
      // await this.tarefasService.concluir(tarefaRevisorId, payload.revisorId);

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
      // TODO: Marcar tarefa da coordenadora como concluída
      // await this.tarefasService.concluir(tarefaCoordenadoraId, payload.coordenadoraId);

      this.logger.log(
        `Tarefa da coordenadora concluída para plano: ${payload.planoId}`,
      );
    } catch (error) {
      this.logger.error(
        `Erro ao processar evento plano.aprovado_final: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
