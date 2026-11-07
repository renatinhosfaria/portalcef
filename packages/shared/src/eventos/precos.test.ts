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
