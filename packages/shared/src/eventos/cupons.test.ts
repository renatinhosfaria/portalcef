import { describe, expect, it } from "vitest";
import { identidadeCupomDoComprador, normalizarCodigoCupom, type CupomPreco } from "./cupons";

describe("cupons", () => {
  it("normaliza código com espaços e maiúsculas", () => {
    expect(normalizarCodigoCupom("  festa-2026  ")).toBe("FESTA-2026");
  });

  it("normaliza identidade por e-mail e telefone", () => {
    expect(identidadeCupomDoComprador({ email: "  Pessoa@EXEMPLO.com ", phone: "+55 (11) 99999-0000" })).toEqual({ email: "pessoa@exemplo.com", phone: "5511999990000" });
  });

  it("descreve cupons percentuais e fixos", () => {
    const percentual: CupomPreco = { id: "cupom-1", version: 1, code: "DEZ", pricingType: "PERCENTUAL", discountPercent: 10, discountCents: null, active: true };
    const fixo: CupomPreco = { id: "cupom-2", version: 1, code: "CINCO", pricingType: "VALOR_FIXO", discountPercent: null, discountCents: 500, active: true };
    expect(percentual.discountPercent).toBe(10);
    expect(fixo.discountCents).toBe(500);
  });
});
