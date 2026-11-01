// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PublicMap, PublicSeat } from "@essencia/shared/types";
import type { AssentoSelecionado } from "../assentos-types";
import { MapaAssentosSvg } from "../mapa-assentos-svg";

const assentos: PublicSeat[] = [
  { id: "s-1", sessionId: "sessao-1", rowLabel: "A", seatNumber: "1", x: 10, y: 20, width: 20, height: 10, category: "plateia", accessible: true, state: "available" },
  { id: "s-2", sessionId: "sessao-1", rowLabel: "A", seatNumber: "2", x: 50, y: 20, width: 20, height: 10, category: "plateia", accessible: false, state: "reserved" },
  { id: "s-3", sessionId: "sessao-1", rowLabel: "B", seatNumber: "1", x: 10, y: 50, width: 20, height: 10, category: null, accessible: false, state: "sold" },
];
const mapa: PublicMap = { sessionId: "sessao-1", mapId: "mapa-1", seats: assentos };

afterEach(() => cleanup());

describe("MapaAssentosSvg", () => {
  it("renderiza SVG com viewBox derivado e um elemento por assento", () => {
    render(<MapaAssentosSvg map={mapa} selection={[]} onToggleSeat={() => undefined} />);
    expect(screen.getByRole("img", { name: "Planta de assentos" }).getAttribute("viewBox")).toBe("10 20 60 40");
    expect(document.querySelectorAll("[data-seat-id]")).toHaveLength(3);
  });

  it("torna somente disponíveis focáveis e acionáveis e descreve indisponíveis", () => {
    const onToggleSeat = vi.fn();
    render(<MapaAssentosSvg map={mapa} selection={[]} onToggleSeat={onToggleSeat} />);
    const disponivel = screen.getByRole("button", { name: /Assento A-1/ });
    expect(disponivel.getAttribute("data-seat-id")).toBe("s-1");
    expect(disponivel.getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("img", { name: /Assento A-2/ }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("img", { name: /Assento A-2/ }).getAttribute("aria-label")).toMatch(/não acessível/);
    expect(screen.getByRole("img", { name: /Assento B-1/ }).getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(disponivel);
    fireEvent.keyDown(disponivel, { key: "Enter" });
    fireEvent.keyDown(disponivel, { key: " " });
    expect(onToggleSeat).toHaveBeenCalledTimes(3);
    expect(onToggleSeat).toHaveBeenCalledWith(assentos[0]);
  });

  it("expõe controles de zoom acessíveis e seleção visual coerente", () => {
    const selection: AssentoSelecionado[] = [{ seatId: "s-1", ticketTypeId: "inteira" }];
    render(<MapaAssentosSvg map={mapa} selection={selection} onToggleSeat={() => undefined} />);
    expect(screen.getByRole("button", { name: "Aumentar zoom" }).getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("button", { name: "Reduzir zoom" }).getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("button", { name: "Centralizar mapa" }).getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("button", { name: /Assento A-1/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Assento A-1/ }).getAttribute("class")).toMatch(/assento-selecionado/);
  });
});
