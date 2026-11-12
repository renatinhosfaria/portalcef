import { describe, expect, it } from "vitest";
import type { PublicMap } from "@essencia/shared/types";
import { dimensoesDoMapa, elementosDoMapa, paraLugaresPublicos, rotulosDoMapa } from "./adaptar-mapa";

const mapaBase: PublicMap = {
  sessionId: "sessao",
  mapId: "mapa",
  seats: [
    { id: "a", sessionId: "sessao", rowLabel: "G", seatNumber: "21", x: 10, y: 20, width: 30, height: 20, category: "CADEIRANTE", accessible: true, state: "available", rotacao: 15 },
    { id: "b", sessionId: "sessao", rowLabel: "G", seatNumber: "22", x: 50, y: 20, width: 30, height: 20, category: "desconhecida", accessible: false, state: "reserved" },
    { id: "c", sessionId: "sessao", rowLabel: "H", seatNumber: "1", x: 10, y: 80, width: 30, height: 20, category: null, accessible: false, state: "blocked" },
    { id: "d", sessionId: "sessao", rowLabel: "H", seatNumber: "2", x: 50, y: 80, width: 30, height: 20, category: null, accessible: false, state: "blocked" },
  ],
  layout: { largura: 200, altura: 150, rotulos: [], elementos: [] },
};

describe("adaptação do mapa público", () => {
  it("converte canto superior esquerdo em centro e mantém a rotação", () => {
    const [lugar] = paraLugaresPublicos(mapaBase);
    expect(lugar).toMatchObject({ id: "a", x: 25, y: 30, largura: 30, altura: 20, rotacao: 15, rotuloCurto: "G21", livre: true, acessivel: true });
  });

  it("usa rotação zero quando o assento não informa rotação", () => {
    const [lugar] = paraLugaresPublicos({ ...mapaBase, seats: [{ ...mapaBase.seats[0]!, rotacao: undefined }] });
    expect(lugar?.rotacao).toBe(0);
  });

  it("reservado, vendido, bloqueado e indisponível viram ocupado", () => {
    const mapa: PublicMap = {
      ...mapaBase,
      seats: mapaBase.seats.map((seat, index) => ({
        ...seat,
        id: String(index),
        state: index === 0 ? "available" : index === 1 ? "reserved" : index === 2 ? "sold" : "blocked",
      })),
    };
    const lugares = paraLugaresPublicos(mapa, new Set(["0"]));
    expect(lugares.every((lugar) => lugar.livre === false)).toBe(true);
    expect(lugares.every((lugar) => lugar.estado === "bloqueado")).toBe(true);
  });

  it("ignora rótulo de fileira sem assento e acrescenta as pontas", () => {
    const mapa: PublicMap = {
      ...mapaBase,
      layout: { largura: 200, altura: 150, rotulos: [{ fileira: "G", x: 100, y: 30 }, { fileira: "Z", x: 100, y: 120 }], elementos: [] },
    };
    expect(rotulosDoMapa(mapa)).toEqual([
      { fileira: "G", x: -11, y: 30 },
      { fileira: "G", x: 100, y: 30 },
      { fileira: "G", x: 101, y: 30 },
    ]);
  });

  it("cria uma única dupla de pontas quando o layout tem dois rótulos na mesma fileira", () => {
    const mapa: PublicMap = {
      ...mapaBase,
      layout: { largura: 200, altura: 150, rotulos: [{ fileira: "G", x: 100, y: 30 }, { fileira: "G", x: 100, y: 50 }], elementos: [] },
    };
    const rotulos = rotulosDoMapa(mapa);
    expect(rotulos.filter((rotulo) => rotulo.fileira === "G")).toHaveLength(4);
    expect(rotulos.filter((rotulo) => rotulo.fileira === "G" && (rotulo.x === -11 || rotulo.x === 101))).toHaveLength(2);
    expect(rotulos).toEqual(expect.arrayContaining([{ fileira: "G", x: 100, y: 30 }, { fileira: "G", x: 100, y: 50 }]));
  });

  it("acompanha a inclinação da fileira nas letras das pontas", () => {
    const mapa: PublicMap = {
      ...mapaBase,
      seats: [
        { ...mapaBase.seats[0]!, x: 10, y: 20 },
        { ...mapaBase.seats[1]!, x: 50, y: 40 },
      ],
      layout: { largura: 200, altura: 150, rotulos: [{ fileira: "G", x: 100, y: 30 }], elementos: [] },
    };
    expect(rotulosDoMapa(mapa)).toEqual([
      { fileira: "G", x: -11, y: 30 },
      { fileira: "G", x: 100, y: 30 },
      { fileira: "G", x: 101, y: 50 },
    ]);
  });

  it("sem layout usa a caixa dos assentos e não desenha palco", () => {
    const semLayout: PublicMap = { ...mapaBase, layout: null };
    expect(dimensoesDoMapa(semLayout)).toEqual({ largura: 73.5, altura: 84 });
    expect(elementosDoMapa(semLayout)).toEqual([]);
  });
});
