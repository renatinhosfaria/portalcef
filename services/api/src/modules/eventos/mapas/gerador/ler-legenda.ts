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

const ALCANCE_X = 6; // múltiplos do tamanho da amostra
const ALCANCE_Y = 1.2;
const MARGEM = 1;
const ehNumero = (texto: string) => /^\d{1,4}$/.test(texto);

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function interpretarTextoLegenda(texto: string): {
  categoria: CategoriaLugar | null;
  acessoExterno: boolean;
} {
  const t = semAcento(texto).toLowerCase();
  const acessoExterno = t.includes("acesso externo");
  if (t.includes("cadeirant")) {
    return { categoria: t.includes("opcional") ? "OPCIONAL_CADEIRANTE" : "CADEIRANTE", acessoExterno };
  }
  if (t.includes("obes")) return { categoria: "OBESO", acessoExterno };
  return { categoria: null, acessoExterno };
}

export function dentroDaCaixa(ponto: { x: number; y: number }, caixa: Caixa | null): boolean {
  return (
    caixa !== null && ponto.x >= caixa.x0 && ponto.x <= caixa.x1 && ponto.y >= caixa.y0 && ponto.y <= caixa.y1
  );
}

function corMaisUsadaEmNumeros(tokens: TokenLido[]): string | undefined {
  const contagem: Record<string, number> = {};
  for (const t of tokens) if (ehNumero(t.texto)) contagem[t.cor] = (contagem[t.cor] ?? 0) + 1;
  return Object.entries(contagem).sort((a, b) => b[1] - a[1])[0]?.[0];
}

function donaDaFrase(frase: FraseLida, amostras: TokenLido[]): TokenLido | undefined {
  const candidatas = amostras
    .map((amostra) => ({
      amostra,
      dx: frase.esquerda - amostra.x,
      dy: Math.abs(frase.y - amostra.y),
    }))
    .filter(({ amostra, dx, dy }) => dx > 0 && dx <= ALCANCE_X * amostra.tamanho && dy <= ALCANCE_Y * amostra.tamanho)
    .sort((a, b) => a.dy - b.dy || a.dx - b.dx);
  return candidatas[0]?.amostra;
}

function caixaDe(itens: Array<{ x0: number; y0: number; x1: number; y1: number }>): Caixa {
  return {
    x0: Math.min(...itens.map((i) => i.x0)),
    y0: Math.min(...itens.map((i) => i.y0)),
    x1: Math.max(...itens.map((i) => i.x1)),
    y1: Math.max(...itens.map((i) => i.y1)),
  };
}

export function lerLegenda(
  planta: PlantaLida,
  coresDosNumeros: ReadonlySet<string>,
): { entradas: EntradaLegendaLida[]; area: Caixa | null } {
  const corDominante = corMaisUsadaEmNumeros(planta.tokens);
  const amostras = planta.tokens.filter(
    (t) => t.texto.length === 1 && !ehNumero(t.texto) && coresDosNumeros.has(t.cor) && t.cor !== corDominante,
  );

  const grupos = new Map<TokenLido, FraseLida[]>();
  for (const frase of planta.frases) {
    const dona = donaDaFrase(frase, amostras);
    if (dona) grupos.set(dona, [...(grupos.get(dona) ?? []), frase]);
  }

  const entradas: EntradaLegendaLida[] = [];
  const caixas: Caixa[] = [];
  for (const [amostra, frases] of [...grupos].sort((a, b) => a[0].y - b[0].y)) {
    frases.sort((a, b) => a.y - b.y);
    const texto = frases.map((f) => f.texto).join(" ");
    entradas.push({ cor: amostra.cor, texto, ...interpretarTextoLegenda(texto) });

    const meio = amostra.tamanho / 2;
    const folga = MARGEM * amostra.tamanho;
    const partes = [
      { x0: amostra.x - meio, y0: amostra.y - meio, x1: amostra.x + meio, y1: amostra.y + meio },
      ...frases.map((f) => ({
        x0: f.esquerda,
        y0: f.y - f.tamanho / 2,
        x1: 2 * f.x - f.esquerda,
        y1: f.y + f.tamanho / 2,
      })),
    ];
    const c = caixaDe(partes);
    caixas.push({ x0: c.x0 - folga, y0: c.y0 - folga, x1: c.x1 + folga, y1: c.y1 + folga });
  }
  return { entradas, area: caixas.length ? caixaDe(caixas) : null };
}

const PALAVRAS_DE_ELEMENTO: Array<[ElementoLido["tipo"], string]> = [
  ["PALCO", "PALCO"],
  ["ENTRADA", "ENTRADA"],
  ["SAIDA", "SAIDA"],
];

export function lerElementos(planta: PlantaLida, areaLegenda: Caixa | null): ElementoLido[] {
  const elementos: ElementoLido[] = [];
  for (const frase of planta.frases) {
    if (dentroDaCaixa(frase, areaLegenda)) continue;
    const maiusculo = semAcento(frase.texto).toUpperCase();
    const achado = PALAVRAS_DE_ELEMENTO.find(([, palavra]) => maiusculo.includes(palavra));
    if (achado) elementos.push({ tipo: achado[0], texto: frase.texto, x: frase.x, y: frase.y });
  }
  return elementos;
}
