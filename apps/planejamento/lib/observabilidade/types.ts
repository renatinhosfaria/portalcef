export type ValorObservabilidade =
  | string
  | number
  | boolean
  | null
  | undefined
  | ValorObservabilidade[]
  | { [chave: string]: ValorObservabilidade };

export interface EventoObservabilidadeCliente {
  nome: string;
  origem?: string;
  metadados?: Record<string, ValorObservabilidade>;
  [chave: string]: ValorObservabilidade;
}

export interface EventoObservabilidadeEnvio
  extends EventoObservabilidadeCliente {
  sessaoObservabilidadeId: string;
}
