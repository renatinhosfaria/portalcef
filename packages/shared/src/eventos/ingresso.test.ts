import { describe, expect, it } from "vitest";

import {
  ALFABETO_NUMERO_INGRESSO,
  AVISOS_INGRESSO,
  CLASSIFICACOES_ETARIAS,
  coresClassificacaoEtaria,
  descreverClassificacaoEtaria,
  formatarNumeroIngresso,
  formatarValorIngresso,
  gerarNumeroIngresso,
  normalizarNumeroIngresso,
  siglaClassificacaoEtaria,
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

describe("informações obrigatórias do ingresso", () => {
  it("traz os dois avisos de acesso à plateia com o texto exigido", () => {
    expect(AVISOS_INGRESSO).toEqual([
      "A abertura da plateia será feita com 30 (trinta) minutos de antecedência do horário de início do espetáculo.",
      "Não será permitida a entrada após o início do espetáculo.",
    ]);
  });

  it("formata o valor pago em reais e identifica a cortesia", () => {
    expect(formatarValorIngresso(4500)).toBe("R$ 45,00");
    expect(formatarValorIngresso(3800)).toBe("R$ 38,00");
    expect(formatarValorIngresso(0)).toBe("R$ 0,00");
    expect(formatarValorIngresso(0, { cortesia: true })).toBe("R$ 0,00 (cortesia)");
    expect(formatarValorIngresso(123456)).toBe("R$ 1.234,56");
  });

  it("descreve cada classificação indicativa com sigla e texto", () => {
    expect(CLASSIFICACOES_ETARIAS).toEqual(["LIVRE", "10", "12", "14", "16", "18"]);
    expect(siglaClassificacaoEtaria("LIVRE")).toBe("L");
    expect(siglaClassificacaoEtaria("14")).toBe("14");
    expect(descreverClassificacaoEtaria("LIVRE")).toBe("Livre para todos os públicos");
    expect(descreverClassificacaoEtaria("12")).toBe("Não recomendado para menores de 12 anos");
  });

  it("dá a cada classificação uma cor de fundo e um texto legível", () => {
    for (const classificacao of CLASSIFICACOES_ETARIAS) {
      const cores = coresClassificacaoEtaria(classificacao);
      expect(cores.fundo).toMatch(/^#[0-9A-F]{6}$/);
      expect(cores.texto).toMatch(/^#[0-9A-F]{6}$/);
    }
    expect(coresClassificacaoEtaria("12").texto).not.toBe("#FFFFFF");
  });
});
