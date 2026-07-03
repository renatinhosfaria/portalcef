export type PlanejamentoObservabilidadeOrigem =
  | "browser"
  | "proxy"
  | "api"
  | "sharepoint"
  | "storage";

export type PlanejamentoObservabilidadeEvento =
  | "pagina_aberta"
  | "api_chamada"
  | "api_lenta"
  | "arquivo_acao"
  | "erro_navegador"
  | "upload_resultado"
  | "sharepoint_word"
  | "pdf_impressao";

export type PlanejamentoObservabilidadeNivel = "info" | "warn" | "error";

export interface PlanejamentoObservabilidadeUsuario {
  id: string;
  nome?: string | null;
  role: string;
  schoolId?: string | null;
  unitId?: string | null;
  [campo: string]: unknown;
}

export interface PlanejamentoObservabilidadeHttp {
  metodo?: string;
  rota?: string;
  status?: number;
  duracaoMs?: number;
  [campo: string]: unknown;
}

export interface PlanejamentoObservabilidadePagina {
  url?: string;
  titulo?: string;
  [campo: string]: unknown;
}

export interface PlanejamentoObservabilidadeArquivo {
  planoId?: string | null;
  provaId?: string | null;
  relatorioId?: string | null;
  documentoId?: string | null;
  nome?: string | null;
  tipo?: string | null;
  tamanhoBytes?: number | null;
  [campo: string]: unknown;
}

export interface PlanejamentoObservabilidadeErro {
  codigo?: string | null;
  mensagem?: string | null;
  stackResumo?: string | null;
  [campo: string]: unknown;
}

export interface PlanejamentoObservabilidadeEventoEntrada {
  timestamp?: string;
  ambiente?: string;
  app?: "planejamento";
  origem: PlanejamentoObservabilidadeOrigem;
  evento: PlanejamentoObservabilidadeEvento;
  nivel?: PlanejamentoObservabilidadeNivel;
  correlationId?: string | null;
  sessaoObservabilidadeId?: string | null;
  requestId?: string | null;
  usuario?: PlanejamentoObservabilidadeUsuario | null;
  http?: PlanejamentoObservabilidadeHttp;
  pagina?: PlanejamentoObservabilidadePagina;
  arquivo?: PlanejamentoObservabilidadeArquivo;
  erro?: PlanejamentoObservabilidadeErro;
  detalhes?: Record<string, unknown> | null;
  [campo: string]: unknown;
}

export interface PlanejamentoObservabilidadeEventoNormalizado
  extends PlanejamentoObservabilidadeEventoEntrada {
  timestamp: string;
  ambiente: string;
  app: "planejamento";
  nivel: PlanejamentoObservabilidadeNivel;
}

export interface PlanejamentoObservabilidadeServiceConfig {
  diretorio?: string;
  ambiente?: string;
  slowMs?: number;
  retencaoDias?: number;
  agora?: () => Date;
}
