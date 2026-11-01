// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PoliticaPublica } from "@essencia/shared/types";
import { FormularioCheckout, aceitesCompletos, deveInvalidarChaveReserva } from "../formulario-checkout";
import { normalizarTiposPorAssento } from "../../lib/checkout-utils";
import * as eventosApi from "../../lib/eventos-api";
import { EventosApiError } from "../../lib/eventos-api";

const politicas: PoliticaPublica[] = [
  "PRIVACIDADE",
  "COMPRA",
  "CANCELAMENTO_REEMBOLSO",
  "ACESSIBILIDADE",
  "CONTATO",
].map((type, index) => ({ type: type as PoliticaPublica["type"], version: index + 1, content: `Conteúdo ${type}` }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function preencherCheckout() {
  fireEvent.change(screen.getByRole("textbox", { name: "Nome completo" }), { target: { value: "Ana da Silva" } });
  fireEvent.change(screen.getByRole("textbox", { name: "E-mail" }), { target: { value: "ana@example.com" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Telefone" }), { target: { value: "11999999999" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Nome do participante do seat-1" }), { target: { value: "Miguel da Silva" } });
  for (const checkbox of screen.getAllByRole("checkbox")) fireEvent.click(checkbox);
}

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
    const source = readFileSync("components/formulario-checkout.tsx", "utf8");
    expect(source).toContain("reservationKeyRef.current = null");
  });

  it("alinha um tipo único a todos os assentos", () => {
    expect(normalizarTiposPorAssento(["A-1", "A-2"], ["inteira"])).toEqual(["inteira", "inteira"]);
    expect(normalizarTiposPorAssento(["A-1", "A-2"], ["inteira", "meia"])).toEqual(["inteira", "meia"]);
  });

  it("rejeita quantidade de tipos desalinhada sem fallback único", () => {
    expect(() => normalizarTiposPorAssento([], ["inteira"])).toThrow("tipos de ingresso");
    expect(() => normalizarTiposPorAssento(["A-1", "A-2"], [])).toThrow("tipos de ingresso");
    expect(() => normalizarTiposPorAssento(["A-1", "A-2"], ["inteira", "meia", "cortesia"])).toThrow("tipos de ingresso");
  });

  it("mostra o resumo de sessão, assentos e tipos escolhidos", () => {
    const html = renderToStaticMarkup(
      <FormularioCheckout seatIds={["A-1", "A-2"]} ticketTypeIds={["inteira", "meia"]} sessionId="sessao-1" politicas={politicas} />,
    );
    expect(html).toContain("Sessão selecionada");
    expect(html).toContain("A-1");
    expect(html).toContain("Ingresso selecionado");
    expect(html).not.toContain("Sessão: sessao-1");
    expect(html).not.toContain("Assento A-1: inteira");
  });

  it("mostra contexto público quando o fluxo fornece evento, sessão e ingressos", async () => {
    const html = renderToStaticMarkup(<FormularioCheckout
      seatIds={["seat-1"]}
      ticketTypeIds={["meia"]}
      sessionId="sessao-1"
      event={{ title: "Festival da Família", startsAt: "2026-06-20T02:00:00.000Z" as unknown as Date, locationName: "Pátio central" }}
      session={{ id: "sessao-1", startsAt: "2026-06-20T02:00:00.000Z" as unknown as Date, endsAt: "2026-06-20T04:00:00.000Z" as unknown as Date, status: "PUBLICADA", capacity: 10, location: { name: "Pátio central", address: "Rua A", room: null, instructions: null, accessibility: null }, mapId: "map-1", salesStartsAt: null, salesEndsAt: null, availability: "available", ticketTypes: [{ id: "meia", name: "Meia-entrada", description: "Com comprovante", priceCents: 500, maxPerOrder: 2, eligibility: "Estudantes" }] }}
      politicas={politicas}
    />);
    expect(html).toContain("Festival da Família");
    expect(html).toContain("Pátio central");
    expect(html).toContain("Meia-entrada");
    expect(html).toContain("R$ 5,00");
    expect(html).not.toContain("sessao-1");
    expect(html).not.toContain("ticketTypeId");
  });

  it("exibe o conflito e o retorno explícito ao mapa quando um assento fica indisponível", async () => {
    vi.spyOn(eventosApi, "reservarAssentos").mockRejectedValue(new EventosApiError("Um dos assentos selecionados ficou indisponível. Escolha novamente.", 409, "SEAT_UNAVAILABLE"));
    render(<FormularioCheckout seatIds={["seat-1"]} ticketTypeIds={["ticket-1"]} sessionId="sessao-1" mapHref="/evento/ballet/sessao/sessao-1?assentos=seat-1&ticketTypeIds=ticket-1&conflito=disponibilidade" politicas={politicas} />);
    preencherCheckout();

    fireEvent.submit(screen.getByRole("button", { name: "Finalizar pedido" }).closest("form")!);

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("indisponível"));
    const revisar = screen.getByRole("link", { name: "Revisar assentos" });
    expect(revisar.getAttribute("href")).toContain("conflito=disponibilidade");
  });

  it("não oferece retorno ao mapa para outro erro 409", async () => {
    vi.spyOn(eventosApi, "reservarAssentos").mockRejectedValue(new EventosApiError("Conflito de idempotência", 409, "IDEMPOTENCY_CONFLICT"));
    render(<FormularioCheckout seatIds={["seat-1"]} ticketTypeIds={["ticket-1"]} sessionId="sessao-1" mapHref="/evento/ballet/sessao/sessao-1?assentos=seat-1&ticketTypeIds=ticket-1&conflito=disponibilidade" politicas={politicas} />);
    preencherCheckout();

    fireEvent.submit(screen.getByRole("button", { name: "Finalizar pedido" }).closest("form")!);

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("idempotência"));
    expect(screen.queryByRole("link", { name: "Revisar assentos" })).toBeNull();
  });
});
