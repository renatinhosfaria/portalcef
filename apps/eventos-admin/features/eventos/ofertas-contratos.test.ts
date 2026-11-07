// @vitest-environment jsdom

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OfertaEditor } from "./oferta-editor";
import {
  construirPayloadOferta,
  ofertaProntaParaSalvar,
  type OfertaValue,
} from "./ofertas-contratos";

const ofertaBase: OfertaValue = {
  id: "oferta-1",
  name: "Desconto para grupos",
  pricingType: "PERCENTUAL",
  minQuantity: 10,
  maxQuantity: null,
  discountPercent: 15,
  priceCents: null,
  version: 2,
  active: true,
};

describe("contrato de ofertas do painel", () => {
  it("produz o payload percentual de 15% a partir de 10 lugares", () => {
    expect(construirPayloadOferta(ofertaBase)).toEqual({
      id: "oferta-1",
      name: "Desconto para grupos",
      pricingType: "PERCENTUAL",
      minQuantity: 10,
      maxQuantity: null,
      discountPercent: 15,
      priceCents: null,
      active: true,
    });
  });

  it("bloqueia máximo menor que o mínimo e percentual fora da faixa", () => {
    expect(ofertaProntaParaSalvar({ ...ofertaBase, maxQuantity: 9 })).toBe(false);
    expect(ofertaProntaParaSalvar({ ...ofertaBase, discountPercent: 101 })).toBe(false);
    expect(ofertaProntaParaSalvar({ ...ofertaBase, discountPercent: -1 })).toBe(false);
  });

  it("aceita oferta arquivada sem contar como oferta ativa", () => {
    expect(ofertaProntaParaSalvar([{ ...ofertaBase, active: false }, { ...ofertaBase, id: undefined, active: true }])).toBe(true);
  });

  it("bloqueia duas ofertas ativas no mesmo evento", () => {
    expect(ofertaProntaParaSalvar([ofertaBase, { ...ofertaBase, id: "oferta-2" }])).toBe(false);
  });
});

describe("OfertaEditor", () => {
  it("renderiza o resumo da regra em português", () => {
    const html = renderToStaticMarkup(React.createElement(OfertaEditor, { initialValue: ofertaBase, onChange: vi.fn() }));

    expect(html).toContain("15% a partir de 10 lugares");
    expect(html).toContain("Desconto para grupos");
    expect(html).toContain("Oferta ativa");
  });
});
