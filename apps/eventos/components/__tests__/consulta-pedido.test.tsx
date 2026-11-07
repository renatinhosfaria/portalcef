import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { ConsultaPedido, ehStatusPendentePedido, rotuloStatusPedido } from "../consulta-pedido";

describe("consulta pública de pedido", () => {
  it("consulta somente por número e não renderiza campos de PII", () => {
    const html = renderToStaticMarkup(<ConsultaPedido onResult={vi.fn()} />);
    expect(html).toContain('name="orderNumber"');
    expect(html).not.toContain('name="email"');
    expect(html).not.toContain('name="password"');
    expect(html).not.toContain("/eventos-admin");
    expect(html).toContain("Consultar pedido");
  });

  it("mostra pagamento pendente enquanto aguarda o webhook", () => {
    const html = renderToStaticMarkup(<ConsultaPedido initialOrderNumber="ABC123DEF456" initialResult={{ orderNumber: "ABC123DEF456", status: "AGUARDANDO_PAGAMENTO", eventTitle: "Festival", session: { startsAt: new Date("2026-01-01T10:00:00Z"), endsAt: new Date("2026-01-01T12:00:00Z") }, subtotalCents: 1000, discountCents: 0, totalCents: 1000, appliedOffer: null, items: [] }} />);
    expect(html).toContain("Pagamento pendente");
  });

  it("encerra a indicação de pendência em estados conclusivos", () => {
    expect(ehStatusPendentePedido("INICIADO")).toBe(true);
    expect(ehStatusPendentePedido("RESERVADO")).toBe(true);
    expect(ehStatusPendentePedido("AGUARDANDO_PAGAMENTO")).toBe(true);
    expect(ehStatusPendentePedido("PAGO")).toBe(false);
    expect(rotuloStatusPedido("PAGO")).toBe("Pago");
    expect(rotuloStatusPedido("CANCELADO")).toBe("Cancelado");
    expect(rotuloStatusPedido("EXPIRADO")).toBe("Expirado");
  });
});
