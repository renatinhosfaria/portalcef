import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DetalheEvento } from "../detalhe-evento";
import type { PublicEventDetail, PublicEventSession } from "@essencia/shared/types";

const evento: PublicEventDetail = {
  id: "event-1", slug: "festival", title: "Festival", summary: "Resumo", imageUrl: null, category: null,
  startsAt: new Date("2026-01-01T10:00:00Z"), locationName: "Auditório", fromPriceCents: 1000, availability: "available",
  description: "Descrição", contactEmail: null, contactPhone: null, cancellationPolicy: null,
};

describe("caminho público de ingresso", () => {
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
  });
});
