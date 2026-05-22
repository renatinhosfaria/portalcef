import { Injectable } from "@nestjs/common";

import { desc, eq, getDb, relatorioHistorico } from "@essencia/db";
import type { RelatorioHistoricoAcao, RelatorioHistorico } from "@essencia/db";

export interface RelatorioHistoricoEntry {
  id: string;
  relatorioId: string;
  userId: string;
  userName: string;
  userRole: string;
  acao: RelatorioHistoricoAcao;
  statusAnterior: string | null;
  statusNovo: string;
  detalhes: Record<string, unknown> | null;
  createdAt: string;
}

@Injectable()
export class RelatorioHistoricoService {
  async registrar(params: {
    relatorioId: string;
    userId: string;
    userName: string;
    userRole: string;
    acao: RelatorioHistoricoAcao;
    statusAnterior: string | null;
    statusNovo: string;
    detalhes?: Record<string, unknown> | null;
  }): Promise<RelatorioHistoricoEntry> {
    const db = getDb();
    const [entry] = await db
      .insert(relatorioHistorico)
      .values({
        relatorioId: params.relatorioId,
        userId: params.userId,
        userName: params.userName,
        userRole: params.userRole,
        acao: params.acao,
        statusAnterior: params.statusAnterior,
        statusNovo: params.statusNovo,
        detalhes: params.detalhes ?? null,
      })
      .returning();

    if (!entry) throw new Error("Falha ao registrar histórico");
    return this.mapEntry(entry);
  }

  async buscarPorRelatorio(
    relatorioId: string,
  ): Promise<RelatorioHistoricoEntry[]> {
    const db = getDb();
    const entries = await db.query.relatorioHistorico.findMany({
      where: eq(relatorioHistorico.relatorioId, relatorioId),
      orderBy: [desc(relatorioHistorico.createdAt)],
    });
    return entries.map((e: RelatorioHistorico) => this.mapEntry(e));
  }

  private mapEntry(entry: {
    id: string;
    relatorioId: string;
    userId: string;
    userName: string;
    userRole: string;
    acao: string;
    statusAnterior: string | null;
    statusNovo: string;
    detalhes: unknown;
    createdAt: Date;
  }): RelatorioHistoricoEntry {
    return {
      id: entry.id,
      relatorioId: entry.relatorioId,
      userId: entry.userId,
      userName: entry.userName,
      userRole: entry.userRole,
      acao: entry.acao as RelatorioHistoricoAcao,
      statusAnterior: entry.statusAnterior,
      statusNovo: entry.statusNovo,
      detalhes: entry.detalhes as Record<string, unknown> | null,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
