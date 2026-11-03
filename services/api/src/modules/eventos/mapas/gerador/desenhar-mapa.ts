import type { BlocoMontado, NumeroLido } from "./montar-mapa";

/** Posição suavizada e rotação de um número; coordenadas em pontos, rotação em graus. */
export interface LugarDesenhado {
  numeroId: string;
  x: number;
  y: number;
  rotacao: number;
}

const RAD_PARA_GRAUS = 180 / Math.PI;

/** Leva o ângulo para o intervalo (−90°, 90°]. */
function normalizarRotacao(graus: number): number {
  let r = graus % 180;
  if (r > 90) r -= 180;
  if (r <= -90) r += 180;
  return r;
}

function media(valores: number[]): number {
  return valores.reduce((soma, v) => soma + v, 0) / valores.length;
}

function determinante(m: number[][]): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

/** Mínimos quadrados de v = a·u² + b·u + c, resolvido pela regra de Cramer. */
function ajustarParabola(pontos: Array<[number, number]>): { a: number; b: number; c: number } {
  const s = [0, 0, 0, 0, 0];
  const t = [0, 0, 0];
  for (const [u, v] of pontos) {
    const potencias = [1, u, u ** 2, u ** 3, u ** 4];
    for (let k = 0; k < 5; k++) s[k] += potencias[k];
    t[0] += v;
    t[1] += u * v;
    t[2] += u * u * v;
  }
  const matriz = [
    [s[0], s[1], s[2]],
    [s[1], s[2], s[3]],
    [s[2], s[3], s[4]],
  ];
  const det = determinante(matriz) || 1;
  const [c, b, a] = [0, 1, 2].map(
    (k) => determinante(matriz.map((linha, i) => linha.map((valor, j) => (j === k ? t[i] : valor)))) / det,
  );
  return { a, b, c };
}

/** Reta pelos números dados; sem direção própria (um só número), usa o ângulo do texto. */
function desenharEmReta(numeros: NumeroLido[], naLinha: NumeroLido[]): LugarDesenhado[] {
  if (naLinha.length < 2) {
    const angulo = normalizarRotacao(naLinha[0]?.angulo ?? numeros[0].angulo);
    const origem = naLinha[0] ?? numeros[0];
    return numeros.map((n) => ({ ...projetarEmReta(origem, angulo, n), numeroId: n.id }));
  }
  const primeiro = naLinha[0];
  const ultimo = naLinha[naLinha.length - 1];
  const angulo = normalizarRotacao(Math.atan2(ultimo.y - primeiro.y, ultimo.x - primeiro.x) * RAD_PARA_GRAUS);
  return numeros.map((n) => ({ ...projetarEmReta(primeiro, angulo, n), numeroId: n.id }));
}

function projetarEmReta(origem: NumeroLido, angulo: number, n: NumeroLido) {
  const rad = angulo / RAD_PARA_GRAUS;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const u = (n.x - origem.x) * ux + (n.y - origem.y) * uy;
  return { x: origem.x + u * ux, y: origem.y + u * uy, rotacao: angulo };
}

function desenharBloco(bloco: BlocoMontado): LugarDesenhado[] {
  const { numeros } = bloco;
  if (numeros.length === 0) return [];
  if (numeros.length === 1) {
    const [n] = numeros;
    return [{ numeroId: n.id, x: n.x, y: n.y, rotacao: normalizarRotacao(n.angulo) }];
  }
  const fora = new Set(bloco.foraDaLinha);
  const naLinha = numeros.filter((n) => !fora.has(n.id));
  if (numeros.length === 2) {
    const [a, b] = numeros;
    return desenharEmReta([a, b], [a, b]);
  }
  if (naLinha.length < 3) return desenharEmReta(numeros, naLinha);

  const mx = media(naLinha.map((n) => n.x));
  const my = media(naLinha.map((n) => n.y));
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const n of naLinha) {
    sxx += (n.x - mx) ** 2;
    sxy += (n.x - mx) * (n.y - my);
    syy += (n.y - my) ** 2;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);
  const vx = -uy;
  const vy = ux;
  const emUV = (n: NumeroLido): [number, number] => [
    (n.x - mx) * ux + (n.y - my) * uy,
    (n.x - mx) * vx + (n.y - my) * vy,
  ];

  const { a, b, c } = ajustarParabola(naLinha.map(emUV));
  const u0 = emUV(numeros[0])[0];
  const u1 = emUV(numeros[numeros.length - 1])[0];
  return numeros.map((n, i) => {
    const u = u0 + ((u1 - u0) * i) / (numeros.length - 1);
    const v = a * u * u + c + b * u;
    const inclinacao = 2 * a * u + b;
    return {
      numeroId: n.id,
      x: mx + u * ux + v * vx,
      y: my + u * uy + v * vy,
      rotacao: normalizarRotacao((theta + Math.atan(inclinacao)) * RAD_PARA_GRAUS),
    };
  });
}

/** Suaviza cada bloco numa curva e redistribui os lugares com espaçamento igual. */
export function desenharBlocos(blocos: BlocoMontado[]): LugarDesenhado[] {
  return blocos.flatMap(desenharBloco);
}
