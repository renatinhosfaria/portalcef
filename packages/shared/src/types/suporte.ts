// ============================================
// Suporte (Ordem de Servico) Types
// ============================================

export type OrdemServicoCategoria =
  | "ERRO_SISTEMA"
  | "DUVIDA_USO"
  | "SUGESTAO_MELHORIA"
  | "PROBLEMA_ACESSO";

export type OrdemServicoStatus =
  | "ABERTA"
  | "EM_ANDAMENTO"
  | "RESOLVIDA"
  | "FECHADA";

export type MensagemTipo = "TEXTO" | "IMAGEM" | "VIDEO" | "AUDIO";

// ============================================
// Main Ordem de Servico Interface
// ============================================
export interface OrdemServico {
  id: string;
  numero: number;
  titulo: string;
  descricao: string;
  categoria: OrdemServicoCategoria;
  status: OrdemServicoStatus;
  criadoPor: string; // userId
  schoolId: string;
  unitId: string | null;
  createdAt: string; // ISO 8601 string for JSON transport
  updatedAt: string; // ISO 8601 string for JSON transport
}

// ============================================
// Mensagem Interface
// ============================================
export interface OrdemServicoMensagem {
  id: string;
  ordemServicoId: string;
  conteudo: string | null;
  tipo: MensagemTipo;
  arquivoUrl: string | null;
  arquivoNome: string | null;
  criadoPor: string; // userId
  createdAt: string; // ISO 8601 string for JSON transport
}

// ============================================
// Enriched Ordem de Servico (with related data)
// ============================================
export interface OrdemServicoEnriquecida extends OrdemServico {
  criadoPorNome: string;
}

export interface OrdemServicoDetalhe extends OrdemServico {
  criadoPorNome: string;
  mensagens: MensagemEnriquecida[];
}

export interface MensagemEnriquecida extends OrdemServicoMensagem {
  criadoPorNome: string;
  criadoPorRole: string;
}

// ============================================
// Suporte Statistics
// ============================================
export interface SuporteContagem {
  total: number;
  abertas: number;
  emAndamento: number;
  resolvidas: number;
}

// ============================================
// Labels for Display
// ============================================
export const CATEGORIA_LABELS: Record<OrdemServicoCategoria, string> = {
  ERRO_SISTEMA: "Erro no Sistema",
  DUVIDA_USO: "Dúvida de Uso",
  SUGESTAO_MELHORIA: "Sugestão de Melhoria",
  PROBLEMA_ACESSO: "Problema de Acesso",
};

export const STATUS_LABELS: Record<OrdemServicoStatus, string> = {
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em Andamento",
  RESOLVIDA: "Resolvida",
  FECHADA: "Fechada",
};
