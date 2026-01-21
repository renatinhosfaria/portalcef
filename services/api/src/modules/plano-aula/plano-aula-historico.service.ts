import { Injectable } from "@nestjs/common";
import {
  getDb,
  planoAulaHistorico,
  eq,
  desc,
  type PlanoAulaHistoricoAcao,
} from "@essencia/db";
import type { HistoricoEntry } from "@essencia/shared/types";

/**
 * PlanoAulaHistoricoService
 *
 * Serviço responsável por registrar e consultar o histórico de ações
 * realizadas em planos de aula (criação, submissão, aprovação, devolução)
 */
@Injectable()
export class PlanoAulaHistoricoService {
  /**
   * Registra uma ação no histórico do plano de aula
   *
   * @param params Dados da ação a ser registrada
   * @returns Entrada de histórico criada
   */
  async registrar(params: {
    planoId: string;
    userId: string;
    userName: string;
    userRole: string;
    acao: PlanoAulaHistoricoAcao;
    statusAnterior: string | null;
    statusNovo: string;
    detalhes?: Record<string, unknown> | null;
  }): Promise<HistoricoEntry> {
    const db = getDb();

    const [entry] = await db
      .insert(planoAulaHistorico)
      .values({
        planoId: params.planoId,
        userId: params.userId,
        userName: params.userName,
        userRole: params.userRole,
        acao: params.acao,
        statusAnterior: params.statusAnterior,
        statusNovo: params.statusNovo,
        detalhes: params.detalhes ?? null,
      })
      .returning();

    if (!entry) {
      throw new Error('Falha ao registrar histórico');
    }

    return this.mapToHistoricoEntry(entry);
  }

  /**
   * Busca histórico de um plano ordenado por data (mais recente primeiro)
   *
   * @param planoId ID do plano de aula
   * @returns Array de entradas de histórico
   */
  async buscarPorPlano(planoId: string): Promise<HistoricoEntry[]> {
    const db = getDb();

    const entries = await db.query.planoAulaHistorico.findMany({
      where: eq(planoAulaHistorico.planoId, planoId),
      orderBy: [desc(planoAulaHistorico.createdAt)],
    });

    return entries.map((entry: {
      id: string;
      planoId: string;
      userId: string;
      userName: string;
      userRole: string;
      acao: string;
      statusAnterior: string | null;
      statusNovo: string;
      detalhes: unknown;
      createdAt: Date;
    }) => this.mapToHistoricoEntry(entry));
  }

  /**
   * Converte entrada do banco para HistoricoEntry (com ISO string)
   *
   * @param entry Entrada do banco de dados
   * @returns HistoricoEntry formatado
   */
  private mapToHistoricoEntry(entry: {
    id: string;
    planoId: string;
    userId: string;
    userName: string;
    userRole: string;
    acao: string;
    statusAnterior: string | null;
    statusNovo: string;
    detalhes: unknown;
    createdAt: Date;
  }): HistoricoEntry {
    return {
      id: entry.id,
      planoId: entry.planoId,
      userId: entry.userId,
      userName: entry.userName,
      userRole: entry.userRole,
      acao: entry.acao as PlanoAulaHistoricoAcao,
      statusAnterior: entry.statusAnterior,
      statusNovo: entry.statusNovo,
      detalhes: entry.detalhes as Record<string, unknown> | null,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
