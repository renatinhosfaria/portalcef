// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicEventDetail, PublicEventSession, PublicMap } from "@essencia/shared/types";
import * as eventosApi from "../../lib/eventos-api";
import { EscolhaLugares } from "../escolha/escolha-lugares";

const routerPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));

const sessionId = "00000000-0000-4000-8000-000000000001";
const seatId = "00000000-0000-4000-8000-000000000002";
const ticketTypeId = "00000000-0000-4000-8000-000000000003";
const evento: PublicEventDetail = { id: "00000000-0000-4000-8000-000000000010", slug: "festival", title: "Festival", summary: "Resumo", description: null, imageUrl: null, category: "Música", startsAt: new Date("2026-12-07T19:00:00Z"), locationName: "Auditório", fromPriceCents: 4500, availability: "available", contactEmail: null, contactPhone: null, cancellationPolicy: null };
const mapId = "00000000-0000-4000-8000-000000000011";
const sessao: PublicEventSession = { id: sessionId, startsAt: new Date("2026-12-07T19:00:00Z"), endsAt: new Date("2026-12-07T21:00:00Z"), status: "PUBLICADA", capacity: 1, location: null, mapId, salesStartsAt: null, salesEndsAt: null, availability: "available", ticketTypes: [{ id: ticketTypeId, name: "Inteira", description: null, priceCents: 4500, maxPerOrder: null, eligibility: null }], offers: [] };
const mapa: PublicMap = { sessionId, mapId, seats: [{ id: seatId, sessionId, rowLabel: "G", seatNumber: "19", x: 0, y: 0, width: 8, height: 8, category: "COMUM", accessible: false, state: "available" }] };

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("retry da seleção pública", () => {
  it("reutiliza a chave da seleção ao repetir após falha de rede", async () => {
    vi.spyOn(eventosApi, "obterMapaSessao").mockResolvedValue(mapa);
    const resultado = { reservationId: "00000000-0000-4000-8000-000000000500", orderNumber: "ABC123DEF456", expiresAt: new Date().toISOString(), subtotalCents: 4500, discountCents: 0, totalCents: 4500, appliedOffer: null, items: [] };
    let tentativa = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      tentativa += 1;
      if (tentativa === 1) throw new TypeError("resposta perdida");
      return new Response(JSON.stringify(resultado), { status: 200 });
    });

    render(<EscolhaLugares evento={evento} sessao={sessao} map={mapa} />);
    fireEvent.click(screen.getByRole("button", { name: /Fileira G, assento 19/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Continuar" })[0]!);
    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível guardar");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/checkout?pedido=ABC123DEF456&slug=festival&sessionId=" + encodeURIComponent(sessionId)));
    const firstKey = (fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>)["Idempotency-Key"];
    const secondKey = (fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string>)["Idempotency-Key"];
    expect(firstKey).toBeTruthy();
    expect(secondKey).toBe(firstKey);
  });
});
