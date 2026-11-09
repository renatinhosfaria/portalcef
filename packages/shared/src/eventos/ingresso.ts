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
