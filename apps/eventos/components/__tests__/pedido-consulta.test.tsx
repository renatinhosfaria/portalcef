// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConsultaPedido, ehStatusPendentePedido, INTERVALO_POLLING_MS, MAX_TENTATIVAS_POLLING, PedidoPublicoStatus } from "../consulta-pedido";
import { formatarDataPublica } from "../../lib/eventos-formatters";
import type { ConsultaPedidoPublica } from "@essencia/shared/types";

const apiMocks = vi.hoisted(() => ({ consultarPedido: vi.fn() }));
vi.mock("../../lib/eventos-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/eventos-api")>("../../lib/eventos-api");
  return { ...actual, consultarPedido: apiMocks.consultarPedido };
});

const resultado: ConsultaPedidoPublica = {
  orderNumber: "ABC123DEF456",
  status: "AGUARDANDO_PAGAMENTO",
  eventTitle: "Festival",
  session: { startsAt: new Date("2026-01-01T10:00:00Z"), endsAt: new Date("2026-01-01T12:00:00Z") },
  subtotalCents: 1000,
  discountCents: 0,
  totalCents: 1000,
  appliedOffer: null,
  items: [],
};

describe("consulta canônica de pedido", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    apiMocks.consultarPedido.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

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

  it("limita polling enquanto o pedido permanece pendente", async () => {
    apiMocks.consultarPedido.mockResolvedValue({ ...resultado });
    render(<ConsultaPedido initialOrderNumber="ABC123DEF456" initialResult={resultado} autoAtualizar />);

    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_POLLING_MS * (MAX_TENTATIVAS_POLLING + 1)); });

    expect(apiMocks.consultarPedido).toHaveBeenCalledTimes(MAX_TENTATIVAS_POLLING);
    expect(screen.getByText("Atualizar agora")).toBeTruthy();
  });

  it("para o polling assim que recebe status conclusivo", async () => {
    apiMocks.consultarPedido.mockResolvedValueOnce({ ...resultado, status: "PAGO" });
    render(<ConsultaPedido initialOrderNumber="ABC123DEF456" initialResult={resultado} autoAtualizar />);

    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_POLLING_MS); });
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_POLLING_MS * MAX_TENTATIVAS_POLLING); });

    expect(apiMocks.consultarPedido).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Pago")).toBeTruthy();
  });

  it("não consulta depois do unmount nem enquanto o número inicial é editado", async () => {
    apiMocks.consultarPedido.mockResolvedValue({ ...resultado });
    const view = render(<ConsultaPedido initialOrderNumber="ABC123DEF456" initialResult={resultado} autoAtualizar />);
    fireEvent.change(screen.getByRole("textbox", { name: "Número do pedido" }), { target: { value: "OUTRO999" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_POLLING_MS); });
    expect(apiMocks.consultarPedido).not.toHaveBeenCalled();

    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_POLLING_MS * MAX_TENTATIVAS_POLLING); });
    expect(apiMocks.consultarPedido).not.toHaveBeenCalled();
  });

  it("mostra o retorno do Stripe mesmo sem resultado inicial", () => {
    render(<ConsultaPedido initialOrderNumber="ABC123DEF456" retorno="sucesso" />);
    expect(screen.getByText(/Pagamento recebido/)).toBeTruthy();
    expect(apiMocks.consultarPedido).not.toHaveBeenCalled();
  });

  it("formata o horário da sessão no fuso de São Paulo", () => {
    expect(formatarDataPublica("2026-01-01T10:00:00.000Z", { hour: "2-digit", minute: "2-digit" })).toContain("07:00");
  });

});
