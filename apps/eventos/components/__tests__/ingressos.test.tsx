// @vitest-environment jsdom

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PedidoComIngressos } from "@essencia/shared/types";
import { EventosApiError } from "../../lib/eventos-api";
import * as eventosApi from "../../lib/eventos-api";
import { CartaoIngresso } from "../ingressos/cartao-ingresso";
import { PaginaIngressos } from "../ingressos/pagina-ingressos";
import { QrIngresso } from "../ingressos/qr-ingresso";
import OrderPage from "../../app/pedido/[orderNumber]/page";

vi.mock("../../lib/eventos-api", async () => {
  const atual = await vi.importActual<typeof import("../../lib/eventos-api")>("../../lib/eventos-api");
  return { ...atual, obterIngressos: vi.fn() };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../../lib/eventos-api-servidor", () => ({ obterIngressosServidor: vi.fn() }));

const pedido: PedidoComIngressos = {
  orderNumber: "G21",
  status: "CONFIRMADO",
  eventTitle: "Festival da Família",
  eventSlug: "festival-da-familia",
  sessionId: "sessao-1",
  expiresAt: null,
  session: { startsAt: new Date("2026-12-07T19:00:00.000Z"), endsAt: new Date("2026-12-07T21:00:00.000Z") },
  subtotalCents: 10000,
  discountCents: 0,
  totalCents: 10000,
  appliedOffer: null,
  items: [],
  buyerName: "Ana Souza",
  event: { title: "Festival da Família", slug: "festival-da-familia", imageUrl: null, locationName: "Teatro Essência" },
  tickets: [{ numero: "K7Q482MX", qrPayload: "qr-secreto", rowLabel: "B", seatNumber: "12", ticketTypeName: "Inteira", participantName: "Beatriz Souza", status: "ATIVO" }],
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("cartões de ingressos", () => {
  it("mostra número formatado, fileira, assento, tipo e participante", () => {
    render(<CartaoIngresso pedido={pedido} ingresso={pedido.tickets[0]!} indice={0} total={1} />);
    expect(screen.getByText("K7Q4-82MX")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("Inteira")).toBeTruthy();
    expect(screen.getByText("Beatriz Souza")).toBeTruthy();
    expect(screen.getByText("Festival da Família")).toBeTruthy();
  });

  it("renderiza o QR como SVG do conteúdo", async () => {
    const { container } = render(<QrIngresso conteudo="qr-secreto" tamanho={180} />);
    await waitFor(() => expect(container.querySelector("svg")).toBeTruthy());
    expect(container.querySelector("svg")?.getAttribute("xmlns")).toBe("http://www.w3.org/2000/svg");
  });
});

describe("página de ingressos", () => {
  it("mostra confirmando e consulta de novo enquanto o pedido está pendente", async () => {
    vi.useFakeTimers();
    vi.mocked(eventosApi.obterIngressos).mockResolvedValueOnce({ ...pedido, status: "PENDENTE", tickets: [] }).mockResolvedValueOnce(pedido);
    render(<PaginaIngressos inicial={{ ...pedido, status: "PENDENTE", tickets: [] }} orderNumber="G21" acesso="segredo" />);
    expect(screen.getByText("Confirmando seu pagamento…")).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(2000); await Promise.resolve(); await Promise.resolve(); });
    expect(eventosApi.obterIngressos).toHaveBeenCalledWith("G21", "segredo");
  });

  it("não expõe QR ou número em pedido sem acesso", () => {
    render(<PaginaIngressos inicial={pedido} orderNumber="G21" acesso="" />);
    expect(screen.getByText(/Meus ingressos/i)).toBeTruthy();
    expect(screen.queryByText("K7Q4-82MX")).toBeNull();
    expect(screen.queryByText("qr-secreto")).toBeNull();
  });

  it("mostra cancelamento com link de volta ao evento", () => {
    render(<PaginaIngressos inicial={{ ...pedido, status: "CANCELADO", tickets: [] }} orderNumber="G21" acesso="segredo" />);
    expect(screen.getByText(/pedido foi cancelado/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /voltar ao evento/i }).getAttribute("href")).toBe("/evento/festival-da-familia");
  });
});

it("mantém a mensagem genérica para token inválido", () => {
  const erro = new EventosApiError("não revelar", 404);
  expect(erro.status).toBe(404);
});

it("token inválido mostra o formulário com o número preenchido", async () => {
  const { obterIngressosServidor } = await import("../../lib/eventos-api-servidor");
  vi.mocked(obterIngressosServidor).mockRejectedValueOnce(new EventosApiError("interno", 404));
  const tela = await OrderPage({ params: Promise.resolve({ orderNumber: "G21" }), searchParams: Promise.resolve({ acesso: "vencido" }) });
  render(tela);
  expect(screen.getByText("Não conseguimos abrir seus ingressos por este link.")).toBeTruthy();
  expect((screen.getByLabelText("Número do pedido") as HTMLInputElement).value).toBe("G21");
  expect(screen.queryByText("K7Q4-82MX")).toBeNull();
});
