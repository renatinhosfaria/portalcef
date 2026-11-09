// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicMap } from "@essencia/shared/types";
import { calcularFocoMobile, coresPublicas, MapaPublico, rotuloAcessivelPublico } from "../mapa/mapa-publico";
import { paraLugaresPublicos } from "../mapa/adaptar-mapa";
import { Minimapa } from "../mapa/minimapa";

afterEach(cleanup);

const mapa: PublicMap = {
  sessionId: "sessao",
  mapId: "mapa",
  layout: { largura: 120, altura: 120, rotulos: [], elementos: [] },
  seats: [
    { id: "livre", sessionId: "sessao", rowLabel: "G", seatNumber: "21", x: 10, y: 20, width: 30, height: 20, category: "COMUM", accessible: false, state: "available" },
    { id: "ocupado", sessionId: "sessao", rowLabel: "G", seatNumber: "22", x: 50, y: 20, width: 30, height: 20, category: "COMUM", accessible: false, state: "sold" },
    { id: "acessivel", sessionId: "sessao", rowLabel: "H", seatNumber: "1", x: 10, y: 80, width: 30, height: 20, category: "CADEIRANTE", accessible: true, state: "available" },
  ],
};

describe("MapaPublico", () => {
  function configurarViewportMobile(inicial: boolean) {
    let atual = inicial;
    const listeners = new Set<(evento: MediaQueryListEvent) => void>();
    let addEventListenerCalls = 0;
    let addListenerCalls = 0;
    const mediaQuery = {
      get matches() { return atual; },
      media: "(max-width: 767px)",
      addEventListener: (_tipo: string, listener: (evento: MediaQueryListEvent) => void) => { addEventListenerCalls += 1; listeners.add(listener); },
      removeEventListener: (_tipo: string, listener: (evento: MediaQueryListEvent) => void) => listeners.delete(listener),
      addListener: (listener: (evento: MediaQueryListEvent) => void) => { addListenerCalls += 1; listeners.add(listener); },
      removeListener: (listener: (evento: MediaQueryListEvent) => void) => listeners.delete(listener),
      onchange: null,
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
    vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));
    return {
      alterar(valor: boolean) {
        atual = valor;
        listeners.forEach((listener) => listener({ matches: valor, media: mediaQuery.media } as MediaQueryListEvent));
      },
      contadores() { return { addEventListenerCalls, addListenerCalls }; },
    };
  }

  it("usa a tabela pública de cores para livre, seu lugar, ocupado e acessível", () => {
    const lugares = paraLugaresPublicos(mapa);
    expect(coresPublicas(lugares[0]!, false)).toEqual({ preenchimento: "#ffffff", contorno: "#9fb08a", numero: "#1f2a24" });
    expect(coresPublicas(lugares[0]!, true)).toEqual({ preenchimento: "#3f6f12", contorno: "#2a4d0a", numero: "#ffffff" });
    expect(coresPublicas({ ...lugares[0]!, livre: false }, false)).toEqual({ preenchimento: "#e4e6e1", contorno: "#c9cdc6", numero: "#8a918c" });
    expect(coresPublicas(lugares[2]!, false)).toEqual({ preenchimento: "#eff6ff", contorno: "#3b82f6", numero: "#1e3a8a" });
  });

  it("clica em lugar livre e não clica em ocupado", () => {
    const onAlternar = vi.fn();
    render(<MapaPublico map={mapa} selecionados={new Set()} onAlternar={onAlternar} />);
    fireEvent.click(screen.getByRole("button", { name: /Fileira G, assento 21/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fileira G, assento 22/ }));
    expect(onAlternar).toHaveBeenCalledTimes(1);
    expect(onAlternar).toHaveBeenCalledWith("livre");
  });

  it("mostra legenda e rótulo acessível", () => {
    const lugar = paraLugaresPublicos(mapa)[0]!;
    expect(rotuloAcessivelPublico(lugar, true)).toBe("Fileira G, assento 21, livre, seu lugar");
    render(<MapaPublico map={mapa} selecionados={new Set(["livre"])} onAlternar={() => undefined} />);
    expect(screen.getByText("Livre")).toBeTruthy();
    expect(screen.getByText("Seu lugar")).toBeTruthy();
    expect(screen.getByText("Ocupado")).toBeTruthy();
    expect(screen.getByText("Acessível")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Legenda do mapa" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Fileira G, assento 21/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("mostra a janela do minimapa somente acima de k=1.5", () => {
    const lugares = paraLugaresPublicos(mapa);
    const { container, rerender } = render(<Minimapa largura={100} altura={100} lugares={lugares} transformacao={{ x: 0, y: 0, k: 1.5 }} />);
    expect(container.querySelector("[data-minimapa-viewport]")).toBeNull();
    rerender(<Minimapa largura={100} altura={100} lugares={lugares} transformacao={{ x: 0, y: 0, k: 1.51 }} />);
    expect(container.querySelector("[data-minimapa-viewport]")).not.toBeNull();
  });

  it("inicia ampliado na área dos assentos em viewport mobile", async () => {
    configurarViewportMobile(true);
    render(<MapaPublico map={mapa} selecionados={new Set()} onAlternar={() => undefined} />);
    await waitFor(() => expect(screen.getByRole("group", { name: "Mapa público de assentos" }).querySelector("g")?.getAttribute("transform")).toMatch(/scale\((?:1\.(?:[0-9]*[1-9][0-9]*)|[2-9])/));
  });

  it("mantém a visão completa no desktop e quando o mapa não tem assentos", async () => {
    configurarViewportMobile(false);
    const { rerender } = render(<MapaPublico map={mapa} selecionados={new Set()} onAlternar={() => undefined} />);
    await waitFor(() => expect(screen.getByRole("group", { name: "Mapa público de assentos" }).querySelector("g")?.getAttribute("transform")).toMatch(/scale\(1\)/));
    rerender(<MapaPublico map={{ ...mapa, seats: [] }} selecionados={new Set()} onAlternar={() => undefined} />);
    await waitFor(() => expect(screen.getByRole("group", { name: "Mapa público de assentos" }).querySelector("g")?.getAttribute("transform")).toMatch(/scale\(1\)/));
  });

  it("atualiza o enquadramento ao trocar a viewport", async () => {
    const viewport = configurarViewportMobile(false);
    render(<MapaPublico map={mapa} selecionados={new Set()} onAlternar={() => undefined} />);
    const svg = screen.getByRole("group", { name: "Mapa público de assentos" });
    await waitFor(() => expect(svg.querySelector("g")?.getAttribute("transform")).toMatch(/scale\(1\)/));
    viewport.alterar(true);
    await waitFor(() => expect(svg.querySelector("g")?.getAttribute("transform")).toMatch(/scale\((?:1\.(?:[0-9]*[1-9][0-9]*)|[2-9])/));
  });

  it("inclui palco, entrada e rótulos de fileira no foco mobile", () => {
    const foco = calcularFocoMobile(
      paraLugaresPublicos(mapa),
      [{ tipo: "PALCO", texto: "PALCO", x: 60, y: 1 }, { tipo: "ENTRADA", texto: "ENTRADA", x: 60, y: 119 }],
      [{ fileira: "G", x: 1, y: 20 }, { fileira: "H", x: 119, y: 80 }],
      { largura: 120, altura: 120 },
    );
    expect(foco).not.toBeNull();
    expect(foco!.x).toBeLessThan(2);
    expect(foco!.y).toBeLessThan(2);
    expect(foco!.x + foco!.largura).toBeGreaterThan(119);
    expect(foco!.y + foco!.altura).toBeGreaterThan(119);
    expect(foco!.largura).toBeLessThan(120);
    expect(foco!.altura).toBeLessThan(120);
  });

  it("prefere o listener moderno de media query quando disponível", () => {
    const viewport = configurarViewportMobile(false);
    render(<MapaPublico map={mapa} selecionados={new Set()} onAlternar={() => undefined} />);
    expect(viewport.contadores()).toEqual({ addEventListenerCalls: 1, addListenerCalls: 0 });
  });

  it("mantém zoom mobile em mapas legados sem layout", async () => {
    configurarViewportMobile(true);
    const mapaLegado = { sessionId: mapa.sessionId, mapId: mapa.mapId, seats: mapa.seats };
    render(<MapaPublico map={mapaLegado} selecionados={new Set()} onAlternar={() => undefined} />);
    await waitFor(() => expect(screen.getByRole("group", { name: "Mapa público de assentos" }).querySelector("g")?.getAttribute("transform")).toMatch(/scale\((?:1\.(?:[0-9]*[1-9][0-9]*)|[2-9])/));
  });
});
