// ============================================
// Plano Aula Histórico Types
// ============================================

export type AcaoHistorico =
  | "CRIADO"
  | "SUBMETIDO"
  | "APROVADO_ANALISTA"
  | "DEVOLVIDO_ANALISTA"
  | "APROVADO_COORDENADORA"
  | "DEVOLVIDO_COORDENADORA"
  | "DOCUMENTO_IMPRESSO";

export interface HistoricoEntry {
  id: string;
  planoId: string;
  userId: string;
  userName: string;
  userRole: string;
  acao: AcaoHistorico;
  statusAnterior: string | null;
  statusNovo: string;
  detalhes?: Record<string, unknown> | null;
  createdAt: string; // ISO 8601 string for JSON transport
}
