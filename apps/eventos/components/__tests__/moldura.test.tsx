import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Cabecalho } from "../base/cabecalho";
import { RodapeConfianca } from "../base/rodape-confianca";
import { classeBotaoAcao } from "../base/botao-acao";

describe("moldura pública de Eventos", () => {
  it("exibe dados institucionais e sinais de confiança no rodapé", () => {
    const html = renderToStaticMarkup(<RodapeConfianca />);

    expect(html).toContain("65.481.923/0001-58");
    expect(html).toContain("R. Lourdes de Carvalho, 1212 - Segismundo Pereira, Uberlândia - MG, 38408-268");
    expect(html).toContain('href="tel:+553432927388"');
    expect(html).toContain("Pagamento processado pela Stripe");
    expect(html).toContain("Cartão de crédito e Pix");
    expect(html).not.toContain("Termos");
    expect(html).not.toContain("Privacidade");
    expect(html).not.toContain("WhatsApp");
  });

  it("oferece consulta de ingressos no cabeçalho", () => {
    const html = renderToStaticMarkup(<Cabecalho />);

    expect(html).toContain("Meus ingressos");
    expect(html).toContain('href="/pedido/consulta"');
  });

  it("centraliza a aparência dos botões de ação", () => {
    expect(classeBotaoAcao()).toContain("bg-[var(--acao)]");
    expect(classeBotaoAcao("secundaria")).toContain("border-[var(--acao)]");
    expect(classeBotaoAcao("fantasma")).toContain("text-[var(--acao)]");
  });
});
