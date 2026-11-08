import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicEventSession, PublicMap } from "@essencia/shared/types";

const api = vi.hoisted(() => ({
  listarSessoesPublicas: vi.fn(),
  obterMapaSessao: vi.fn(),
}));

vi.mock("../lib/eventos-api", () => api);

import Page from "./evento/[slug]/sessao/[sessionId]/page";

const sessao: PublicEventSession = {
  id: "sessao-1", startsAt: new Date("2026-12-07T19:00:00Z"), endsAt: new Date("2026-12-07T21:00:00Z"), status: "PUBLICADA", capacity: 10,
  location: null, mapId: "mapa-1", salesStartsAt: null, salesEndsAt: null, availability: "available",
  ticketTypes: [
    { id: "inteira", name: "Inteira", description: null, priceCents: 4500, maxPerOrder: null, eligibility: null },
    { id: "meia", name: "Meia-entrada", description: null, priceCents: 2250, maxPerOrder: null, eligibility: "Estudantes" },
  ],
  offers: [],
};

const mapa: PublicMap = {
  sessionId: "sessao-1",
  mapId: "mapa-1",
  seats: [{ id: "s-1", sessionId: "sessao-1", rowLabel: "A", seatNumber: "1", x: 0, y: 0, width: 10, height: 10, category: null, accessible: false, state: "available" }],
};

async function renderizar(searchParams: Record<string, string> = {}) {
  return renderToStaticMarkup(await Page({
    params: Promise.resolve({ slug: "ballet", sessionId: "sessao-1" }),
    searchParams: Promise.resolve(searchParams),
  }));
}

describe("página de assentos da sessão", () => {
  beforeEach(() => {
    api.listarSessoesPublicas.mockResolvedValue([sessao]);
    api.obterMapaSessao.mockResolvedValue(mapa);
  });

  it("abre o mapa direto quando a sessão tem vários tipos e nenhum foi escolhido", async () => {
    const html = await renderizar();

    expect(html).toContain("Escolha seus assentos");
    expect(html).toContain('data-seat-id="s-1"');
    expect(html).not.toContain("Escolha o tipo de ingresso");
  });

  it("continua abrindo o mapa a partir de links antigos com tipo na URL", async () => {
    const html = await renderizar({ ticketTypeId: "meia" });

    expect(html).toContain("Escolha seus assentos");
    expect(html).toContain('data-seat-id="s-1"');
  });
});
