/**
 * Tipos para o módulo de Plano de Aula
 * Fluxo: Professora -> Analista -> Coordenadora -> Aprovado
 */

/**
 * Status possíveis de um plano de aula
 */
export type PlanoAulaStatus =
  | "RASCUNHO"
  | "AGUARDANDO_ANALISTA"
  | "AGUARDANDO_COORDENADORA"
  | "DEVOLVIDO_ANALISTA"
  | "DEVOLVIDO_COORDENADORA"
  | "REVISAO_ANALISTA"
  | "APROVADO";

/**
 * Tipo do documento anexado ao plano
 */
export type DocumentoTipo = "ARQUIVO" | "LINK_YOUTUBE";

/**
 * Comentário em um documento (feedback da analista/coordenadora)
 */
export interface DocumentoComentario {
  id: string;
  comentario: string;
  resolved: boolean;
  createdAt: string;
  autorId: string;
  autorName: string;
}

/**
 * Documento anexado ao plano de aula
 */
export interface PlanoDocumento {
  id: string;
  planoId: string;
  tipo: DocumentoTipo;
  storageKey?: string;
  url?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
  updatedAt?: string;
  comentarios: DocumentoComentario[];
}

/**
 * Plano de aula completo com documentos e comentários
 */
export interface PlanoAula {
  id: string;
  userId: string;
  turmaId: string;
  quinzenaId: string;
  status: PlanoAulaStatus;
  submittedAt?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  unitId: string;
  professorName: string;
  turmaName: string;
  turmaCode: string;
  stageId?: string;
  documentos: PlanoDocumento[];
  deadline?: string;
}

/**
 * Resumo do plano de aula para listagens
 */
export interface PlanoAulaSummary {
  id: string;
  quinzenaId: string;
  status: PlanoAulaStatus;
  submittedAt?: string;
  professorName: string;
  turmaName: string;
  turmaCode: string;
  stageCode?: string;
  stageName?: string;
}

/**
 * Estatísticas do dashboard
 */
export interface DashboardStats {
  total: number;
  rascunho: number;
  aguardandoAnalista: number;
  aguardandoCoordenadora: number;
  devolvidos: number;
  aprovados: number;
}

/**
 * Dados completos do dashboard
 */
export interface DashboardData {
  stats: DashboardStats;
  porSegmento: Record<string, { total: number; aprovados: number }>;
}

/**
 * Resultado da criação de um plano
 */
export interface CriarPlanoResult {
  id: string;
  created: boolean;
}

/**
 * DTO para criar comentário
 */
export interface AddComentarioDto {
  documentoId: string;
  comentario: string;
}

/**
 * DTO para devolver plano
 */
export interface DevolverPlanoDto {
  destino?: "PROFESSORA" | "ANALISTA";
  comentarios?: AddComentarioDto[];
}

/**
 * Configuração de prazo por quinzena
 */
export interface QuinzenaConfig {
  id: string;
  unitId: string;
  quinzenaId: string;
  deadline: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Labels de status para exibição na UI
 */
export const STATUS_LABELS: Record<PlanoAulaStatus, string> = {
  RASCUNHO: "Rascunho",
  AGUARDANDO_ANALISTA: "Aguardando Análise",
  AGUARDANDO_COORDENADORA: "Aguardando Coordenação",
  DEVOLVIDO_ANALISTA: "Devolvido pela Analista",
  DEVOLVIDO_COORDENADORA: "Devolvido pela Coordenadora",
  REVISAO_ANALISTA: "Em Revisão (Analista)",
  APROVADO: "Aprovado",
};

/**
 * Cores de status para badges na UI
 */
export const STATUS_COLORS: Record<
  PlanoAulaStatus,
  { bg: string; text: string; border: string }
> = {
  RASCUNHO: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-300",
  },
  AGUARDANDO_ANALISTA: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    border: "border-blue-300",
  },
  AGUARDANDO_COORDENADORA: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    border: "border-purple-300",
  },
  DEVOLVIDO_ANALISTA: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    border: "border-yellow-300",
  },
  DEVOLVIDO_COORDENADORA: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    border: "border-orange-300",
  },
  REVISAO_ANALISTA: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    border: "border-amber-300",
  },
  APROVADO: {
    bg: "bg-green-100",
    text: "text-green-700",
    border: "border-green-300",
  },
};
