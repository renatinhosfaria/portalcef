// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicEventDetail, PublicEventSession, PublicMap } from "@essencia/shared/types";
import * as eventosApi from "../../lib/eventos-api";
import { EscolhaLugares } from "../escolha/escolha-lugares";

const routerPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));

vi.mock("../../lib/eventos-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/eventos-api")>("../../lib/eventos-api");
  return { ...actual, reservarAssentos: vi.fn(), obterMapaSessao: vi.fn() };
});

const evento: PublicEventDetail = { id: "evento", slug: "festival", title: "Festival", summary: "Resumo", description: null, imageUrl: null, category: "Música", startsAt: new Date("2026-12-07T19:00:00Z"), locationName: "Auditório", fromPriceCents: 4500, availability: "available", contactEmail: null, contactPhone: null, cancellationPolicy: null };
const sessao: PublicEventSession = { id: "sessao", startsAt: new Date("2026-12-07T19:00:00Z"), endsAt: new Date("2026-12-07T21:00:00Z"), status: "PUBLICADA", capacity: 21, location: null, mapId: "mapa", salesStartsAt: null, salesEndsAt: null, availability: "available", ticketTypes: [{ id: "inteira", name: "Inteira", description: null, priceCents: 4500, maxPerOrder: null, eligibility: null }, { id: "meia", name: "Meia-entrada", description: null, priceCents: 2250, maxPerOrder: null, eligibility: "Estudantes" }], offers: [] };
const mapa: PublicMap = { sessionId: "sessao", mapId: "mapa", seats: Array.from({ length: 21 }, (_, index) => ({ id: `s-${index + 1}`, sessionId: "sessao", rowLabel: "G", seatNumber: String(index + 19), x: index * 10, y: 0, width: 8, height: 8, category: "COMUM", accessible: false, state: "available" as const })) };
const ofertaVolume = { id: "oferta", version: 1, name: "Grupo", minQuantity: 10, maxQuantity: null, discountPercent: 15 } as const;

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

  it("reserva sem comprador e navega para o checkout", async () => {
    vi.mocked(eventosApi.reservarAssentos).mockResolvedValue({ reservationId: "reserva", orderNumber: "PED-123", expiresAt: new Date(), subtotalCents: 4500, discountCents: 0, totalCents: 4500, appliedOffer: null, items: [] });
    const sessaoUma = { ...sessao, ticketTypes: [sessao.ticketTypes[0]!] };
    render(<EscolhaLugares evento={evento} sessao={sessaoUma} map={mapa} />);
    fireEvent.click(screen.getByRole("button", { name: /Fileira G, assento 19/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Continuar" })[0]!);
    await waitFor(() => expect(eventosApi.reservarAssentos).toHaveBeenCalledWith({ sessionId: "sessao", seats: [{ seatId: "s-1", ticketTypeId: "inteira", participantIndex: 0 }] }));
    expect(routerPush).toHaveBeenCalledWith("/checkout?pedido=PED-123&slug=festival&sessionId=sessao");
  });

  it("mostra erro genérico com ação para tentar novamente", async () => {
    vi.mocked(eventosApi.reservarAssentos).mockRejectedValue(new Error("falha inesperada"));
    const sessaoUma = { ...sessao, ticketTypes: [sessao.ticketTypes[0]!] };
    render(<EscolhaLugares evento={evento} sessao={sessaoUma} map={mapa} />);
    fireEvent.click(screen.getByRole("button", { name: /Fileira G, assento 19/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Continuar" })[0]!);
    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível guardar seus lugares");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voltar aos lugares" })).toBeTruthy();
  });

  it("usa desconto da oferta na barra mobile", () => {
    const sessaoUma = { ...sessao, ticketTypes: [sessao.ticketTypes[0]!], offers: [ofertaVolume] };
    render(<EscolhaLugares evento={evento} sessao={sessaoUma} map={{ ...mapa, seats: mapa.seats.slice(0, 10) }} />);
    for (let index = 19; index <= 28; index += 1) fireEvent.click(screen.getByRole("button", { name: new RegExp(`Fileira G, assento ${index}`) }));
    expect(screen.getAllByText("R$ 382,50").length).toBeGreaterThan(0);
  });

  it("remove o lugar perdido no conflito 409 e anuncia o rótulo", async () => {
    vi.mocked(eventosApi.reservarAssentos).mockRejectedValue(new eventosApi.EventosApiError("indisponível", 409, "SEAT_UNAVAILABLE"));
    vi.mocked(eventosApi.obterMapaSessao).mockResolvedValue({ ...mapa, seats: mapa.seats.map((seat) => seat.id === "s-1" ? { ...seat, state: "sold" as const } : seat) });
    const sessaoUma = { ...sessao, ticketTypes: [sessao.ticketTypes[0]!] };
    render(<EscolhaLugares evento={evento} sessao={sessaoUma} map={mapa} />);
    fireEvent.click(screen.getByRole("button", { name: /Fileira G, assento 19/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Continuar" })[0]!);
    expect(await screen.findByText("O lugar G19 acabou de ser escolhido por outra pessoa")).toBeTruthy();
    expect(screen.getByText("0 lugares")).toBeTruthy();
  });

  it("não vibra quando movimento reduzido está ativo", () => {
    const vibrate = vi.fn();
    Object.defineProperty(window.navigator, "vibrate", { configurable: true, value: vibrate });
    Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
    const sessaoUma = { ...sessao, ticketTypes: [sessao.ticketTypes[0]!] };
    render(<EscolhaLugares evento={evento} sessao={sessaoUma} map={mapa} />);
    fireEvent.click(screen.getByRole("button", { name: /Fileira G, assento 19/ }));
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("lista indica acessibilidade e não permite ocupado", () => {
    const mapaAcessivel = { ...mapa, seats: mapa.seats.map((seat, index) => index === 0 ? { ...seat, accessible: true } : index === 1 ? { ...seat, state: "sold" as const } : seat) };
    const sessaoUma = { ...sessao, ticketTypes: [sessao.ticketTypes[0]!] };
    render(<EscolhaLugares evento={evento} sessao={sessaoUma} map={mapaAcessivel} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver lugares em lista/ }));
    expect(screen.getByRole("button", { name: /Selecionar G19.*acessível/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Selecionar G20/ })).toBeNull();
  });
});
