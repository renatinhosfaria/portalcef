import { describe, expect, it } from "vitest";

import { calcularPrecoPedido, type ItemPreco, type OfertaPreco } from "./precos";

const ofertaPercentual: OfertaPreco = {
  id: "oferta-15",
  version: 1,
  name: "15% a partir de 10 lugares",
  pricingType: "PERCENTUAL",
  minQuantity: 10,
  maxQuantity: null,
  priceCents: null,
  discountPercent: 15,
  active: true,
};

const item = (index: number, basePriceCents = 4500): ItemPreco => ({
  seatId: `assento-${index}`,
  ticketTypeId: "ingresso-adulto",
  participantIndex: index,
  basePriceCents,
});

describe("calcularPrecoPedido", () => {
  it("não aplica desconto a 9 lugares", () => {
    const resultado = calcularPrecoPedido({
      items: Array.from({ length: 9 }, (_, index) => item(index)),
      offers: [ofertaPercentual],
    });

    expect(resultado).toMatchObject({ subtotalCents: 40500, discountCents: 0, totalCents: 40500, appliedOffer: null });
  });

  it("aplica 15% a 10 adultos", () => {
    const resultado = calcularPrecoPedido({
      items: Array.from({ length: 10 }, (_, index) => item(index)),
      offers: [ofertaPercentual],
    });

    expect(resultado).toMatchObject({ subtotalCents: 45000, discountCents: 6750, totalCents: 38250 });
    expect(resultado.items.every((item) => item.allocatedDiscountCents === 675)).toBe(true);
  });

  it("mantém a oferta elegível com 11 lugares", () => {
    const resultado = calcularPrecoPedido({
      items: Array.from({ length: 11 }, (_, index) => item(index)),
      offers: [ofertaPercentual],
    });

    expect(resultado.discountCents).toBe(7425);
    expect(resultado.totalCents).toBe(42075);
    expect(resultado.appliedOffer?.id).toBe(ofertaPercentual.id);
  });

  it("calcula o percentual sobre todos os tipos no pedido misto", () => {
    const items = [
      ...Array.from({ length: 6 }, (_, index) => item(index, 4500)),
      ...Array.from({ length: 4 }, (_, index) => item(index + 6, 2250)),
    ];
    const resultado = calcularPrecoPedido({ items, offers: [ofertaPercentual] });

    expect(resultado).toMatchObject({ subtotalCents: 36000, discountCents: 5400, totalCents: 30600 });
  });

  it("ignora oferta inativa e faixa incompatível", () => {
    const inativa = { ...ofertaPercentual, active: false };
    const faixa = { ...ofertaPercentual, minQuantity: 12, maxQuantity: 15 };
    const items = Array.from({ length: 10 }, (_, index) => item(index));

    expect(calcularPrecoPedido({ items, offers: [inativa] }).discountCents).toBe(0);
    expect(calcularPrecoPedido({ items, offers: [faixa] }).discountCents).toBe(0);
  });

  it("preserva o resumo de uma oferta elegível mesmo com desconto zero", () => {
    const ofertaSemDesconto = { ...ofertaPercentual, discountPercent: 0 };
    const resultado = calcularPrecoPedido({
      items: Array.from({ length: 10 }, (_, index) => item(index)),
      offers: [ofertaSemDesconto],
    });

    expect(resultado.discountCents).toBe(0);
    expect(resultado.appliedOffer).toMatchObject({ id: ofertaSemDesconto.id, discountPercent: 0 });
  });

  it("trata priceCents de VALOR_FIXO como preço total da faixa", () => {
    const ofertaFixa: OfertaPreco = { ...ofertaPercentual, pricingType: "VALOR_FIXO", priceCents: 30000, discountPercent: null };
    const resultado = calcularPrecoPedido({
      items: Array.from({ length: 10 }, (_, index) => item(index)),
      offers: [ofertaFixa],
    });

    expect(resultado).toMatchObject({ subtotalCents: 45000, discountCents: 15000, totalCents: 30000 });
  });

  it("não aplica oferta quando o total fica abaixo do mínimo", () => {
    const resultado = calcularPrecoPedido({
      items: Array.from({ length: 10 }, (_, index) => item(index, 100)),
      offers: [ofertaPercentual],
      minimumTotalCents: 1000,
    });

    expect(resultado).toMatchObject({ subtotalCents: 1000, discountCents: 0, totalCents: 1000, appliedOffer: null });
  });

  it("rateia centavos pelo maior resto, com desempate determinístico", () => {
    const ofertaFixa: OfertaPreco = { ...ofertaPercentual, minQuantity: 2, pricingType: "VALOR_FIXO", priceCents: 170, discountPercent: null };
    const resultado = calcularPrecoPedido({
      items: [item(1, 101), item(0, 100)],
      offers: [ofertaFixa],
    });

    expect(resultado.discountCents).toBe(31);
    expect(resultado.items.map((item) => item.allocatedDiscountCents)).toEqual([16, 15]);
    expect(resultado.items.reduce((sum, item) => sum + item.totalPriceCents, 0)).toBe(170);
  });
});

  it("aplica oferta e depois cupom percentual, somando descontos", () => {
    const cupom = { id: "cupom-10", version: 1, code: "DEZ", pricingType: "PERCENTUAL" as const, discountPercent: 10, discountCents: null, active: true };
    const resultado = calcularPrecoPedido({ items: Array.from({ length: 10 }, (_, index) => item(index)), offers: [ofertaPercentual], coupon: cupom });
    expect(resultado).toMatchObject({ subtotalCents: 45000, offerDiscountCents: 6750, couponDiscountCents: 3825, discountCents: 10575, totalCents: 34425 });
    expect(resultado.appliedCoupon).toMatchObject({ id: cupom.id, code: "DEZ" });
    expect(resultado.items.reduce((sum, current) => sum + current.totalPriceCents, 0)).toBe(34425);
  });

  it("limita cupom fixo ao restante, permite 100% e mantém total zero", () => {
    const cupom = { id: "cupom-100", version: 1, code: "GRATIS", pricingType: "PERCENTUAL" as const, discountPercent: 100, discountCents: null, active: true };
    const resultado = calcularPrecoPedido({ items: [item(0, 1)], offers: [], coupon: cupom });
    expect(resultado).toMatchObject({ subtotalCents: 1, couponDiscountCents: 1, discountCents: 1, totalCents: 0 });
  });

  it("rejeita total positivo entre 1 e 99 centavos", () => {
    expect(() => calcularPrecoPedido({ items: [item(0, 50)], offers: [], minimumTotalCents: 100 })).not.toThrow();
    expect(calcularPrecoPedido({ items: [item(0, 50)], offers: [], minimumTotalCents: 100 }).totalCents).toBe(50);
  });

  it("não rateia desconto para item gratuito", () => {
    const resultado = calcularPrecoPedido({
      items: [item(0, 0), item(1, 100)],
      offers: [],
      coupon: { id: "cupom", version: 1, code: "FIXO", pricingType: "VALOR_FIXO", discountPercent: null, discountCents: 1, active: true },
    });
    expect(resultado.totalCents).toBe(99);
    expect(resultado.items.map((item) => item.totalPriceCents)).toEqual([0, 99]);
    expect(resultado.items.map((item) => item.allocatedCouponDiscountCents)).toEqual([0, 1]);
  });

  it("aplica cupom fixo e rateia centavos sequencialmente após oferta", () => {
    const resultado = calcularPrecoPedido({
      items: [item(0, 101), item(1, 100), item(2, 99)],
      offers: [{ ...ofertaPercentual, minQuantity: 1, discountPercent: 10 }],
      coupon: { id: "cupom", version: 1, code: "FIXO", pricingType: "VALOR_FIXO", discountPercent: null, discountCents: 7, active: true },
    });
    expect(resultado.offerDiscountCents).toBe(30);
    expect(resultado.couponDiscountCents).toBe(7);
    expect(resultado.discountCents).toBe(37);
    expect(resultado.items.reduce((sum, current) => sum + current.totalPriceCents, 0)).toBe(263);
    expect(resultado.items.reduce((sum, current) => sum + current.allocatedCouponDiscountCents, 0)).toBe(7);
  });
