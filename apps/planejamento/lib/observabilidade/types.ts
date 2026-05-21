export type ValorObservabilidade =
  | string
  | number
  | boolean
  | null
  | undefined
  | ValorObservabilidade[]
  | { [chave: string]: ValorObservabilidade };

export type EventoObservabilidadeTipo =
  | "pagina_aberta"
  | "api_chamada"
  | "api_lenta"
  | "arquivo_acao"
  | "erro_navegador"
  | "upload_resultado"
  | "sharepoint_word";

export type NivelObservabilidade = "info" | "warn" | "error";

export interface HttpObservabilidade {
  metodo?: string;
  rota?: string;
  status?: number;
  duracaoMs?: number;
}

export interface PaginaObservabilidade {
  url?: string;
  titulo?: string;
}

export interface ArquivoObservabilidade {
  planoId?: string | null;
  provaId?: string | null;
  documentoId?: string | null;
  nome?: string | null;
  tipo?: string | null;
  tamanhoBytes?: number | null;
}

export interface ErroObservabilidade {
  codigo?: string | null;
  mensagem?: string | null;
  stackResumo?: string | null;
}

export interface EventoObservabilidadeCliente {
  timestamp?: string;
  ambiente?: string;
  evento: EventoObservabilidadeTipo;
  nivel?: NivelObservabilidade;
  correlationId?: string | null;
  requestId?: string | null;
  http?: HttpObservabilidade;
  pagina?: PaginaObservabilidade;
  arquivo?: ArquivoObservabilidade;
  erro?: ErroObservabilidade;
  detalhes?: Record<string, ValorObservabilidade> | null;
  [chave: string]: unknown;
}

export interface EventoObservabilidadeEnvio
  extends EventoObservabilidadeCliente {
  origem: "browser";
  sessaoObservabilidadeId: string;
}
