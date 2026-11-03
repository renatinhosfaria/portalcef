import type { CategoriaLugar } from "@essencia/shared/eventos/mapa-proposta";
import type { FraseLida, PlantaLida, TokenLido } from "./ler-planta-pdf";

export interface Caixa {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface EntradaLegendaLida {
  cor: string;
  texto: string;
  categoria: CategoriaLugar | null;
  acessoExterno: boolean;
}

export interface ElementoLido {
  tipo: "PALCO" | "ENTRADA" | "SAIDA";
  texto: string;
  x: number;
  y: number;
}

const ALCANCE_HORIZONTAL_EM_TAMANHOS = 6;
const ALCANCE_VERTICAL_EM_TAMANHOS = 1.2;
const MARGEM_DA_AREA_EM_TAMANHOS = 1;
const PADRAO_NUMERO = /^\d{1,4}$/;

/** Remove acentos e passa para minúsculas. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function interpretarTextoLegenda(texto: string): {
  categoria: CategoriaLugar | null;
  acessoExterno: boolean;
} {
  const normalizado = normalizar(texto);
  let categoria: CategoriaLugar | null = null;
  if (normalizado.includes("cadeirant")) {
    categoria = normalizado.includes("opcional") ? "OPCIONAL_CADEIRANTE" : "CADEIRANTE";
  } else if (normalizado.includes("obes")) {
    categoria = "OBESO";
  }
  return { categoria, acessoExterno: normalizado.includes("acesso externo") };
}

export function dentroDaCaixa(ponto: { x: number; y: number }, caixa: Caixa | null): boolean {
  if (!caixa) return false;
  return ponto.x >= caixa.x0 && ponto.x <= caixa.x1 && ponto.y >= caixa.y0 && ponto.y <= caixa.y1;
}

/** Cor mais frequente entre os tokens numéricos. */
function corDominanteDosNumeros(tokens: TokenLido[]): string | null {
  const contagem = new Map<string, number>();
  for (const t of tokens) {
    if (PADRAO_NUMERO.test(t.texto)) contagem.set(t.cor, (contagem.get(t.cor) ?? 0) + 1);
  }
  let dominante: string | null = null;
  let maior = 0;
  for (const [cor, quantidade] of contagem) {
    if (quantidade > maior) {
      dominante = cor;
      maior = quantidade;
    }
  }
  return dominante;
}

function caixaDaFrase(f: FraseLida): Caixa {
  const direita = f.x + (f.x - f.esquerda);
  return { x0: f.esquerda, y0: f.y - f.tamanho / 2, x1: direita, y1: f.y + f.tamanho / 2 };
}

function caixaDaAmostra(t: TokenLido): Caixa {
  return { x0: t.x - t.tamanho / 2, y0: t.y - t.tamanho / 2, x1: t.x + t.tamanho / 2, y1: t.y + t.tamanho / 2 };
}

function uniao(caixas: Caixa[]): Caixa {
  return {
    x0: Math.min(...caixas.map((c) => c.x0)),
    y0: Math.min(...caixas.map((c) => c.y0)),
    x1: Math.max(...caixas.map((c) => c.x1)),
    y1: Math.max(...caixas.map((c) => c.y1)),
  };
}

/** Amostra mais próxima à esquerda da frase, dentro do alcance relativo ao tamanho dela. */
function amostraDaFrase(f: FraseLida, amostras: TokenLido[]): TokenLido | null {
  let melhor: TokenLido | null = null;
  let melhorDy = Infinity;
  let melhorDx = Infinity;
  for (const a of amostras) {
    const dx = f.esquerda - a.x;
    const dy = Math.abs(f.y - a.y);
    if (dx <= 0 || dx > ALCANCE_HORIZONTAL_EM_TAMANHOS * a.tamanho) continue;
    if (dy > ALCANCE_VERTICAL_EM_TAMANHOS * a.tamanho) continue;
    if (dy < melhorDy || (dy === melhorDy && dx < melhorDx)) {
      melhor = a;
      melhorDy = dy;
      melhorDx = dx;
    }
  }
  return melhor;
}

export function lerLegenda(
  planta: PlantaLida,
  coresDosNumeros: ReadonlySet<string>,
): { entradas: EntradaLegendaLida[]; area: Caixa | null } {
  const dominante = corDominanteDosNumeros(planta.tokens);
  const amostras = planta.tokens.filter(
    (t) => t.texto.length === 1 && !PADRAO_NUMERO.test(t.texto) && coresDosNumeros.has(t.cor) && t.cor !== dominante,
  );

  const frasesPorAmostra = new Map<TokenLido, FraseLida[]>();
  for (const f of planta.frases) {
    const amostra = amostraDaFrase(f, amostras);
    if (!amostra) continue;
    frasesPorAmostra.set(amostra, [...(frasesPorAmostra.get(amostra) ?? []), f]);
  }

  const entradas: EntradaLegendaLida[] = [];
  const caixas: Caixa[] = [];
  const ordenadas = [...frasesPorAmostra.keys()].sort((a, b) => a.y - b.y);
  for (const amostra of ordenadas) {
    const frases = [...(frasesPorAmostra.get(amostra) ?? [])].sort((a, b) => a.y - b.y);
    const texto = frases.map((f) => f.texto).join(" ");
    entradas.push({ cor: amostra.cor, texto, ...interpretarTextoLegenda(texto) });
    const margem = MARGEM_DA_AREA_EM_TAMANHOS * amostra.tamanho;
    const caixa = uniao([caixaDaAmostra(amostra), ...frases.map(caixaDaFrase)]);
    caixas.push({ x0: caixa.x0 - margem, y0: caixa.y0 - margem, x1: caixa.x1 + margem, y1: caixa.y1 + margem });
  }

  return { entradas, area: caixas.length > 0 ? uniao(caixas) : null };
}

export function lerElementos(planta: PlantaLida, areaLegenda: Caixa | null): ElementoLido[] {
  const elementos: ElementoLido[] = [];
  for (const f of planta.frases) {
    if (dentroDaCaixa(f, areaLegenda)) continue;
    const texto = normalizar(f.texto).toUpperCase();
    const tipo = texto.includes("PALCO")
      ? "PALCO"
      : texto.includes("ENTRADA")
        ? "ENTRADA"
        : texto.includes("SAIDA")
          ? "SAIDA"
          : null;
    if (tipo) elementos.push({ tipo, texto: f.texto, x: f.x, y: f.y });
  }
  return elementos;
}
