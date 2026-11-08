// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicMap } from "@essencia/shared/types";
import { coresPublicas, MapaPublico, rotuloAcessivelPublico } from "../mapa/mapa-publico";
import { paraLugaresPublicos } from "../mapa/adaptar-mapa";

afterEach(cleanup);

const mapa: PublicMap = {
  sessionId: "sessao",
  mapId: "mapa",
  seats: [
    { id: "livre", sessionId: "sessao", rowLabel: "G", seatNumber: "21", x: 10, y: 20, width: 30, height: 20, category: "COMUM", accessible: false, state: "available" },
    { id: "ocupado", sessionId: "sessao", rowLabel: "G", seatNumber: "22", x: 50, y: 20, width: 30, height: 20, category: "COMUM", accessible: false, state: "sold" },
    { id: "acessivel", sessionId: "sessao", rowLabel: "H", seatNumber: "1", x: 10, y: 80, width: 30, height: 20, category: "CADEIRANTE", accessible: true, state: "available" },
  ],
};

describe("MapaPublico", () => {
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
  });
});
