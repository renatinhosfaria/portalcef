import { Injectable, Logger } from "@nestjs/common";
import { tarefaHistorico } from "@essencia/db";
import type { TarefaAcao } from "@essencia/db";

export interface RegistrarHistoricoParams {
  tarefaId: string;
  userId: string;
  userName: string;
  userRole: string;
  acao: TarefaAcao;
  campoAlterado?: string;
  valorAnterior?: string;
  valorNovo?: string;
}

@Injectable()
export class TarefaHistoricoService {
  private readonly logger = new Logger(TarefaHistoricoService.name);

  async registrar(tx: any, params: RegistrarHistoricoParams): Promise<void> {
    try {
      await tx.insert(tarefaHistorico).values({
        tarefaId: params.tarefaId,
        userId: params.userId,
        userName: params.userName,
        userRole: params.userRole,
        acao: params.acao,
        campoAlterado: params.campoAlterado ?? null,
        valorAnterior: params.valorAnterior ?? null,
        valorNovo: params.valorNovo ?? null,
      });
    } catch (err) {
      this.logger.error(
        `Falha ao registrar histórico para tarefa ${params.tarefaId}`,
        err,
      );
    }
  }
}
