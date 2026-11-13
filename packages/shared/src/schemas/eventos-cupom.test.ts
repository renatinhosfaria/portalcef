import { describe, expect, it } from "vitest";
import { aplicarCupomSchema, criarCupomSchema } from "./eventos";
describe("schemas de cupom", () => {
  it("valida cupom percentual", () => expect(criarCupomSchema.parse({ code: " dez ", pricingType: "PERCENTUAL", discountPercent: 10 })).toMatchObject({ code: "dez" }));
  it("exige valor coerente com o tipo", () => expect(() => criarCupomSchema.parse({ code: "X", pricingType: "VALOR_FIXO" })).toThrow());
  it("aceita aplicação vazia para remover", () => expect(aplicarCupomSchema.parse({ code: "" })).toEqual({ code: "" }));
});
