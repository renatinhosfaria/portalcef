// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicEventDetail, PublicEventSession, PublicMap } from "@essencia/shared/types";
import * as eventosApi from "../../lib/eventos-api";
import { EscolhaLugares } from "../escolha/escolha-lugares";
import { lugaresPerdidos, useDisponibilidadeAoVivo } from "../escolha/use-disponibilidade-ao-vivo";

const routerPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));

vi.mock("../../lib/eventos-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/eventos-api")>("../../lib/eventos-api");
  return { ...actual, obterMapaSessao: vi.fn() };
});

const seat = (id: string, state: "available" | "sold" = "available") => ({ id, sessionId: "sessao", rowLabel: "G", seatNumber: id === "s-1" ? "19" : "20", x: 0, y: 0, width: 8, height: 8, category: "COMUM", accessible: false, state });
const mapaInicial: PublicMap = { sessionId: "sessao", mapId: "mapa", seats: [seat("s-1"), seat("s-2")] };
const mapaAtualizado: PublicMap = { ...mapaInicial, seats: [seat("s-1", "sold"), seat("s-2")] };

const evento: PublicEventDetail = { id: "evento", slug: "festival", title: "Festival", summary: "Resumo", description: null, imageUrl: null, category: "Música", startsAt: new Date("2026-12-07T19:00:00Z"), locationName: "Auditório", fromPriceCents: 4500, availability: "available", contactEmail: null, contactPhone: null, cancellationPolicy: null };
const sessao: PublicEventSession = { id: "sessao", startsAt: new Date("2026-12-07T19:00:00Z"), endsAt: new Date("2026-12-07T21:00:00Z"), status: "PUBLICADA", capacity: 2, location: null, mapId: "mapa", salesStartsAt: null, salesEndsAt: null, availability: "available", ticketTypes: [{ id: "inteira", name: "Inteira", description: null, priceCents: 4500, maxPerOrder: null, eligibility: null }], offers: [] };

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useDisponibilidadeAoVivo", () => {
  it("consulta de novo a cada 20 segundos", async () => {
    vi.useFakeTimers();
    const buscar = vi.fn().mockResolvedValue(mapaAtualizado);
    const { result } = renderHook(() => useDisponibilidadeAoVivo("sessao", mapaInicial, { buscar }));

    expect(buscar).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(19_999); });
    expect(buscar).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });

    expect(buscar).toHaveBeenCalledTimes(1);
    expect(result.current.mapa).toEqual(mapaAtualizado);
  });

  it("não consulta com a aba escondida e atualiza ao voltar", async () => {
    vi.useFakeTimers();
    const visibilidade = Object.getOwnPropertyDescriptor(document, "visibilityState");
    let estado: DocumentVisibilityState = "hidden";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => estado });
    const buscar = vi.fn().mockResolvedValue(mapaAtualizado);
    const { result } = renderHook(() => useDisponibilidadeAoVivo("sessao", mapaInicial, { buscar }));

    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(buscar).not.toHaveBeenCalled();

    estado = "visible";
    await act(async () => { fireEvent(document, new Event("visibilitychange")); });
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(result.current.mapa).toEqual(mapaAtualizado);
    if (visibilidade) Object.defineProperty(document, "visibilityState", visibilidade);
  });

  it("mantém o último mapa quando a consulta falha", async () => {
    vi.useFakeTimers();
    const buscar = vi.fn().mockRejectedValue(new Error("indisponível"));
    const { result } = renderHook(() => useDisponibilidadeAoVivo("sessao", mapaInicial, { buscar }));

    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(result.current.mapa).toEqual(mapaInicial);
  });
});

describe("lugaresPerdidos e integração no mapa", () => {
  it("identifica os lugares selecionados que deixaram de estar disponíveis", () => {
    expect(lugaresPerdidos([{ seatId: "s-1", ticketTypeId: "inteira", label: "G19" }], mapaAtualizado)).toEqual([mapaAtualizado.seats[0]]);
  });

  it("remove da seleção o lugar pego por outra pessoa, avisa e recalcula o total", async () => {
    vi.useFakeTimers();
    vi.mocked(eventosApi.obterMapaSessao).mockResolvedValue(mapaAtualizado);
    render(<EscolhaLugares evento={evento} sessao={sessao} map={mapaInicial} initialSelection={[{ seatId: "s-1", ticketTypeId: "inteira", label: "G19" }]} />);

    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(screen.getByText("O lugar G19 acabou de ser escolhido por outra pessoa")).toBeTruthy();
    expect(screen.getByText("0 lugares")).toBeTruthy();
    expect(screen.getByRole("button", { name: /assento 19/ }).getAttribute("aria-pressed")).toBe("false");
  });
});
