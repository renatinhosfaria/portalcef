import { Injectable } from "@nestjs/common";
import {
  getDb,
  provaHistorico,
  eq,
  desc,
  type ProvaHistoricoAcao,
} from "@essencia/db";
import type { HistoricoEntry } from "@essencia/shared/types";

/**
 * ProvaHistoricoService
 *
 * Serviço responsável por registrar e consultar o histórico de ações
 * realizadas em provas (criação, submissão, aprovação, devolução)
 */
@Injectable()
export class ProvaHistoricoService {
  /**
   * Registra uma ação no histórico da prova
   */
  async registrar(params: {
    provaId: string;
    userId: string;
    userName: string;
    userRole: string;
    acao: ProvaHistoricoAcao;
    statusAnterior: string | null;
    statusNovo: string;
    detalhes?: Record<string, unknown> | null;
  }): Promise<HistoricoEntry> {
    const db = getDb();

    const [entry] = await db
      .insert(provaHistorico)
      .values({
        provaId: params.provaId,
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
      throw new Error("Falha ao registrar histórico da prova");
    }

    return this.mapToHistoricoEntry(entry);
  }

  /**
   * Busca histórico de uma prova ordenado por data (mais recente primeiro)
   */
  async buscarPorProva(provaId: string): Promise<HistoricoEntry[]> {
    const db = getDb();

    const entries = await db.query.provaHistorico.findMany({
      where: eq(provaHistorico.provaId, provaId),
      orderBy: [desc(provaHistorico.createdAt)],
    });

    return entries.map(
      (entry: {
        id: string;
        provaId: string;
        userId: string;
        userName: string;
        userRole: string;
        acao: string;
        statusAnterior: string | null;
        statusNovo: string;
        detalhes: unknown;
        createdAt: Date;
      }) => this.mapToHistoricoEntry(entry),
    );
  }

  /**
   * Converte entrada do banco para HistoricoEntry (com ISO string)
   */
  private mapToHistoricoEntry(entry: {
    id: string;
    provaId: string;
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
      planoId: entry.provaId,
      userId: entry.userId,
      userName: entry.userName,
      userRole: entry.userRole,
      acao: entry.acao as ProvaHistoricoAcao,
      statusAnterior: entry.statusAnterior,
      statusNovo: entry.statusNovo,
      detalhes: entry.detalhes as Record<string, unknown> | null,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
