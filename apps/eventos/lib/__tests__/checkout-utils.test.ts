import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { lerListaQuery, montarHrefRetornoMapa } from "../checkout-utils";

describe("utilidades do checkout", () => {
  it("trata percent-encoding inválido sem lançar e marca a consulta como inválida", () => {
    expect(lerListaQuery("%")).toEqual({ values: [], invalid: true });
    expect(lerListaQuery("s-1,s-2")).toEqual({ values: ["s-1", "s-2"], invalid: false });
  });

  it("monta a rota do mapa preservando a ordem dos assentos e dos tipos", () => {
    expect(montarHrefRetornoMapa({
      slug: "ballet",
      sessionId: "sessao-1",
      seatIds: ["s-2", "s-1"],
      ticketTypeIds: ["meia", "inteira"],
      motivo: "disponibilidade",
    })).toBe("/evento/ballet/sessao/sessao-1?assentos=s-2%2Cs-1&ticketTypeIds=meia%2Cinteira&conflito=disponibilidade");
  });

  it("codifica slug e sessão e não transporta dados pessoais do formulário", () => {
    const href = montarHrefRetornoMapa({
      slug: "festival da família",
      sessionId: "sessão/1",
      seatIds: ["seat-1"],
      ticketTypeIds: ["inteira"],
      motivo: "disponibilidade",
    });

    expect(href).toContain("/evento/festival%20da%20fam%C3%ADlia/sessao/sess%C3%A3o%2F1?");
    expect(href).not.toContain("Ana da Silva");
    expect(href).not.toContain("ana@example.com");
    expect(href).not.toContain("11999999999");
    expect(href).not.toContain("buyerName");
    expect(href).not.toContain("buyerEmail");
    expect(href).not.toContain("buyerPhone");
  });

  it("omite o motivo quando a rota é montada sem conflito", () => {
    expect(montarHrefRetornoMapa({
      slug: "ballet",
      sessionId: "sessao-1",
      seatIds: ["s-1"],
      ticketTypeIds: ["inteira"],
    })).toBe("/evento/ballet/sessao/sessao-1?assentos=s-1&ticketTypeIds=inteira");
  });

  it("mantém a página de sessão compatível com retorno e acesso sem parâmetros", () => {
    const source = readFileSync("app/evento/[slug]/sessao/[sessionId]/page.tsx", "utf8");
    expect(source).toContain("searchParams?");
    expect(source).toContain("conflitoDisponibilidade");
    expect(source).toContain("reidratarSelecaoAssentos");
  });
});
