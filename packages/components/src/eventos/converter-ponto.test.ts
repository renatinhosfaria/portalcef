import { describe, expect, it } from "vitest";
import { converterPontoTela, transformParaFoco } from "./converter-ponto";

const caixa = { left: 0, top: 0, width: 1000, height: 500 };

describe("converterPontoTela", () => {
  it("converte o clique para o mapa considerando o 'meet' e o zoom", () => {
    // mapa 8420x5950 em 1000x500: escala = min(1000/8420, 500/5950) = 500/5950
    const escala = 500 / 5950;
    const margemX = (1000 - 8420 * escala) / 2;
    const base = { caixa, largura: 8420, altura: 5950 };

    const centro = converterPontoTela({ ...base, clientX: 500, clientY: 250, zoom: { x: 0, y: 0, k: 1 } });
    expect(centro.x).toBeCloseTo(4210, 5);
    expect(centro.y).toBeCloseTo(2975, 5);

    const origem = converterPontoTela({ ...base, clientX: margemX, clientY: 0, zoom: { x: 0, y: 0, k: 1 } });
    expect(origem.x).toBeCloseTo(0, 5);
    expect(origem.y).toBeCloseTo(0, 5);

    // com zoom: ponto do mapa = (ponto na viewBox - x) / k
    const comZoom = converterPontoTela({ ...base, clientX: 500, clientY: 250, zoom: { x: -100, y: -50, k: 2 } });
    expect(comZoom.x).toBeCloseTo((4210 + 100) / 2, 5);
    expect(comZoom.y).toBeCloseTo((2975 + 50) / 2, 5);
  });

  it("considera a posição da caixa na tela", () => {
    const ponto = converterPontoTela({
      clientX: 600, clientY: 300, caixa: { left: 100, top: 50, width: 1000, height: 500 },
      largura: 8420, altura: 5950, zoom: { x: 0, y: 0, k: 1 },
    });
    expect(ponto.x).toBeCloseTo(4210, 5);
    expect(ponto.y).toBeCloseTo(2975, 5);
  });
});

describe("transformParaFoco", () => {
  it("enquadra a caixa com 20% de margem e centraliza", () => {
    const t = transformParaFoco({ x: 1000, y: 1000, largura: 1000, altura: 500 }, 8420, 5950);
    // k = min(8420/1200, 5950/600) = 7.0166...
    expect(t.k).toBeCloseTo(8420 / 1200, 5);
    expect(t.x).toBeCloseTo(8420 / 2 - t.k * 1500, 5);
    expect(t.y).toBeCloseTo(5950 / 2 - t.k * 1250, 5);
  });

  it("limita a escala entre 1 e 8", () => {
    expect(transformParaFoco({ x: 0, y: 0, largura: 10, altura: 10 }, 8420, 5950).k).toBe(8);
    expect(transformParaFoco({ x: 0, y: 0, largura: 20000, altura: 20000 }, 8420, 5950).k).toBe(1);
  });
});
