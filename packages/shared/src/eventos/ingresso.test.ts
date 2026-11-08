import { describe, expect, it } from "vitest";

import {
  ALFABETO_NUMERO_INGRESSO,
  formatarNumeroIngresso,
  gerarNumeroIngresso,
  normalizarNumeroIngresso,
} from "./ingresso";

describe("número do ingresso", () => {
  it("gera 1000 números de 8 caracteres só com o alfabeto permitido", () => {
    const numeros = Array.from({ length: 1000 }, () => gerarNumeroIngresso());

    expect(numeros.every((numero) => numero.length === 8)).toBe(true);
    expect(numeros.every((numero) => [...numero].every((caractere) => ALFABETO_NUMERO_INGRESSO.includes(caractere)))).toBe(true);
    expect(numeros.some((numero) => /[0O1IL]/.test(numero))).toBe(false);
  });

  it('usa o índice zero quando o sorteador retorna zero', () => {
    expect(gerarNumeroIngresso(() => 0)).toBe("AAAAAAAA");
  });

  it("formata o número em dois blocos de quatro caracteres", () => {
    expect(formatarNumeroIngresso("K7Q482MX")).toBe("K7Q4-82MX");
  });

  it("normaliza espaços, hífen e minúsculas", () => {
    expect(normalizarNumeroIngresso(" k7q4-82mx ")).toBe("K7Q482MX");
  });

  it("recusa número com caractere proibido ou tamanho inválido", () => {
    expect(normalizarNumeroIngresso("K7Q4-82M0")).toBeNull();
    expect(normalizarNumeroIngresso("ABC")).toBeNull();
  });
});
