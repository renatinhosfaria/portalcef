import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PublicEventTicketType } from "@essencia/shared/types";
import { EscolhaTipoIngresso } from "../escolha-tipo-ingresso";

const tipos: PublicEventTicketType[] = [
  { id: "inteira", name: "Inteira", description: "Acesso à sessão", priceCents: 4500, maxPerOrder: null, eligibility: null },
  { id: "meia", name: "Meia-entrada", description: null, priceCents: 2250, maxPerOrder: null, eligibility: "Estudantes e idosos" },
];

describe("escolha de tipo de ingresso", () => {
  it("renderiza cada tipo como card com preço, elegibilidade e ação", () => {
    const html = renderToStaticMarkup(<EscolhaTipoIngresso eventSlug="ballet" sessionId="sessao-1" ticketTypes={tipos} />);

    expect(html).toContain("Escolha o tipo de ingresso");
    expect(html.match(/Escolher assentos/g)).toHaveLength(2);
    expect(html).toContain("R$ 45,00");
    expect(html).toContain("R$ 22,50");
    expect(html).toContain("Acesso à sessão");
    expect(html).toContain("Elegibilidade: Estudantes e idosos");
    expect(html).toContain("ticketTypeId=inteira");
    expect(html).toContain("ticketTypeId=meia");
  });

  it("não inventa descrição ou elegibilidade ausentes", () => {
    const html = renderToStaticMarkup(<EscolhaTipoIngresso eventSlug="ballet" sessionId="sessao-1" ticketTypes={[tipos[0]]} />);

    expect(html).not.toContain("Elegibilidade:");
    expect(html).not.toContain("Detalhes não informados");
  });
});
