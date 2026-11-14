import { describe, expect, it } from "vitest";
import { construirPayloadCupom, cupomInicial, cupomProntoParaSalvar, type CupomValue } from "./cupons-contratos";

describe("contratos de cupom", () => {
  it("normaliza código, datas e limites no payload", () => {
    const value: CupomValue = { ...cupomInicial, id: "c1", version: 2, code: " dez10 ", name: " Dez ", startsAt: "2026-11-13T10:00", endsAt: "2026-12-01T10:00", usageLimit: 10, usageLimitPerBuyer: 2 };
    expect(construirPayloadCupom(value)).toMatchObject({ id: "c1", version: 2, code: "DEZ10", name: "Dez", startsAt: new Date("2026-11-13T10:00"), endsAt: new Date("2026-12-01T10:00"), usageLimit: 10, usageLimitPerBuyer: 2 });
  });
  it("aceita percentual até 100 e rejeita percentual inválido", () => {
    expect(cupomProntoParaSalvar({ ...cupomInicial, code: "CEM", discountPercent: 100 })).toBe(true);
    expect(cupomProntoParaSalvar({ ...cupomInicial, code: "CEM", discountPercent: 101 })).toBe(false);
    expect(cupomProntoParaSalvar({ ...cupomInicial, code: "ZERO", discountPercent: 0 })).toBe(false);
  });
  it("valida valor fixo, datas e limites", () => {
    expect(cupomProntoParaSalvar({ ...cupomInicial, code: "FIXO", pricingType: "VALOR_FIXO", discountPercent: null, discountCents: 500 })).toBe(true);
    expect(cupomProntoParaSalvar({ ...cupomInicial, code: "FIXO", pricingType: "VALOR_FIXO", discountPercent: null, discountCents: -1 })).toBe(false);
    expect(cupomProntoParaSalvar({ ...cupomInicial, code: "DATA", startsAt: "2026-12-01", endsAt: "2026-11-01" })).toBe(false);
    expect(cupomProntoParaSalvar({ ...cupomInicial, code: "LIMITE", usageLimit: 0 })).toBe(false);
  });
  it("permite vários cupons e mantém inativos como histórico", () => {
    expect(cupomProntoParaSalvar([{ ...cupomInicial, code: "ATIVO" }, { ...cupomInicial, code: "INATIVO", active: false }])).toBe(true);
  });
});
