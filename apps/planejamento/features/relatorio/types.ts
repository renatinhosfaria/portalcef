export type RelatorioStatus =
  | "RASCUNHO"
  | "AGUARDANDO_ANALISTA"
  | "AGUARDANDO_COORDENADORA"
  | "DEVOLVIDO_ANALISTA"
  | "DEVOLVIDO_COORDENADORA"
  | "REVISAO_ANALISTA"
  | "APROVADO"
  | "RECUPERADO";

export type DocumentoTipo = "ARQUIVO" | "LINK_YOUTUBE";
export type PdfStatus =
  | "NAO_APLICAVEL"
  | "PENDENTE"
  | "GERANDO"
  | "PRONTO"
  | "ERRO";

export interface RelatorioDocumento {
  id: string;
  relatorioId: string;
  tipo: DocumentoTipo;
  storageKey?: string | null;
  url?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  sharepointItemId?: string | null;
  sharepointEditUrl?: string | null;
  editandoDesde?: string | null;
  pdfStorageKey?: string | null;
  pdfUrl?: string | null;
  pdfStatus: PdfStatus;
  pdfError?: string | null;
  pdfRequestedAt?: string | null;
  pdfGeneratedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  printedBy?: string | null;
  printedAt?: string | null;
  temComentarios: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Relatorio {
  id: string;
  userId: string;
  turmaId: string;
  unitId: string;
  semanaId: string;
  semanaRelatorioId?: string | null;
  status: RelatorioStatus;
  submittedAt?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  documentos: RelatorioDocumento[];
  user?: { id: string; name: string };
  turma?: { id: string; name: string; code: string; stageId?: string };
  professorName?: string;
  turmaName?: string;
  turmaCode?: string;
  stageId?: string;
  deadline?: string;
}

export interface RelatorioSummary {
  id: string;
  semanaId: string;
  semanaRelatorioId?: string | null;
  status: RelatorioStatus;
  submittedAt?: string | null;
  professorName: string;
  turmaName: string;
  turmaCode: string;
  etapaCode?: string;
  etapaName?: string;
}

export interface SemanaRelatorio {
  id: string;
  unidadeId: string;
  etapa: "BERCARIO" | "INFANTIL";
  numero: number;
  descricao?: string | null;
  dataInicio: string;
  dataFim: string;
  dataMaximaEntrega: string;
  relatoriosVinculados?: number;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface DashboardRelatorioStats {
  total: number;
  rascunho: number;
  aguardandoAnalista: number;
  aguardandoCoordenadora: number;
  devolvidos: number;
  aprovados: number;
}

export interface DashboardRelatorioData {
  stats: DashboardRelatorioStats;
  porSegmento: Record<string, { total: number; aprovados: number }>;
}

export interface RelatorioListItem {
  id: string;
  professorName: string;
  turmaCode: string;
  turmaName: string;
  etapaCode: string;
  etapaName: string;
  semanaId: string;
  semanaRelatorioId?: string | null;
  status: RelatorioStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  documentosCount: number;
}

export interface FiltrosGestaoRelatorios {
  status?: string;
  etapa?: "BERCARIO" | "INFANTIL";
  semanaId?: string;
}

export const STATUS_LABELS: Record<RelatorioStatus, string> = {
  RASCUNHO: "Rascunho",
  AGUARDANDO_ANALISTA: "Aguardando Analista",
  AGUARDANDO_COORDENADORA: "Aguardando Coordenadora",
  DEVOLVIDO_ANALISTA: "Devolvido pela Analista",
  DEVOLVIDO_COORDENADORA: "Devolvido pela Coordenadora",
  REVISAO_ANALISTA: "Em Revisao",
  APROVADO: "Aprovado",
  RECUPERADO: "Recuperado",
};

export const STATUS_COLORS: Record<RelatorioStatus, string> = {
  RASCUNHO: "bg-gray-100 text-gray-700",
  AGUARDANDO_ANALISTA: "bg-yellow-100 text-yellow-800",
  AGUARDANDO_COORDENADORA: "bg-blue-100 text-blue-800",
  DEVOLVIDO_ANALISTA: "bg-orange-100 text-orange-800",
  DEVOLVIDO_COORDENADORA: "bg-red-100 text-red-800",
  REVISAO_ANALISTA: "bg-purple-100 text-purple-800",
  APROVADO: "bg-green-100 text-green-800",
  RECUPERADO: "bg-gray-100 text-gray-600",
};
