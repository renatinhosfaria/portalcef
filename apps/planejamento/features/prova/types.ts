/**
 * Tipos para o modulo de Provas
 * Fluxo: Professora -> Analista -> Coordenadora -> Aprovado
 * (Mesmo fluxo do Plano de Aula, adaptado para provas)
 */

import type { PlanoAulaStatus, DocumentoTipo, DocumentoPreviewStatus } from "../plano-aula/types";

// Re-exportar constantes compartilhadas do plano-aula
export { STATUS_LABELS, STATUS_COLORS, STATUS_FILTER_OPTIONS } from "../plano-aula/types";

/**
 * Status possiveis de uma prova (mesmos valores do PlanoAulaStatus)
 */
export type ProvaStatus = PlanoAulaStatus;

/**
 * Documento anexado a prova
 */
export interface ProvaDocumento {
  id: string;
  provaId: string;
  tipo: DocumentoTipo;
  storageKey?: string;
  url?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
  updatedAt?: string;
  // Campos de preview (conversao assincrona)
  previewKey?: string;
  previewUrl?: string;
  previewMimeType?: string;
  previewStatus?: DocumentoPreviewStatus;
  previewError?: string;
  // Campos de aprovacao individual (analista_pedagogico)
  approvedBy?: string;
  approvedAt?: string;
  // Campos de impressao
  printedBy?: string;
  printedAt?: string;
  // Indicador de comentarios (OnlyOffice)
  temComentarios?: boolean;
}

/**
 * Ciclo de prova (equivalente a Quinzena/Periodo para provas)
 */
export interface ProvaCiclo {
  id: string;
  unidadeId: string;
  etapa: string;
  numero: number;
  descricao?: string;
  dataInicio: string;
  dataFim: string;
  dataMaximaEntrega: string;
  provasVinculadas?: number;
  criadoEm?: string;
  atualizadoEm?: string;
}

/**
 * Prova completa com documentos e relacoes
 */
export interface Prova {
  id: string;
  userId: string;
  turmaId: string;
  unitId: string;
  provaCicloId: string;
  status: ProvaStatus;
  submittedAt?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Campos planos (vindos de endpoints de listagem)
  professorName?: string;
  turmaName?: string;
  turmaCode?: string;
  stageId?: string;
  documentos: ProvaDocumento[];
  deadline?: string;
  // Objetos aninhados (vindos do endpoint de detalhe GET /prova/:id)
  user?: { id: string; name: string };
  turma?: { id: string; name: string; code: string };
  ciclo?: ProvaCiclo;
}

/**
 * Resumo da prova para listagens
 */
export interface ProvaSummary {
  id: string;
  provaCicloId: string;
  status: ProvaStatus;
  submittedAt?: string;
  professorName: string;
  turmaName: string;
  turmaCode: string;
  stageCode?: string;
  stageName?: string;
}

/**
 * Estatisticas do dashboard de provas
 */
export interface ProvaDashboardStats {
  total: number;
  rascunho: number;
  aguardandoAnalista: number;
  aguardandoCoordenadora: number;
  devolvidos: number;
  aprovados: number;
}

/**
 * Dados completos do dashboard de provas
 */
export interface ProvaDashboardData {
  stats: ProvaDashboardStats;
  porSegmento: Record<string, { total: number; aprovados: number }>;
}

/**
 * Resultado da criacao de uma prova
 */
export interface CriarProvaResult {
  id: string;
  created: boolean;
}

/**
 * DTO para devolver prova
 */
export interface DevolverProvaDto {
  destino?: "PROFESSORA" | "ANALISTA";
}

/**
 * Item da listagem de provas para gestao
 */
export interface ProvaListItem {
  id: string;
  professorName: string;
  turmaCode: string;
  turmaName: string;
  segmento: string;
  provaCicloId: string;
  cicloPeriodo: string;
  status: ProvaStatus;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  documentosCount: number;
}

/**
 * Filtros para listagem de provas da gestao
 */
export interface FiltrosGestaoProvas {
  status: string;
  provaCicloId?: string;
  segmentoId?: string;
  professora?: string;
  dataInicio?: string;
  dataFim?: string;
  page: number;
  limit: number;
}

/**
 * Resposta paginada da listagem de provas
 */
export interface ListagemProvasResponse {
  data: ProvaListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
