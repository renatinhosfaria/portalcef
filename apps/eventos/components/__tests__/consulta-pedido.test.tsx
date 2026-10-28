import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { ConsultaPedido } from "../consulta-pedido";

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
    const html = renderToStaticMarkup(<ConsultaPedido initialOrderNumber="ABC123DEF456" initialResult={{ orderNumber: "ABC123DEF456", status: "AGUARDANDO_PAGAMENTO", eventTitle: "Festival", session: { startsAt: new Date("2026-01-01T10:00:00Z"), endsAt: new Date("2026-01-01T12:00:00Z") }, totalCents: 1000, items: [] }} />);
    expect(html).toContain("Pagamento pendente");
  });
});
