// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IngressoPublico, PedidoComIngressos } from "@essencia/shared/types";
import * as pdfIngresso from "../../lib/pdf-ingresso";
import { AcoesIngresso } from "../ingressos/acoes-ingresso";

vi.mock("../../lib/pdf-ingresso", async () => {
  const atual = await vi.importActual<typeof import("../../lib/pdf-ingresso")>("../../lib/pdf-ingresso");
  return { ...atual, compartilharOuBaixar: vi.fn(), gerarPdfIngressos: vi.fn() };
});

const ingresso: IngressoPublico = {
  numero: "K7Q482MX",
  qrPayload: "qr-secreto",
  rowLabel: "B",
  seatNumber: "12",
  ticketTypeName: "Inteira",
  participantName: "Beatriz Souza",
  status: "ATIVO",
};

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
  tickets: [ingresso],
};

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(pdfIngresso.gerarPdfIngressos).mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
  vi.mocked(pdfIngresso.compartilharOuBaixar).mockResolvedValue("compartilhado");
});

describe("AcoesIngresso", () => {
  it("mostra download individual e compartilhamento do PDF", () => {
    render(<AcoesIngresso pedido={pedido} ingresso={ingresso} indice={0} total={1} />);

    expect(screen.getByRole("button", { name: "Baixar ingresso" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Compartilhar PDF" })).toBeTruthy();
  });

  it("gera e baixa somente o ingresso selecionado", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<AcoesIngresso pedido={pedido} ingresso={ingresso} indice={0} total={1} />);

    fireEvent.click(screen.getByRole("button", { name: "Baixar ingresso" }));

    await waitFor(() => expect(pdfIngresso.gerarPdfIngressos).toHaveBeenCalledWith(pedido, [ingresso]));
    expect(click).toHaveBeenCalled();
  });

  it("compartilha o arquivo PDF gerado", async () => {
    render(<AcoesIngresso pedido={pedido} ingresso={ingresso} indice={0} total={1} />);

    fireEvent.click(screen.getByRole("button", { name: "Compartilhar PDF" }));

    await waitFor(() => expect(pdfIngresso.compartilharOuBaixar).toHaveBeenCalledWith(expect.any(File)));
    expect(pdfIngresso.gerarPdfIngressos).toHaveBeenCalledWith(pedido, [ingresso]);
  });
});
