import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DetalheEvento } from "../detalhe-evento";
import { agruparSessoesPorDia } from "../sessoes-evento";
import type { PublicEventDetail, PublicEventSession } from "@essencia/shared/types";

const evento: PublicEventDetail = {
  id: "event-1", slug: "festival", title: "Festival", summary: "Resumo", imageUrl: null, category: null,
  startsAt: new Date("2026-01-01T10:00:00Z"), locationName: "Auditório", fromPriceCents: 1000, availability: "available",
  description: "Descrição", contactEmail: null, contactPhone: null, cancellationPolicy: null,
};

describe("caminho público de ingresso", () => {
  const criarSessao = (overrides: Partial<PublicEventSession> = {}): PublicEventSession => ({
    id: "sessao", startsAt: new Date("2026-01-02T02:00:00Z"), endsAt: new Date("2026-01-02T04:00:00Z"), status: "PUBLICADA", capacity: 10,
    location: { name: "Teatro", address: "Rua A", room: "Sala 2", instructions: "Chegue 15 min antes", accessibility: "Rampas disponíveis" },
    mapId: "map-1", salesStartsAt: null, salesEndsAt: null, availability: "available",
    ticketTypes: [{ id: "ticket-1", name: "Inteira", description: null, priceCents: 1000, maxPerOrder: 4, eligibility: null }], ...overrides,
  });

  it("agrupa sessões por dia no fuso de São Paulo e ordena horários", () => {
    const grupos = agruparSessoesPorDia([
      criarSessao({ id: "tarde", startsAt: new Date("2026-01-03T15:00:00Z") }),
      criarSessao({ id: "manha", startsAt: new Date("2026-01-02T15:00:00Z") }),
    ]);
    expect(grupos).toHaveLength(2);
    expect(grupos[0].key).toBe("2026-01-02");
    expect(grupos[0].sessions.map((item) => item.id)).toEqual(["manha"]);
    expect(grupos[1].key).toBe("2026-01-03");
    expect(grupos[1].sessions.map((item) => item.id)).toEqual(["tarde"]);
  });

  it("não oferece compra para sessão esgotada ou sem mapa", () => {
    const html = renderToStaticMarkup(<DetalheEvento event={evento} sessions={[
      criarSessao({ id: "esgotada", availability: "sold_out" }),
      criarSessao({ id: "sem-mapa", mapId: null }),
    ]} />);
    expect(html).toContain("Esgotada");
    expect(html).toContain("Sessão não vendável");
    expect(html).not.toContain("sessao/esgotada");
    expect(html).not.toContain("sessao/sem-mapa");
  });

  it("mantém escolhas inequívocas para vários tipos e detalhes do local", () => {
    const html = renderToStaticMarkup(<DetalheEvento event={evento} sessions={[criarSessao({ ticketTypes: [
      { id: "adulto", name: "Adulto", description: null, priceCents: 1000, maxPerOrder: null, eligibility: null },
      { id: "meia", name: "Meia", description: "Com comprovante", priceCents: 500, maxPerOrder: null, eligibility: "Estudante" },
    ] })]} />);
    expect(html).toContain("Escolha o tipo de ingresso");
    expect(html).toContain("ticketTypeId=adulto");
    expect(html).toContain("ticketTypeId=meia");
    expect(html).toContain("Sala 2");
    expect(html).toContain("Chegue 15 min antes");
    expect(html).toContain("Rampas disponíveis");
  });

  it("oferece tipo de ingresso quando a sessão é renderizada sem query", () => {
    const session: PublicEventSession = {
      id: "session-1", startsAt: new Date("2026-01-01T10:00:00Z"), endsAt: new Date("2026-01-01T12:00:00Z"), status: "PUBLICADA", capacity: 10,
      location: null, mapId: "map-1", salesStartsAt: null, salesEndsAt: null, availability: "available",
      ticketTypes: [{ id: "ticket-1", name: "Inteira", description: null, priceCents: 1000, maxPerOrder: 4, eligibility: null }],
    };
    const html = renderToStaticMarkup(<DetalheEvento event={evento} sessions={[session]} />);
    expect(html).toContain("Inteira");
    expect(html).toContain("ticketTypeId=ticket-1");
    expect(html).not.toContain("Escolha seus assentos</a>");
    const sessionPage = readFileSync(new URL("../../app/evento/[slug]/sessao/[sessionId]/page.tsx", import.meta.url), "utf8");
    expect(sessionPage).toContain("session?.ticketTypes.length === 1");
    expect(sessionPage).toContain("Escolha o tipo de ingresso");
  });
});
