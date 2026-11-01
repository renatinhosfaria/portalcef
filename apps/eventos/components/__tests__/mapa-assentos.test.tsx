// @vitest-environment jsdom
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { PublicEventTicketType, PublicMap, PublicSeat } from "@essencia/shared/types";
import { MapaAssentos } from "../mapa-assentos";
import { calcularTotalSelecao, ResumoAssentosFixo } from "../resumo-assentos";
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

afterEach(() => cleanup());

describe("mapa público de assentos", () => {
  it("renderiza a planta SVG e mantém mapa e lista em modos acessíveis", () => {
    const html = renderToStaticMarkup(<MapaAssentos map={mapa} checkoutHref="/checkout" ticketTypes={[tipoInteira]} />);

    expect(html).toContain("<svg");
    expect(html).toContain('data-seat-id="s-1"');
    expect(html).toContain('aria-labelledby="mapa-assentos-titulo"');
    expect(html).toContain('aria-label="Lista de assentos"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("hidden");
  });

  it("rehidrata seleção inicial, nomeia conflitos e preserva total", () => {
    render(<MapaAssentos
      map={mapa}
      checkoutHref="/checkout"
      ticketTypes={[tipoInteira, tipoMeia]}
      initialSelection={[{ seatId: "s-1", ticketTypeId: "meia", label: "A-1", accessible: true }]}
      unavailableSeatIds={["s-2"]}
    />);

    expect(screen.getByText(/Assento A-2 ficou indisponível/)).toBeTruthy();
    expect(screen.getAllByText("Assento A-1").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/R\$ 5,00/).length).toBeGreaterThan(0);
  });

  it("sincroniza seleção entre mapa e lista sem fazer reserva", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<MapaAssentos map={mapa} checkoutHref="/checkout" ticketTypes={[tipoInteira]} />);

    fireEvent.click(screen.getByRole("button", { name: /Mapa/ }));
    fireEvent.click(screen.getByRole("button", { name: /Assento A-1, disponível/ }));
    expect(screen.getByRole("button", { name: /Assento A-1, disponível/ }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: /Lista/ }));
    const lista = screen.getByRole("list", { name: "Assentos da fileira A" });
    expect(within(lista).getByRole("button", { name: /Assento A-1/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(lista).getByRole("button", { name: /Assento A-1/ }));
    expect(screen.getByText("Nenhum assento selecionado.")).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("oculta lista da árvore acessível quando o modo mapa está ativo", () => {
    render(<MapaAssentos map={mapa} checkoutHref="/checkout" ticketTypes={[tipoInteira]} />);

    fireEvent.click(screen.getByRole("button", { name: "Mapa" }));
    const lista = screen.getByLabelText("Lista de assentos");
    expect(lista.getAttribute("aria-hidden")).toBe("true");
    expect(lista.hasAttribute("hidden")).toBe(true);
    expect(screen.getByRole("group", { name: "Planta de assentos" })).toBeTruthy();
  });

  it("mantém conflito indisponível no SVG e bloqueia checkout de seleção inválida", () => {
    const mapaDisponivel: PublicMap = { ...mapa, seats: assentos.map((seat) => seat.id === "s-1" ? { ...seat, state: "available" as const } : seat) };
    render(<MapaAssentos map={mapaDisponivel} checkoutHref="/checkout" ticketTypes={[tipoInteira]} unavailableSeatIds={["s-1"]} initialSelectionInvalid />);

    fireEvent.click(screen.getByRole("button", { name: "Mapa" }));
    expect(screen.queryByRole("button", { name: /Assento A-1/ })).toBeNull();
    expect(screen.getByRole("img", { name: /Assento A-1, indisponível/ }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText(/Não foi possível restaurar/)).toBeTruthy();
    expect(Array.from(document.querySelectorAll("a")).every((link) => !link.hasAttribute("href"))).toBe(true);
  });

  it("calcula o total pelos tipos de ingresso selecionados", () => {
    expect(calcularTotalSelecao([
      { seatId: "s-1", ticketTypeId: "inteira" },
      { seatId: "s-2", ticketTypeId: "meia" },
    ], [tipoInteira, tipoMeia])).toBe(1500);
  });

  it("mantém o resumo fixo desabilitado quando não há seleção", () => {
    const html = renderToStaticMarkup(<ResumoAssentosFixo selection={[]} ticketTypes={[tipoInteira]} onChangeTicketType={() => undefined} />);

    expect(html).toContain("Nenhum assento selecionado");
    expect(html).toContain("R$ 0,00");
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('href="/checkout');
  });

  it("exibe quantidade, total e checkout quando a seleção está completa", () => {
    const html = renderToStaticMarkup(<ResumoAssentosFixo selection={[
      { seatId: "s-1", ticketTypeId: "inteira", label: "A-1" },
      { seatId: "s-2", ticketTypeId: "meia", label: "A-2" },
    ]} ticketTypes={[tipoInteira, tipoMeia]} checkoutHref="/checkout?assentos=s-1%2Cs-2" onChangeTicketType={() => undefined} />);

    expect(html).toContain("2 assento(s) selecionado(s)");
    expect(html).toContain("R$ 15,00");
    expect(html).toContain('href="/checkout?assentos=s-1%2Cs-2"');
    expect(html).toContain('aria-disabled="false"');
  });

  it("mantém o checkout desabilitado quando algum assento ainda não tem tipo", () => {
    const html = renderToStaticMarkup(<ResumoAssentosFixo selection={[{ seatId: "s-1", ticketTypeId: "" }]} ticketTypes={[tipoInteira]} checkoutHref="/checkout?assentos=s-1" onChangeTicketType={() => undefined} />);

    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('href="/checkout?assentos=s-1"');
  });

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
    expect(html).toContain('aria-label="Assento A-1, disponível, assento acessível"');
    expect(html).toContain('aria-label="Assento A-2, reservado'); expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('aria-label="Assento B-1, vendido');
    expect(html).toContain('aria-label="Assento B-2, bloqueado');
    expect(html).toContain("Assento A-1, disponível, assento acessível");
    expect(html).toContain("acessível");
    expect(html).toContain("Reservado");
    expect(html).toContain("Vendido");
    expect(html).toContain("Bloqueado");
    expect(html).toContain("Lista de assentos");
    expect(html).toContain("Categoria: plateia");
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

  it("aplica o tipo escolhido ao selecionar dois assentos e inclui sessão no checkout", () => {
    const mapaComDoisDisponiveis: PublicMap = { ...mapa, seats: [assentos[0], { ...assentos[1], id: "s-5", seatNumber: "3", state: "available" }, assentos[2], assentos[3]] };
    render(<MapaAssentos map={mapaComDoisDisponiveis} checkoutHref="/checkout?slug=festival" ticketTypes={[tipoInteira, tipoMeia]} initialTicketTypeId="meia" />);
    const lista = screen.getByRole("list", { name: "Assentos da fileira A" });
    fireEvent.click(within(lista).getByRole("button", { name: /Assento A-1/ }));
    fireEvent.click(within(lista).getByRole("button", { name: /Assento A-3/ }));
    const selects = screen.getAllByRole("combobox", { name: /Tipo de ingresso do assento/ });
    expect(selects).toHaveLength(2);
    expect((selects[0] as HTMLSelectElement).value).toBe("meia");
    expect((selects[1] as HTMLSelectElement).value).toBe("meia");
    fireEvent.change(selects[0], { target: { value: "inteira" } });
    const href = screen.getAllByRole("link", { name: "Continuar para checkout" }).at(-1)?.getAttribute("href");
    expect(href).toContain("sessionId=sessao-1");
    expect(href).toContain("ticketTypeIds=inteira%2Cmeia");
  });

  it("não permite selecionar assentos indisponíveis", () => {
    render(<MapaAssentos map={mapa} checkoutHref="/checkout" ticketTypes={[tipoInteira]} />);
    expect(screen.queryByRole("button", { name: /reservado/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /vendido/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /bloqueado/i })).toBeNull();
  });

  it("oferece fileiras únicas na ordem de aparição e inicia na primeira com disponibilidade", () => {
    render(<MapaAssentos map={mapa} checkoutHref="/checkout" ticketTypes={[tipoInteira]} />);

    const seletor = screen.getByRole("combobox", { name: "Escolha uma fileira" }) as HTMLSelectElement;
    expect(Array.from(seletor.options).map((option) => option.value)).toEqual(["A", "B"]);
    expect(seletor.value).toBe("A");
  });

  it("filtra a lista mobile pela fileira escolhida", () => {
    render(<MapaAssentos map={mapa} checkoutHref="/checkout" ticketTypes={[tipoInteira]} />);

    const seletor = screen.getByRole("combobox", { name: "Escolha uma fileira" });
    const listaA = screen.getByRole("list", { name: "Assentos da fileira A" });
    expect(within(listaA).getByText("Assento A-1")).toBeTruthy();
    expect(within(listaA).queryByText("Assento B-1")).toBeNull();

    fireEvent.change(seletor, { target: { value: "B" } });
    const listaB = screen.getByRole("list", { name: "Assentos da fileira B" });
    expect(within(listaB).getByText("Assento B-1")).toBeTruthy();
    expect(within(listaB).queryByText("Assento A-1")).toBeNull();
  });

  it("oferece modos lista e mapa e orienta sobre o mapa rolável", () => {
    render(<MapaAssentos map={mapa} checkoutHref="/checkout" ticketTypes={[tipoInteira]} />);

    expect(screen.getByRole("button", { name: "Lista" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Mapa" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText(/mapa rolável/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mapa" }));
    expect(screen.getByRole("button", { name: "Mapa" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("mostra estados indisponíveis na lista sem transformá-los em botões", () => {
    render(<MapaAssentos map={mapa} checkoutHref="/checkout" ticketTypes={[tipoInteira]} />);

    const lista = screen.getByRole("list", { name: "Assentos da fileira A" });
    expect(within(lista).getByText(/Estado: reservado/)).toBeTruthy();
    expect(within(lista).queryByRole("button", { name: /reservado/i })).toBeNull();
  });

  it("informa quando a fileira ativa não tem assentos disponíveis", () => {
    const mapaIndisponivel: PublicMap = { ...mapa, seats: assentos.map((seat) => ({ ...seat, state: "sold" as const })) };
    render(<MapaAssentos map={mapaIndisponivel} checkoutHref="/checkout" ticketTypes={[tipoInteira]} />);

    expect(screen.getByText("Nenhum assento disponível nesta fileira.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Assento A-/ })).toBeNull();
  });
});

  it("mantém os tipos de ingresso alinhados no checkout e evita mapa de sessão não vendável", async () => {
    const { readFileSync } = await import("node:fs");
    const checkout = readFileSync("app/checkout/page.tsx", "utf8");
    const sessionPage = readFileSync("app/evento/[slug]/sessao/[sessionId]/page.tsx", "utf8");
    expect(checkout).toContain("ticketTypeIds");
    expect(checkout).toContain("split(\",\")");
    expect(sessionPage).toContain("if (!session || session.availability !== \"available\"");
  });
