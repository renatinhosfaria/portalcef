import type { PublicMap, PublicSeat } from "@essencia/shared/types";
import {
  CATEGORIAS_LUGAR,
  type CategoriaLugar,
  type ElementoPlanta,
  type RotuloFileira,
} from "@essencia/shared/eventos/mapa-proposta";
import type { LugarMapa } from "@essencia/components/eventos/mapa-estilo-b";

function rotuloCurto(seat: { rowLabel: string; seatNumber: string }): string {
  return `${seat.rowLabel}${seat.seatNumber}`;
}

export interface LugarPublico extends LugarMapa {
  livre: boolean;
  acessivel: boolean;
  rotuloCurto: string;
}

function categoriaValida(category: string | null): CategoriaLugar | null {
  return category && (CATEGORIAS_LUGAR as readonly string[]).includes(category) ? (category as CategoriaLugar) : null;
}

function caixaDosAssentos(map: PublicMap): { minX: number; maxX: number; minY: number; maxY: number } {
  if (map.seats.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  return map.seats.reduce(
    (caixa, seat) => ({
      minX: Math.min(caixa.minX, seat.x),
      maxX: Math.max(caixa.maxX, seat.x + seat.width),
      minY: Math.min(caixa.minY, seat.y),
      maxY: Math.max(caixa.maxY, seat.y + seat.height),
    }),
    { minX: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY },
  );
}

function deslocamentoSemLayout(map: PublicMap): { x: number; y: number } {
  if (map.layout) return { x: 0, y: 0 };
  const caixa = caixaDosAssentos(map);
  const margemX = (caixa.maxX - caixa.minX) * 0.05;
  const margemY = (caixa.maxY - caixa.minY) * 0.05;
  return { x: margemX - caixa.minX, y: margemY - caixa.minY };
}

export function paraLugaresPublicos(map: PublicMap, indisponiveis: ReadonlySet<string> = new Set()): LugarPublico[] {
  const deslocamento = deslocamentoSemLayout(map);
  return map.seats.map((seat) => {
    const categoria = categoriaValida(seat.category);
    const livre = seat.state === "available" && !indisponiveis.has(seat.id);
    return {
      id: seat.id,
      fileira: seat.rowLabel,
      numero: seat.seatNumber,
      x: seat.x + seat.width / 2 + deslocamento.x,
      y: seat.y + seat.height / 2 + deslocamento.y,
      largura: seat.width,
      altura: seat.height,
      rotacao: seat.rotacao ?? 0,
      categoria,
      acessoExterno: false,
      estado: "livre",
      livre,
      acessivel: seat.accessible || categoria === "CADEIRANTE" || categoria === "OPCIONAL_CADEIRANTE" || categoria === "OBESO",
      rotuloCurto: rotuloCurto(seat),
    };
  });
}

export function rotulosDoMapa(map: PublicMap): RotuloFileira[] {
  const assentosPorFileira = new Map<string, PublicSeat[]>();
  for (const seat of map.seats) {
    const assentos = assentosPorFileira.get(seat.rowLabel) ?? [];
    assentos.push(seat);
    assentosPorFileira.set(seat.rowLabel, assentos);
  }

  const criarPontas = (fileira: string, assentos: PublicSeat[]): RotuloFileira[] => {
    const ordenados = [...assentos].sort((a, b) => a.x - b.x);
    const larguraEsquerda = ordenados[0]?.width ?? 0;
    const larguraDireita = ordenados.at(-1)?.width ?? larguraEsquerda;
    const deslocamento = deslocamentoSemLayout(map);
    const centroEsquerda = (ordenados[0]?.x ?? 0) + (ordenados[0]?.width ?? 0) / 2 + deslocamento.x;
    const centroDireita = (ordenados.at(-1)?.x ?? 0) + (ordenados.at(-1)?.width ?? 0) / 2 + deslocamento.x;
    const centroYEsquerda = (ordenados[0]?.y ?? 0) + (ordenados[0]?.height ?? 0) / 2 + deslocamento.y;
    const centroYDireita = (ordenados.at(-1)?.y ?? 0) + (ordenados.at(-1)?.height ?? 0) / 2 + deslocamento.y;
    return [
      { fileira, x: centroEsquerda - 1.2 * larguraEsquerda, y: centroYEsquerda },
      { fileira, x: centroDireita + 1.2 * larguraDireita, y: centroYDireita },
    ];
  };

  if (!map.layout) {
    return [...assentosPorFileira.entries()].flatMap(([fileira, assentos]) => criarPontas(fileira, assentos));
  }

  const rotulosPorFileira = new Map<string, RotuloFileira[]>();
  for (const rotulo of map.layout.rotulos) {
    const rotulos = rotulosPorFileira.get(rotulo.fileira) ?? [];
    rotulos.push(rotulo);
    rotulosPorFileira.set(rotulo.fileira, rotulos);
  }
  return [...rotulosPorFileira.entries()].flatMap(([fileira, rotulos]) => {
    const assentos = assentosPorFileira.get(fileira);
    if (!assentos?.length) return [];
    const pontas = criarPontas(fileira, assentos);
    return [pontas[0]!, ...rotulos, pontas[1]!];
  });
}

export function dimensoesDoMapa(map: PublicMap): { largura: number; altura: number } {
  if (map.layout) return { largura: map.layout.largura, altura: map.layout.altura };
  const caixa = caixaDosAssentos(map);
  return { largura: Math.max(1, caixa.maxX - caixa.minX) * 1.05, altura: Math.max(1, caixa.maxY - caixa.minY) * 1.05 };
}

export function elementosDoMapa(map: PublicMap): ElementoPlanta[] {
  return map.layout?.elementos ?? [];
}
