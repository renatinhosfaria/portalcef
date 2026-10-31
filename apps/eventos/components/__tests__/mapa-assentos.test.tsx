import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PublicEventTicketType, PublicMap, PublicSeat } from "@essencia/shared/types";
import { MapaAssentos } from "../mapa-assentos";
import { calcularBoundsMapa, estiloAssento, serializarSelecaoAssentos } from "../mapa-assentos-utils";

const tipoInteira: PublicEventTicketType = { id: "inteira", name: "Inteira", description: null, priceCents: 1000, maxPerOrder: null, eligibility: null };
const tipoMeia: PublicEventTicketType = { id: "meia", name: "Meia", description: null, priceCents: 500, maxPerOrder: null, eligibility: "Estudante" };
const assentos: PublicSeat[] = [
  { id: "s-1", sessionId: "sessao-1", rowLabel: "A", seatNumber: "1", x: 10, y: 20, width: 20, height: 10, category: "plateia", accessible: true, state: "available" },
  { id: "s-2", sessionId: "sessao-1", rowLabel: "A", seatNumber: "2", x: 50, y: 20, width: 20, height: 10, category: "plateia", accessible: false, state: "reserved" },
  { id: "s-3", sessionId: "sessao-1", rowLabel: "B", seatNumber: "1", x: 10, y: 50, width: 20, height: 10, category: null, accessible: false, state: "sold" },
  { id: "s-4", sessionId: "sessao-1", rowLabel: "B", seatNumber: "2", x: 50, y: 50, width: 20, height: 10, category: null, accessible: false, state: "blocked" },
];
const mapa: PublicMap = { sessionId: "sessao-1", mapId: "mapa-1", seats: assentos };

describe("mapa público de assentos", () => {
  it("calcula bounds a partir da geometria completa dos assentos", () => {
    expect(calcularBoundsMapa(assentos)).toEqual({ minX: 10, minY: 20, width: 60, height: 40 });
    expect(calcularBoundsMapa([{ ...assentos[0], x: 4, y: 8, width: 0, height: 0 }])).toEqual({ minX: 4, minY: 8, width: 1, height: 1 });
  });

  it("posiciona assento proporcionalmente e preserva seu rótulo", () => {
    const estilo = estiloAssento(assentos[0], calcularBoundsMapa(assentos));
    expect(estilo.position).toBe("absolute");
    expect(estilo.left).toBe("0%");
    expect(estilo.top).toBe("0%");
    expect(estilo.width).toBe(`${(20 / 60) * 100}%`);
    expect(estilo.height).toBe(`${(10 / 40) * 100}%`);
    expect(renderToStaticMarkup(<MapaAssentos map={mapa} checkoutHref="/checkout" ticketTypes={[tipoInteira, tipoMeia]} />)).toContain("A-1");
  });

  it("torna somente disponíveis selecionáveis e descreve acessibilidade por texto", () => {
    const html = renderToStaticMarkup(<MapaAssentos map={mapa} checkoutHref="/checkout" ticketTypes={[tipoInteira]} />);
    expect((html.match(/<button/g) ?? []).length).toBe(1);
    expect((html.match(/role="checkbox"[^>]*aria-disabled="true"/g) ?? []).length).toBe(3);
    expect(html).toContain("Assento A-1, disponível, assento acessível");
    expect(html).toContain("acessível");
    expect(html).toContain("Reservado");
    expect(html).toContain("Vendido");
    expect(html).toContain("Bloqueado");
  });

  it("serializa seleção mantendo alinhamento e ordem dos tipos", () => {
    expect(serializarSelecaoAssentos([
      { seatId: "s-2", ticketTypeId: "meia" },
      { seatId: "s-1", ticketTypeId: "inteira" },
    ])).toBe("assentos=s-2%2Cs-1&ticketTypeIds=meia%2Cinteira");
  });

  it("não cria link acionável quando não há seleção", () => {
    const html = renderToStaticMarkup(<MapaAssentos map={mapa} checkoutHref="/checkout" ticketTypes={[tipoInteira]} />);
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('href="/checkout?');
  });
});

  it("mantém os tipos de ingresso alinhados no checkout e evita mapa de sessão não vendável", async () => {
    const { readFileSync } = await import("node:fs");
    const checkout = readFileSync(new URL("../../app/checkout/page.tsx", import.meta.url), "utf8");
    const sessionPage = readFileSync(new URL("../../app/evento/[slug]/sessao/[sessionId]/page.tsx", import.meta.url), "utf8");
    expect(checkout).toContain("ticketTypeIds");
    expect(checkout).toContain("split(\",\")");
    expect(sessionPage).toContain("if (!session || session.availability !== \"available\"");
  });
