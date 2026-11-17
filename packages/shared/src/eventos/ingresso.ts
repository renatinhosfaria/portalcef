export const ALFABETO_NUMERO_INGRESSO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function sortearSeguro(limite: number): number {
  const valores = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(valores);
    return valores[0]! % limite;
  }
  return Math.floor(Math.random() * limite);
}

export function gerarNumeroIngresso(sortear: (limite: number) => number = sortearSeguro): string {
  return Array.from({ length: 8 }, () => ALFABETO_NUMERO_INGRESSO[sortear(ALFABETO_NUMERO_INGRESSO.length)]).join("");
}

export function formatarNumeroIngresso(numero: string): string {
  return `${numero.slice(0, 4)}-${numero.slice(4, 8)}`;
}

export function normalizarNumeroIngresso(entrada: string): string | null {
  const numero = entrada.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (numero.length !== 8 || [...numero].some((caractere) => !ALFABETO_NUMERO_INGRESSO.includes(caractere))) {
    return null;
  }
  return numero;
}

/** Avisos de acesso à plateia impressos em todo ingresso e cortesia. */
export const AVISOS_INGRESSO = [
  "A abertura da plateia será feita com 30 (trinta) minutos de antecedência do horário de início do espetáculo.",
  "Não será permitida a entrada após o início do espetáculo.",
] as const;

const FORMATO_REAIS = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Valor pago pelo lugar; a cortesia aparece como R$ 0,00 identificada. */
export function formatarValorIngresso(centavos: number, opcoes: { cortesia?: boolean } = {}): string {
  const valor = FORMATO_REAIS.format(centavos / 100).replace(/\u00a0/g, " ");
  return opcoes.cortesia ? `${valor} (cortesia)` : valor;
}

/** Faixas da classificação indicativa brasileira (ClassInd). */
export const CLASSIFICACOES_ETARIAS = ["LIVRE", "10", "12", "14", "16", "18"] as const;
export type ClassificacaoEtaria = (typeof CLASSIFICACOES_ETARIAS)[number];

export function siglaClassificacaoEtaria(classificacao: ClassificacaoEtaria): string {
  return classificacao === "LIVRE" ? "L" : classificacao;
}

export function descreverClassificacaoEtaria(classificacao: ClassificacaoEtaria): string {
  return classificacao === "LIVRE" ? "Livre para todos os públicos" : `Não recomendado para menores de ${classificacao} anos`;
}

const CORES_CLASSIFICACAO: Record<ClassificacaoEtaria, { fundo: string; texto: string }> = {
  LIVRE: { fundo: "#0C9447", texto: "#FFFFFF" },
  "10": { fundo: "#0F7DC2", texto: "#FFFFFF" },
  "12": { fundo: "#F8C411", texto: "#1F2A24" },
  "14": { fundo: "#E67824", texto: "#FFFFFF" },
  "16": { fundo: "#DB2827", texto: "#FFFFFF" },
  "18": { fundo: "#1D1815", texto: "#FFFFFF" },
};

/** Cores habituais de cada faixa, com texto escuro onde o branco não teria contraste. */
export function coresClassificacaoEtaria(classificacao: ClassificacaoEtaria): { fundo: string; texto: string } {
  return CORES_CLASSIFICACAO[classificacao];
}
