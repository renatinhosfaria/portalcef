import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it } from "vitest";
import type { PublicEventCard } from "@essencia/shared/types";
import { EventoCard } from "../evento-card";
import { CatalogoEstados } from "../catalogo-estados";
import { CatalogoEventos } from "../catalogo-eventos";
import { formatarDataPublica, formatarPrecoPublico, rotuloDisponibilidade } from "../../lib/eventos-formatters";

const evento: PublicEventCard = {
  id: "evento-1", slug: "festa-junina", title: "Festa Junina", summary: "Uma tarde especial para a comunidade.",
  imageUrl: "https://www.portalcef.com.br/storage/festa.jpg", category: "Cultura", startsAt: "2026-06-20T02:00:00.000Z" as unknown as Date,
  locationName: "Pátio central", fromPriceCents: 1250, availability: "available",
};

describe("formatadores públicos de eventos", () => {
  it("formata preço em reais e usa fallback", () => {
    expect(formatarPrecoPublico(1250)).toBe("A partir de R$ 12,50");
    expect(formatarPrecoPublico(null)).toBe("Consulte");
  });
  it("formata data no fuso de São Paulo", () => {
    expect(formatarDataPublica("2026-06-20T02:00:00.000Z")).toContain("19/06/2026");
  });
  it("traduz disponibilidade", () => {
    expect(rotuloDisponibilidade("available")).toBe("Disponível");
    expect(rotuloDisponibilidade("sold_out")).toBe("Esgotado");
    expect(rotuloDisponibilidade("unavailable")).toBe("Indisponível");
  });
});

describe("catálogo público", () => {
  it("renderiza card com imagem, dados e link público", () => {
    const html = renderToStaticMarkup(<EventoCard event={evento} />);
    expect(html).toContain("festa.jpg");
    expect(html).toContain('alt="Festa Junina"');
    expect(html).toContain('href="/evento/festa-junina"');
    for (const text of ["Uma tarde especial", "Cultura", "Pátio central", "19/06/2026", "A partir de R$ 12,50", "Disponível"]) expect(html).toContain(text);
  });
  it("usa fallback quando não há imagem e evita compra em estados indisponíveis", () => {
    for (const availability of ["sold_out", "unavailable"] as const) {
      const html = renderToStaticMarkup(<EventoCard event={{ ...evento, imageUrl: null, availability }} />);
      expect(html).toContain("Essência Feliz");
      expect(html).toContain(availability === "sold_out" ? "Esgotado" : "Indisponível");
      expect(html).not.toContain("Comprar");
      expect(html).not.toContain('href="/evento/festa-junina"');
    }
  });
  it("mantém ordem recebida pela API", () => {
    const html = renderToStaticMarkup(<CatalogoEventos events={[evento, { ...evento, id: "evento-2", slug: "segundo", title: "Segundo" }]} />);
    expect(html.indexOf("Festa Junina")).toBeLessThan(html.indexOf("Segundo"));
  });
  it("separa estados vazio e erro", () => {
    expect(renderToStaticMarkup(<CatalogoEstados kind="empty" />)).toContain("Nenhum evento disponível");
    const erro = renderToStaticMarkup(<CatalogoEstados kind="error" onRetry={() => undefined} />);
    expect(erro).toContain("Não foi possível carregar");
    expect(erro).toContain("Tentar novamente");
    expect(erro).toContain('type="button"');
  });
});
