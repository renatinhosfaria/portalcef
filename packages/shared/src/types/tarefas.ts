// ============================================
// Tarefas Types
// ============================================

export type TarefaStatus = "PENDENTE" | "CONCLUIDA" | "CANCELADA";

export type TarefaPrioridade = "ALTA" | "MEDIA" | "BAIXA";

export type TarefaTipoOrigem = "AUTOMATICA" | "MANUAL";

export type TarefaContextoModulo =
  | "PLANEJAMENTO"
  | "CALENDARIO"
  | "USUARIOS"
  | "TURMAS"
  | "LOJA";

// ============================================
// Main Tarefa Interface
// ============================================
export interface Tarefa {
  id: string;
  schoolId: string;
  unitId: string | null;
  titulo: string;
  descricao: string | null;
  status: TarefaStatus;
  prioridade: TarefaPrioridade;
  prazo: string; // ISO 8601 string for JSON transport
  criadoPor: string; // userId
  responsavel: string; // userId
  tipoOrigem: TarefaTipoOrigem;
  createdAt: string; // ISO 8601 string for JSON transport
  updatedAt: string; // ISO 8601 string for JSON transport
  concluidaEm: string | null; // ISO 8601 string for JSON transport
}

// ============================================
// Tarefa Contexto Interface
// ============================================
export interface TarefaContexto {
  id: string;
  tarefaId: string;
  modulo: TarefaContextoModulo;
  quinzenaId: string | null;
  etapaId: string | null;
  turmaId: string | null;
  professoraId: string | null;
}

// ============================================
// Enriched Tarefa (with related data)
// ============================================
export interface TarefaEnriquecida extends Tarefa {
  criadoPorNome: string;
  responsavelNome: string;
  contextos: TarefaContexto[];
  // Optional enriched context data
  turmaName?: string;
  etapaName?: string;
  professoraName?: string;
}

// ============================================
// Tarefa Statistics
// ============================================
export interface TarefaStats {
  total: number;
  pendentes: number;
  concluidas: number;
  canceladas: number;
  atrasadas: number;
  proximasVencer: number; // vencendo nos próximos 3 dias
}
