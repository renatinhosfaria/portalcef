// @vitest-environment jsdom
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DetalheEvento } from "../detalhe-evento";
import { SessoesEvento, agruparSessoesPorDia } from "../sessoes-evento";
import type { OfertaPrecoPublica, PoliticaPublica, PublicEventDetail, PublicEventSession } from "@essencia/shared/types";

afterEach(() => cleanup());

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
    ticketTypes: [{ id: "ticket-1", name: "Inteira", description: null, priceCents: 1000, maxPerOrder: 4, eligibility: null }], offers: [], ...overrides,
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
    const html = renderToStaticMarkup(<DetalheEvento event={{ ...evento, summary: null, description: null, imageUrl: "https://www.portalcef.com.br/storage/festival.jpg" }} sessions={[]} />);
    expect(html).toContain("Resumo do evento não informado.");
    expect(html).toContain("festival.jpg");
    expect(html).not.toMatch(/^<main/);
  });

  it("preserva a descrição sem anunciar fallback de resumo inexistente", () => {
    const html = renderToStaticMarkup(<DetalheEvento event={{ ...evento, summary: null, description: "Texto real\ncom quebra" }} sessions={[]} />);
    expect(html).toContain("Texto real\ncom quebra");
    expect(html).not.toContain("Resumo do evento não informado.");
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

  it("leva escolher assentos do hero e da barra móvel até as sessões quando há mais de uma vendável", () => {
    const html = renderToStaticMarkup(<DetalheEvento event={evento} sessions={[
      criarSessao({ id: "indisponivel", availability: "sold_out" }),
      criarSessao({ id: "primeira-vendavel" }),
      criarSessao({ id: "segunda-vendavel" }),
    ]} />);

    expect(html).toContain('id="sessoes"');
    expect(html.match(/<a[^>]*href="#sessoes"[^>]*>Escolher assentos<\/a>/g)).toHaveLength(2);
    expect(html).not.toContain("Comprar ingressos");
    expect(html).toMatch(/class="[^"]*hidden[^"]*md:inline-flex/);
    expect(html).toContain("md:hidden");
    expect(html).toMatch(/(?:fixed|sticky)/);
    expect(html).toContain("pb-24");
  });

  it("leva escolher assentos do hero direto ao mapa quando só uma sessão está à venda", () => {
    const html = renderToStaticMarkup(<DetalheEvento event={evento} sessions={[
      criarSessao({ id: "esgotada", availability: "sold_out" }),
      criarSessao({ id: "unica-vendavel" }),
    ]} />);

    expect(html.match(/<a[^>]*href="\/evento\/festival\/sessao\/unica-vendavel"[^>]*>Escolher assentos<\/a>/g)).toHaveLength(3);
    expect(html).not.toContain('href="#sessoes"');
  });

  it("não exibe CTAs de compra quando nenhuma sessão é vendável", () => {
    const html = renderToStaticMarkup(<DetalheEvento event={evento} sessions={[
      criarSessao({ id: "esgotada", availability: "sold_out" }),
      criarSessao({ id: "sem-mapa", mapId: null }),
      criarSessao({ id: "sem-tipos", ticketTypes: [] }),
    ]} />);

    expect(html).not.toContain("Escolher assentos");
    expect(html).toContain('id="sessoes"');
  });

  it("mostra os tipos só como informação e um único botão de assentos por sessão", () => {
    const html = renderToStaticMarkup(<SessoesEvento eventSlug="festival" sessions={[criarSessao({ ticketTypes: [
      { id: "adulto", name: "Adulto", description: "Acesso à programação completa", priceCents: 1000, maxPerOrder: null, eligibility: null },
      { id: "meia", name: "Meia", description: "Com comprovante", priceCents: 500, maxPerOrder: null, eligibility: "Estudante" },
    ] })]} />);
    expect(html.match(/Escolher assentos/g)).toHaveLength(1);
    expect(html).toContain('href="/evento/festival/sessao/sessao"');
    expect(html).not.toContain("ticketTypeId");
    expect(html).not.toContain("Escolha o tipo de ingresso");
    expect(html).toContain("Adulto");
    expect(html).toContain("R$ 10,00");
    expect(html).toContain("R$ 5,00");
    expect(html).toContain("Acesso à programação completa");
    expect(html).toContain("Elegibilidade: Estudante");
    expect(html).toContain("Sala 2");
    expect(html).toContain("Chegue 15 min antes");
    expect(html).toContain("Rampas disponíveis");
  });

  it("não exibe ação explícita em sessão esgotada ou não vendável", () => {
    const html = renderToStaticMarkup(<DetalheEvento event={evento} sessions={[
      criarSessao({ id: "esgotada", availability: "sold_out" }),
      criarSessao({ id: "sem-mapa", mapId: null }),
    ]} />);
    expect(html).not.toContain("Escolher assentos");
  });

  it("mostra a arte inteira, data por extenso, endereço e selos", () => {
    const ofertaFixa: OfertaPrecoPublica = { id: "grupo-fixo", version: 1, name: "Grupo", minQuantity: 5, maxQuantity: null, discountPercent: null };
    const html = renderToStaticMarkup(<DetalheEvento event={{ ...evento, imageUrl: "https://www.portalcef.com.br/storage/festival.jpg" }} sessions={[criarSessao({ startsAt: "2026-01-02T15:00:00.000Z" as unknown as Date, ticketTypes: [{ id: "meia", name: "Meia-entrada", description: null, priceCents: 500, maxPerOrder: null, eligibility: "Estudantes" }], offers: [ofertaFixa] })]} />);
    expect(html).toContain("object-contain");
    expect(html).toContain("aspect-[16/9]");
    expect(html).toContain("Sexta, 2 de janeiro de 2026 · 12h");
    expect(html).toContain("Rua A");
    expect(html).toContain("Assentos numerados");
    expect(html).toContain("Meia-entrada");
    expect(html).toContain("Grupo a partir de 5 lugares.");
  });

  it("exibe a caixa com preços, oferta fixa e link da sessão", () => {
    const ofertaFixa: OfertaPrecoPublica = { id: "grupo-fixo", version: 1, name: "Grupo", minQuantity: 5, maxQuantity: null, discountPercent: null };
    const html = renderToStaticMarkup(<DetalheEvento event={evento} sessions={[criarSessao({ offers: [ofertaFixa], ticketTypes: [{ id: "inteira", name: "Inteira", description: null, priceCents: 1000, maxPerOrder: null, eligibility: null }] })]} />);
    expect(html).toContain("R$ 10,00");
    expect(html).toContain("Grupo a partir de 5 lugares.");
    expect(html).toContain('href="/evento/festival/sessao/sessao"');
    expect(html).toContain("Pagamento seguro · cartão ou Pix");
  });

  it("permite trocar a sessão no seletor da caixa de compra", () => {
    render(<DetalheEvento event={evento} sessions={[criarSessao({ id: "primeira" }), criarSessao({ id: "segunda", startsAt: new Date("2026-01-03T02:00:00Z") })]} />);
    expect(screen.getByRole("combobox", { name: "Sessão" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Escolher assentos" }).find((link) => link.getAttribute("href") === "/evento/festival/sessao/primeira")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Sessão" }), { target: { value: "segunda" } });
    expect(screen.getAllByRole("link", { name: "Escolher assentos" }).find((link) => link.getAttribute("href") === "/evento/festival/sessao/segunda")).toBeTruthy();
  });

  it("mostra políticas com rótulos amigáveis, organizador e telefone sem azul", () => {
    const politicas: PoliticaPublica[] = [
      { type: "CONTATO", version: 1, content: "Fale conosco." },
      { type: "COMPRA", version: 1, content: "Compra segura." },
      { type: "CANCELAMENTO_REEMBOLSO", version: 1, content: "Reembolso." },
    ];
    const html = renderToStaticMarkup(<DetalheEvento event={evento} sessions={[criarSessao()]} politicas={politicas} />);
    expect(html).toContain("Cancelamento e reembolso");
    expect(html).toContain("Compra e meia-entrada");
    expect(html).toContain("Contato");
    expect(html).not.toContain("CANCELAMENTO_REEMBOLSO");
    expect(html).not.toContain("COMPRA");
    expect(html).toContain("Quem organiza");
    expect(html).toContain("tel:+553432927388");
    expect(html).not.toMatch(/blue-/);
  });


});
