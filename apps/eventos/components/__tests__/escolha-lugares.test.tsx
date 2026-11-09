// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicEventDetail, PublicEventSession, PublicMap } from "@essencia/shared/types";
import * as eventosApi from "../../lib/eventos-api";
import { EscolhaLugares } from "../escolha/escolha-lugares";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("../../lib/eventos-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/eventos-api")>("../../lib/eventos-api");
  return { ...actual, reservarAssentos: vi.fn(), obterMapaSessao: vi.fn() };
});

const evento: PublicEventDetail = { id: "evento", slug: "festival", title: "Festival", summary: "Resumo", description: null, imageUrl: null, category: "Música", startsAt: new Date("2026-12-07T19:00:00Z"), locationName: "Auditório", fromPriceCents: 4500, availability: "available", contactEmail: null, contactPhone: null, cancellationPolicy: null };
const sessao: PublicEventSession = { id: "sessao", startsAt: new Date("2026-12-07T19:00:00Z"), endsAt: new Date("2026-12-07T21:00:00Z"), status: "PUBLICADA", capacity: 21, location: null, mapId: "mapa", salesStartsAt: null, salesEndsAt: null, availability: "available", ticketTypes: [{ id: "inteira", name: "Inteira", description: null, priceCents: 4500, maxPerOrder: null, eligibility: null }, { id: "meia", name: "Meia-entrada", description: null, priceCents: 2250, maxPerOrder: null, eligibility: "Estudantes" }], offers: [] };
const mapa: PublicMap = { sessionId: "sessao", mapId: "mapa", seats: Array.from({ length: 21 }, (_, index) => ({ id: `s-${index + 1}`, sessionId: "sessao", rowLabel: "G", seatNumber: String(index + 19), x: index * 10, y: 0, width: 8, height: 8, category: "COMUM", accessible: false, state: "available" as const })) };

afterEach(cleanup);

describe("EscolhaLugares", () => {
  it("seleciona lugares, exige tipo quando há dois e impede o 21º", () => {
    render(<EscolhaLugares evento={evento} sessao={sessao} map={mapa} />);
    fireEvent.click(screen.getByRole("button", { name: /Fileira G, assento 19/ }));
    expect(screen.getByText("Escolha Inteira ou Meia-entrada em cada lugar")).toBeTruthy();
    const resumo = screen.getByRole("region", { name: /Resumo dos lugares/ });
    fireEvent.click(within(resumo).getByRole("radio", { name: /Inteira/ }));
    for (let index = 20; index <= 39; index += 1) {
      const button = screen.queryByRole("button", { name: new RegExp(`assento ${index}`) });
      if (button) fireEvent.click(button);
    }
    expect(screen.getByText(/máximo 20 lugares/i)).toBeTruthy();
  }, 15000);

  it("alterna para lista e vibra ao marcar", () => {
    Object.defineProperty(window.navigator, "vibrate", { configurable: true, value: vi.fn() });
    render(<EscolhaLugares evento={evento} sessao={sessao} map={mapa} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver lugares em lista/ }));
    expect(screen.getByRole("region", { name: /Lugares disponíveis/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Selecionar G19/ }));
    expect(window.navigator.vibrate).toHaveBeenCalledWith(10);
  });
});
