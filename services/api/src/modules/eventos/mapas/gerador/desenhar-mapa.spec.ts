import type { BlocoMontado, NumeroLido } from "./montar-mapa";
import { desenharBlocos } from "./desenhar-mapa";

const curva = (x: number) => 0.002 * (x - 200) ** 2;
const derivada = (x: number) => 0.004 * (x - 200);

function numero(id: string, n: number, x: number, y: number, angulo = 0): NumeroLido {
  return { id, numero: n, x, y, angulo, cor: "#000000" };
}

/** Ruído determinístico de ±1,5 pt, alternando o sinal (média nula) e com fase diferente em cada eixo. */
function ruido(i: number, eixo: number): number {
  return eixo === 1 ? (i % 2 === 0 ? 1.5 : -1.5) : ((i % 3) - 1) * 1.5;
}

function blocoCurvo(foraDaLinha: number[] = [], deslocamento = 0, amplitudeRuido = 1): BlocoMontado {
  const numeros = Array.from({ length: 15 }, (_, i) => {
    const x = 110 + i * 13;
    const desloc = foraDaLinha.includes(i + 1) ? deslocamento : 0;
    return numero(`n${i + 1}`, i + 1, x + amplitudeRuido * ruido(i, 1), curva(x) + amplitudeRuido * ruido(i, 2) + desloc);
  });
  return {
    id: "b1",
    fileira: "A",
    numeros,
    foraDaLinha: foraDaLinha.map((n) => `n${n}`),
  };
}

/** Distância do ponto à curva verdadeira, por busca densa em x. */
function distanciaAteCurva(x: number, y: number): number {
  let menor = Infinity;
  for (let cx = 100; cx <= 300; cx += 0.05) {
    menor = Math.min(menor, Math.hypot(cx - x, curva(cx) - y));
  }
  return menor;
}

describe("desenharBlocos", () => {
  it("redistribui com espaçamento igual sobre a curva", () => {
    const lugares = desenharBlocos([blocoCurvo()]);
    expect(lugares).toHaveLength(15);
    const dist = lugares.slice(1).map((l, i) => Math.hypot(l.x - lugares[i].x, l.y - lugares[i].y));
    for (let i = 1; i < dist.length; i++) {
      expect(Math.abs(dist[i] - dist[i - 1]) / dist[i - 1]).toBeLessThan(0.03);
    }
    for (const l of lugares) expect(distanciaAteCurva(l.x, l.y)).toBeLessThan(0.5);
  });

  it("gira cada cadeira pela tangente da curva", () => {
    const lugares = desenharBlocos([blocoCurvo()]);
    for (const l of lugares) {
      const esperado = (Math.atan(derivada(l.x)) * 180) / Math.PI;
      expect(Math.abs(l.rotacao - esperado)).toBeLessThan(1);
      expect(l.rotacao).toBeGreaterThan(-90);
      expect(l.rotacao).toBeLessThanOrEqual(90);
    }
  });

  it("projeta os números fora da linha na curva do bloco", () => {
    const bloco = blocoCurvo([13, 14], 10, 0);
    const lugares = desenharBlocos([bloco]);
    const dist = lugares.slice(1).map((l, i) => Math.hypot(l.x - lugares[i].x, l.y - lugares[i].y));
    for (const i of [12, 13]) expect(distanciaAteCurva(lugares[i].x, lugares[i].y)).toBeLessThan(0.5);
    for (let i = 1; i < dist.length; i++) {
      expect(Math.abs(dist[i] - dist[i - 1]) / dist[i - 1]).toBeLessThan(0.03);
    }
    expect(lugares.map((l) => l.numeroId)).toEqual(bloco.numeros.map((n) => n.id));
  });

  it("bloco de dois vira reta e bloco de um mantém a posição e o ângulo do texto", () => {
    const dois: BlocoMontado = {
      id: "b2",
      fileira: "B",
      numeros: [numero("a", 1, 0, 0, 10), numero("b", 2, 10, 10, -20)],
      foraDaLinha: [],
    };
    const um: BlocoMontado = { id: "b3", fileira: "C", numeros: [numero("c", 1, 50, 60, 33)], foraDaLinha: [] };
    const [a, b, c] = desenharBlocos([dois, um]);
    expect(a).toMatchObject({ numeroId: "a", x: 0, y: 0 });
    expect(b.x).toBeCloseTo(10, 6);
    expect(b.y).toBeCloseTo(10, 6);
    expect(a.rotacao).toBeCloseTo(45, 6);
    expect(b.rotacao).toBeCloseTo(45, 6);
    expect(c).toEqual({ numeroId: "c", x: 50, y: 60, rotacao: 33 });
  });

  it("normaliza a rotação para (−90°, 90°]", () => {
    const bloco: BlocoMontado = {
      id: "b4",
      fileira: "D",
      numeros: [numero("a", 1, 100, 0), numero("b", 2, 90, 0)],
      foraDaLinha: [],
    };
    const [a] = desenharBlocos([bloco]);
    expect(a.rotacao).toBeCloseTo(0, 6);
    const [c] = desenharBlocos([
      { id: "b5", fileira: null, numeros: [numero("c", 1, 0, 0, 270)], foraDaLinha: [] },
    ]);
    expect(c.rotacao).toBeCloseTo(-90 + 180, 6);
  });

  describe("bloco de 3 ou mais com menos de 3 na linha", () => {
    const quatro = (foraDaLinha: string[], ys: number[]): BlocoMontado => ({
      id: "b6",
      fileira: "E",
      numeros: ys.map((y, i) => numero(`q${i + 1}`, i + 1, i * 10, y, 30)),
      foraDaLinha,
    });

    it("com 2 na linha, usa a reta do primeiro ao último da linha e projeta os de fora", () => {
      // q1 (0,0) e q4 (30,30) estão na linha; q2 e q3 estão deslocados.
      const lugares = desenharBlocos([quatro(["q2", "q3"], [0, 25, 5, 30])]);
      expect(lugares).toHaveLength(4);
      for (const [i, l] of lugares.entries()) {
        expect(l.rotacao).toBeCloseTo(45, 6);
        if (i === 0 || i === 3) continue;
        expect(l.y).toBeCloseTo(l.x, 6);
      }
      expect(lugares[0]).toMatchObject({ x: 0, y: 0 });
      expect(lugares[1].x).toBeCloseTo(17.5, 6);
      expect(lugares[2].x).toBeCloseTo(12.5, 6);
    });

    it("com 1 na linha, usa a direção do ângulo dele", () => {
      const lugares = desenharBlocos([quatro(["q1", "q3", "q4"], [100, 7, 50, 90])]);
      for (const l of lugares) expect(l.rotacao).toBeCloseTo(30, 6);
      // reta por q2 (10, 7) a 30°
      expect(lugares[1]).toMatchObject({ numeroId: "q2", x: 10, y: 7 });
      for (const l of lugares) {
        expect(l.y - 7).toBeCloseTo((l.x - 10) * Math.tan(Math.PI / 6), 6);
      }
    });

    it("com 0 na linha, usa o ângulo do primeiro número do bloco", () => {
      const lugares = desenharBlocos([quatro(["q1", "q2", "q3", "q4"], [4, 80, 20, 60])]);
      for (const l of lugares) {
        expect(l.rotacao).toBeCloseTo(30, 6);
        expect(l.y - 4).toBeCloseTo(l.x * Math.tan(Math.PI / 6), 6);
      }
    });
  });
});
