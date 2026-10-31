import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it } from "vitest";
import { ConsultaPedido, ehStatusPendentePedido, PedidoPublicoStatus } from "../consulta-pedido";
import type { ConsultaPedidoPublica } from "@essencia/shared/types";

const resultado: ConsultaPedidoPublica = {
  orderNumber: "ABC123DEF456",
  status: "AGUARDANDO_PAGAMENTO",
  eventTitle: "Festival",
  session: { startsAt: new Date("2026-01-01T10:00:00Z"), endsAt: new Date("2026-01-01T12:00:00Z") },
  totalCents: 1000,
  items: [],
};

describe("consulta canônica de pedido", () => {
  it("consulta somente por número e não renderiza campos de PII", () => {
    const html = renderToStaticMarkup(<ConsultaPedido onResult={() => undefined} />);
    expect(html).toContain('name="orderNumber"');
    expect(html).not.toContain('name="email"');
    expect(html).not.toContain('name="password"');
    expect(html).not.toContain("/eventos-admin");
    expect(html).toContain("Consultar pedido");
  });

  it("mostra pagamento pendente enquanto aguarda o webhook", () => {
    const html = renderToStaticMarkup(<ConsultaPedido initialOrderNumber="ABC123DEF456" initialResult={resultado} />);
    expect(html).toContain("Pagamento pendente");
  });

  it("classifica estados de reserva e pagamento como pendentes", () => {
    expect(ehStatusPendentePedido("INICIADO")).toBe(true);
    expect(ehStatusPendentePedido("RESERVADO")).toBe(true);
    expect(ehStatusPendentePedido("AGUARDANDO_PAGAMENTO")).toBe(true);
    expect(ehStatusPendentePedido("PAGO")).toBe(false);
    expect(ehStatusPendentePedido("CANCELADO")).toBe(false);
  });

  it("apresenta retorno do Stripe sem expor PII ou links administrativos", () => {
    const html = renderToStaticMarkup(<PedidoPublicoStatus result={{ ...resultado, status: "PAGO" }} retorno="sucesso" />);
    expect(html).toContain("Pagamento recebido");
    expect(html).not.toContain("@example.com");
    expect(html).not.toContain("/eventos-admin");
    expect(html).not.toContain("telefone");
  });

  it("configura polling limitado e cancelável no cleanup", () => {
    const source = readFileSync(new URL("../consulta-pedido.tsx", import.meta.url), "utf8");
    expect(source).toContain("MAX_TENTATIVAS_POLLING");
    expect(source).toContain("clearTimeout");
    expect(source).toContain("autoAtualizar");
  });

  it("mantém a rota canônica de consulta sem número inicial", () => {
    const source = readFileSync(new URL("../../app/pedido/consulta/page.tsx", import.meta.url), "utf8");
    expect(source).toContain("<ConsultaPedido />");
    expect(source).not.toContain("searchParams");
  });
});
