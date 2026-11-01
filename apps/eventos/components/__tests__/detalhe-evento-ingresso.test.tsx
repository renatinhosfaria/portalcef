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

  it("renderiza sessões com datas ISO vindas do JSON da API", () => {
    const sessaoWire = criarSessao({ startsAt: "2026-01-02T15:00:00.000Z" as unknown as Date, endsAt: "2026-01-02T17:00:00.000Z" as unknown as Date });
    const html = renderToStaticMarkup(<DetalheEvento event={evento} sessions={[sessaoWire]} />);
    expect(html).toContain("12:00");
    expect(html).toContain("14:00");
  });

  it("exibe janela de venda e orienta os tipos de ingresso", () => {
    const html = renderToStaticMarkup(<DetalheEvento event={evento} sessions={[criarSessao({
      salesStartsAt: "2026-01-01T12:00:00.000Z" as unknown as Date,
      salesEndsAt: "2026-01-02T02:00:00.000Z" as unknown as Date,
      ticketTypes: [{ id: "meia", name: "Meia-entrada", description: "Com comprovante na entrada", priceCents: 500, maxPerOrder: 2, eligibility: "Estudantes e idosos" }],
    })]} />);
    expect(html).toContain("Venda:");
    expect(html).toContain("01/01/2026");
    expect(html).toContain("Com comprovante na entrada");
    expect(html).toContain("Estudantes e idosos");
  });

  it("usa fallback textual para resumo ausente, imagem pública e raiz sem main aninhado", () => {
    const html = renderToStaticMarkup(<DetalheEvento event={{ ...evento, summary: null, imageUrl: "https://www.portalcef.com.br/storage/festival.jpg" }} sessions={[]} />);
    expect(html).toContain("Resumo do evento não informado.");
    expect(html).toContain("festival.jpg");
    expect(html).not.toMatch(/^<main/);
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

  it("oferece comprar ingressos no hero e na barra móvel para a primeira sessão vendável", () => {
    const html = renderToStaticMarkup(<DetalheEvento event={evento} sessions={[
      criarSessao({ id: "indisponivel", availability: "sold_out" }),
      criarSessao({ id: "primeira-vendavel" }),
      criarSessao({ id: "segunda-vendavel" }),
    ]} />);
    const destino = "/evento/festival/sessao/primeira-vendavel";

    expect(html).toContain('id="sessoes"');
    expect(html.match(/href="#sessoes"/g)).toHaveLength(2);
    expect(html).toContain(`data-destino-compra="${destino}"`);
    expect(html).not.toContain(`href="${destino}"`);
    expect(html.match(/Comprar ingressos/g)).toHaveLength(2);
    expect(html).toMatch(/class="[^"]*hidden[^"]*md:inline-flex/);
    expect(html).toContain("md:hidden");
    expect(html).toMatch(/(?:fixed|sticky)/);
    expect(html).toContain("pb-24");
  });

  it("não exibe CTAs de compra quando nenhuma sessão é vendável", () => {
    const html = renderToStaticMarkup(<DetalheEvento event={evento} sessions={[
      criarSessao({ id: "esgotada", availability: "sold_out" }),
      criarSessao({ id: "sem-mapa", mapId: null }),
      criarSessao({ id: "sem-tipos", ticketTypes: [] }),
    ]} />);

    expect(html).not.toContain("Comprar ingressos");
    expect(html).toContain('id="sessoes"');
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

  it("apresenta cada tipo vendável como card com preço, detalhes e ação explícita", () => {
    const html = renderToStaticMarkup(<DetalheEvento event={evento} sessions={[criarSessao({ ticketTypes: [
      { id: "adulto", name: "Adulto", description: "Acesso à programação completa", priceCents: 1000, maxPerOrder: null, eligibility: null },
      { id: "meia", name: "Meia", description: "Com comprovante", priceCents: 500, maxPerOrder: null, eligibility: "Estudante" },
    ] })]} />);
    expect(html).toContain("Escolher assentos");
    expect(html.match(/Escolher assentos/g)).toHaveLength(2);
    expect(html).toContain("Adulto");
    expect(html).toContain("R$ 10,00");
    expect(html).toContain("Acesso à programação completa");
    expect(html).toContain("Elegibilidade: Estudante");
    expect(html).toContain("ticketTypeId=adulto");
    expect(html).toContain("ticketTypeId=meia");
  });

  it("não exibe ação explícita em sessão esgotada ou não vendável", () => {
    const html = renderToStaticMarkup(<DetalheEvento event={evento} sessions={[
      criarSessao({ id: "esgotada", availability: "sold_out" }),
      criarSessao({ id: "sem-mapa", mapId: null }),
    ]} />);
    expect(html).not.toContain("Escolher assentos");
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
    expect(sessionPage).toContain("EscolhaTipoIngresso");
    expect(sessionPage).toContain("initialSelectionInvalid={rehidratacao.invalid}");
    expect(sessionPage).toContain("unavailableSeatIds={rehidratacao.unavailableSeatIds}");
  });
});
