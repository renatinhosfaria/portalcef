import { describe, expect, it } from "vitest";

import { atualizarClassificacaoEtariaSchema } from "./eventos";

describe("contrato da classificação indicativa do evento", () => {
  it("aceita as faixas oficiais e a remoção com null", () => {
    expect(atualizarClassificacaoEtariaSchema.parse({ classificacaoEtaria: "LIVRE" })).toEqual({ classificacaoEtaria: "LIVRE" });
    expect(atualizarClassificacaoEtariaSchema.parse({ classificacaoEtaria: "16" })).toEqual({ classificacaoEtaria: "16" });
    expect(atualizarClassificacaoEtariaSchema.parse({ classificacaoEtaria: null })).toEqual({ classificacaoEtaria: null });
  });

  it("converte a versão esperada em data", () => {
    const resultado = atualizarClassificacaoEtariaSchema.parse({ classificacaoEtaria: "12", expectedUpdatedAt: "2026-11-17T10:00:00.000Z" });
    expect(resultado.expectedUpdatedAt).toEqual(new Date("2026-11-17T10:00:00.000Z"));
  });

  it("recusa faixa inexistente, campo ausente e campos extras", () => {
    expect(() => atualizarClassificacaoEtariaSchema.parse({ classificacaoEtaria: "13" })).toThrow();
    expect(() => atualizarClassificacaoEtariaSchema.parse({})).toThrow();
    expect(() => atualizarClassificacaoEtariaSchema.parse({ classificacaoEtaria: "LIVRE", title: "Outro" })).toThrow();
  });
});
