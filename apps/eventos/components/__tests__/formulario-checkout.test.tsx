import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { PoliticaPublica } from "@essencia/shared/types";
import { FormularioCheckout, aceitesCompletos, deveInvalidarChaveReserva } from "../formulario-checkout";
import { EventosApiError } from "../../lib/eventos-api";

const politicas: PoliticaPublica[] = [
  "PRIVACIDADE",
  "COMPRA",
  "CANCELAMENTO_REEMBOLSO",
  "ACESSIBILIDADE",
  "CONTATO",
].map((type, index) => ({ type: type as PoliticaPublica["type"], version: index + 1, content: `Conteúdo ${type}` }));

describe("formulário de checkout público", () => {
  it("exige comprador, participantes e todos os aceites das políticas ativas", () => {
    const html = renderToStaticMarkup(
      <FormularioCheckout seatIds={["seat-1"]} ticketTypeIds={["ticket-1"]} politicas={politicas} onComplete={vi.fn()} />,
    );
    expect(html).toContain('name="buyerName"');
    expect(html).toContain('name="buyerEmail"');
    expect(html).toContain('name="buyerPhone"');
    expect(html).toContain('name="participant-0-fullName"');
    expect(html).toContain("Conteúdo PRIVACIDADE");
    expect(html).toContain("Versão 1");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("Finalizar pedido");
  });

  it("só considera o conjunto completo de cinco aceites como válido", () => {
    expect(aceitesCompletos([])).toBe(false);
    expect(aceitesCompletos(politicas.map((policy) => ({ type: policy.type, version: policy.version })))).toBe(true);
    expect(aceitesCompletos([...politicas, { type: "COMPRA" as const, version: 2 }].map((policy) => ({ type: policy.type, version: policy.version })))).toBe(false);
    expect(aceitesCompletos(politicas.map((policy) => ({ type: policy.type, version: 0 })))).toBe(false);
  });

  it("distingue pedido encerrado de conflito transitório ao regenerar a reserva", () => {
    expect(deveInvalidarChaveReserva(new EventosApiError("Pedido expirado", 400, "ORDER_NOT_AVAILABLE"))).toBe(true);
    expect(deveInvalidarChaveReserva(new EventosApiError("Pedido não encontrado", 404, "ORDER_NOT_FOUND"))).toBe(true);
    expect(deveInvalidarChaveReserva(new EventosApiError("Assento indisponível", 409, "SEAT_UNAVAILABLE"))).toBe(false);
    const source = readFileSync(new URL("../formulario-checkout.tsx", import.meta.url), "utf8");
    expect(source).toContain("reservationKeyRef.current = null");
  });
});
