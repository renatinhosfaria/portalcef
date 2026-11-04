import { z } from "zod";

/**
 * Modelo puro da proposta de mapa de assentos gerada a partir de um PDF.
 * Unidade das coordenadas: 1 unidade = 0,1 ponto do PDF (inteiros).
 */

export const CATEGORIAS_LUGAR = ["COMUM", "CADEIRANTE", "OPCIONAL_CADEIRANTE", "OBESO"] as const;
export type CategoriaLugar = (typeof CATEGORIAS_LUGAR)[number];

export const ROTULO_CATEGORIA: Record<CategoriaLugar, string> = {
  COMUM: "Comum",
  CADEIRANTE: "Cadeirante",
  OPCIONAL_CADEIRANTE: "Opcional para cadeirante",
  OBESO: "Especial para obeso",
};

/** Vale `true` para as categorias que ocupam lugar acessível. */
export const CATEGORIA_ACESSIVEL: Record<CategoriaLugar, boolean> = {
  COMUM: false,
  CADEIRANTE: true,
  OPCIONAL_CADEIRANTE: true,
  OBESO: true,
};

export type TipoPonto =
  | "FORA_DA_LINHA"
  | "LETRA_HERDADA"
  | "SEM_FILEIRA"
  | "SALTO_NUMERACAO"
  | "NUMERO_REPETIDO";

export interface LugarProposto {
  id: string;
  fileira: string;
  numero: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
  rotacao: number;
  blocoId: string | null;
  cor: string;
  categoriaManual: CategoriaLugar | null;
  acessoExternoManual: boolean | null;
  vender: boolean;
  origem: "GERADOR" | "MANUAL";
}

export interface EntradaLegenda {
  cor: string;
  texto: string | null;
  quantidade: number;
  categoria: CategoriaLugar | null;
  acessoExterno: boolean;
  confirmada: boolean;
}

export interface PontoConferir {
  id: string;
  tipo: TipoPonto;
  mensagem: string;
  lugarIds: string[];
  conferido: boolean;
}

export interface RotuloFileira {
  fileira: string;
  x: number;
  y: number;
}

export interface ElementoPlanta {
  tipo: "PALCO" | "ENTRADA" | "SAIDA";
  texto: string;
  x: number;
  y: number;
}

export interface PropostaMapa {
  versao: 1;
  revisao: number;
  pagina: { numero: number; largura: number; altura: number };
  lugares: LugarProposto[];
  rotulos: RotuloFileira[];
  elementos: ElementoPlanta[];
  legenda: EntradaLegenda[];
  pontos: PontoConferir[];
}

export interface LayoutMapa {
  versao: 1;
  largura: number;
  altura: number;
  rotulos: RotuloFileira[];
  elementos: ElementoPlanta[];
}

export interface MetadadosAssento {
  rotacao: number;
  blocoId: string | null;
  acessoExterno: boolean;
  origem: "GERADOR" | "MANUAL";
}

export type OperacaoProposta =
  | {
      tipo: "EDITAR_LUGAR";
      lugarId: string;
      fileira?: string;
      numero?: string;
      categoria?: CategoriaLugar | null;
      acessoExterno?: boolean | null;
      vender?: boolean;
    }
  | { tipo: "EXCLUIR_LUGAR"; lugarId: string }
  | { tipo: "ADICIONAR_LUGAR"; lugar: { id: string; fileira: string; numero: string; x: number; y: number } }
  | { tipo: "CONFERIR_PONTO"; pontoId: string }
  | { tipo: "CONFIRMAR_LEGENDA"; cor: string; categoria: CategoriaLugar; acessoExterno: boolean };

const categoriaSchema = z.enum(CATEGORIAS_LUGAR);

export const operacoesPropostaSchema: z.ZodType<OperacaoProposta[]> = z
  .array(
    z.discriminatedUnion("tipo", [
      z.object({
        tipo: z.literal("EDITAR_LUGAR"),
        lugarId: z.string().min(1),
        fileira: z.string().max(20).optional(),
        numero: z.string().max(20).optional(),
        categoria: categoriaSchema.nullable().optional(),
        acessoExterno: z.boolean().nullable().optional(),
        vender: z.boolean().optional(),
      }),
      z.object({ tipo: z.literal("EXCLUIR_LUGAR"), lugarId: z.string().min(1) }),
      z.object({
        tipo: z.literal("ADICIONAR_LUGAR"),
        lugar: z.object({
          id: z.string().min(1),
          fileira: z.string().max(20),
          numero: z.string().max(20),
          x: z.number().int(),
          y: z.number().int(),
        }),
      }),
      z.object({ tipo: z.literal("CONFERIR_PONTO"), pontoId: z.string().min(1) }),
      z.object({
        tipo: z.literal("CONFIRMAR_LEGENDA"),
        cor: z.string().min(1),
        categoria: categoriaSchema,
        acessoExterno: z.boolean(),
      }),
    ]),
  )
  .min(1)
  .max(500);

export class ErroProposta extends Error {
  constructor(
    public readonly code: "PROPOSTA_OPERACAO_INVALIDA",
    message: string,
  ) {
    super(message);
    this.name = "ErroProposta";
  }
}

export type TipoPendencia =
  | "MAPA_VAZIO"
  | "PONTO_NAO_CONFERIDO"
  | "COR_NAO_CONFIRMADA"
  | "LUGAR_REPETIDO"
  | "LUGAR_SEM_FILEIRA"
  | "LUGAR_SEM_NUMERO";

export interface Pendencia {
  tipo: TipoPendencia;
  mensagem: string;
  lugarIds: string[];
}

function entradaDaCor(proposta: PropostaMapa, cor: string): EntradaLegenda | undefined {
  return proposta.legenda.find((entrada) => entrada.cor === cor);
}

export function categoriaEfetiva(proposta: PropostaMapa, lugar: LugarProposto): CategoriaLugar | null {
  return lugar.categoriaManual ?? entradaDaCor(proposta, lugar.cor)?.categoria ?? null;
}

export function acessoExternoEfetivo(proposta: PropostaMapa, lugar: LugarProposto): boolean {
  return lugar.acessoExternoManual ?? entradaDaCor(proposta, lugar.cor)?.acessoExterno ?? false;
}

const FATOR_LARGURA_OBESO = 1.6;

export function dimensoesLugar(
  lugar: LugarProposto,
  categoria: CategoriaLugar | null,
): { largura: number; altura: number } {
  const largura = categoria === "OBESO" ? Math.round(lugar.largura * FATOR_LARGURA_OBESO) : lugar.largura;
  return { largura, altura: lugar.altura };
}

function mediana(valores: number[], padrao: number): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  const central = ordenados[meio];
  if (central === undefined) return padrao;
  if (ordenados.length % 2 === 1) return central;
  return Math.round(((ordenados[meio - 1] ?? central) + central) / 2);
}

function corMaisFrequente(proposta: PropostaMapa): string {
  const contagem = new Map<string, number>();
  for (const lugar of proposta.lugares) {
    contagem.set(lugar.cor, (contagem.get(lugar.cor) ?? 0) + 1);
  }
  let vencedora = proposta.legenda[0]?.cor ?? "#000000";
  let maior = 0;
  for (const [cor, quantidade] of contagem) {
    if (quantidade > maior) {
      vencedora = cor;
      maior = quantidade;
    }
  }
  return vencedora;
}

const TAMANHO_PADRAO_LUGAR = 100;

function exigirLugar(proposta: PropostaMapa, lugarId: string): LugarProposto {
  const lugar = proposta.lugares.find((item) => item.id === lugarId);
  if (!lugar) {
    throw new ErroProposta("PROPOSTA_OPERACAO_INVALIDA", `Lugar ${lugarId} não existe na proposta`);
  }
  return lugar;
}

function aplicarOperacao(proposta: PropostaMapa, operacao: OperacaoProposta): void {
  switch (operacao.tipo) {
    case "EDITAR_LUGAR": {
      const lugar = exigirLugar(proposta, operacao.lugarId);
      if (operacao.fileira !== undefined) lugar.fileira = operacao.fileira.trim();
      if (operacao.numero !== undefined) lugar.numero = operacao.numero.trim();
      if (operacao.categoria !== undefined) lugar.categoriaManual = operacao.categoria;
      if (operacao.acessoExterno !== undefined) lugar.acessoExternoManual = operacao.acessoExterno;
      if (operacao.vender !== undefined) lugar.vender = operacao.vender;
      return;
    }
    case "EXCLUIR_LUGAR": {
      exigirLugar(proposta, operacao.lugarId);
      proposta.lugares = proposta.lugares.filter((lugar) => lugar.id !== operacao.lugarId);
      proposta.pontos = proposta.pontos
        .map((ponto) => ({ ...ponto, lugarIds: ponto.lugarIds.filter((id) => id !== operacao.lugarId) }))
        .filter((ponto) => ponto.lugarIds.length > 0);
      return;
    }
    case "ADICIONAR_LUGAR": {
      if (proposta.lugares.some((lugar) => lugar.id === operacao.lugar.id)) {
        throw new ErroProposta("PROPOSTA_OPERACAO_INVALIDA", `O id ${operacao.lugar.id} já está em uso`);
      }
      proposta.lugares.push({
        id: operacao.lugar.id,
        fileira: operacao.lugar.fileira.trim(),
        numero: operacao.lugar.numero.trim(),
        x: operacao.lugar.x,
        y: operacao.lugar.y,
        largura: mediana(
          proposta.lugares.map((lugar) => lugar.largura),
          TAMANHO_PADRAO_LUGAR,
        ),
        altura: mediana(
          proposta.lugares.map((lugar) => lugar.altura),
          TAMANHO_PADRAO_LUGAR,
        ),
        rotacao: 0,
        blocoId: null,
        cor: corMaisFrequente(proposta),
        categoriaManual: null,
        acessoExternoManual: null,
        vender: true,
        origem: "MANUAL",
      });
      return;
    }
    case "CONFERIR_PONTO": {
      const ponto = proposta.pontos.find((item) => item.id === operacao.pontoId);
      if (!ponto) {
        throw new ErroProposta("PROPOSTA_OPERACAO_INVALIDA", `Ponto ${operacao.pontoId} não existe na proposta`);
      }
      ponto.conferido = true;
      return;
    }
    case "CONFIRMAR_LEGENDA": {
      const entrada = entradaDaCor(proposta, operacao.cor);
      if (!entrada) {
        throw new ErroProposta("PROPOSTA_OPERACAO_INVALIDA", `A cor ${operacao.cor} não existe na legenda`);
      }
      entrada.categoria = operacao.categoria;
      entrada.acessoExterno = operacao.acessoExterno;
      entrada.confirmada = true;
      return;
    }
  }
}

/** Aplica as operações em ordem, sem mutar a original; a revisão sobe 1 por chamada. */
export function aplicarOperacoes(proposta: PropostaMapa, operacoes: OperacaoProposta[]): PropostaMapa {
  const copia = structuredClone(proposta);
  for (const operacao of operacoes) {
    aplicarOperacao(copia, operacao);
  }
  copia.revisao = proposta.revisao + 1;
  return copia;
}

export function pendenciasPublicacao(proposta: PropostaMapa): Pendencia[] {
  const pendencias: Pendencia[] = [];

  if (proposta.lugares.length === 0) {
    pendencias.push({ tipo: "MAPA_VAZIO", mensagem: "O mapa não tem nenhum lugar", lugarIds: [] });
  }

  for (const ponto of proposta.pontos) {
    if (!ponto.conferido) {
      pendencias.push({ tipo: "PONTO_NAO_CONFERIDO", mensagem: ponto.mensagem, lugarIds: [...ponto.lugarIds] });
    }
  }

  for (const entrada of proposta.legenda) {
    const lugarIds = proposta.lugares.filter((lugar) => lugar.cor === entrada.cor).map((lugar) => lugar.id);
    if (!entrada.confirmada && lugarIds.length > 0) {
      pendencias.push({
        tipo: "COR_NAO_CONFIRMADA",
        mensagem: `Confirme o significado da cor ${entrada.cor}`,
        lugarIds,
      });
    }
  }

  const semFileira = proposta.lugares.filter((lugar) => lugar.fileira.trim() === "");
  for (const lugar of semFileira) {
    pendencias.push({
      tipo: "LUGAR_SEM_FILEIRA",
      mensagem: `O lugar ${lugar.numero} está sem fileira`,
      lugarIds: [lugar.id],
    });
  }

  for (const lugar of proposta.lugares) {
    if (lugar.numero.trim() !== "") continue;
    const fileira = lugar.fileira.trim();
    pendencias.push({
      tipo: "LUGAR_SEM_NUMERO",
      mensagem: fileira === "" ? "Há lugar sem número." : `Há lugar sem número na fileira ${fileira}.`,
      lugarIds: [lugar.id],
    });
  }

  const porRotulo = new Map<string, LugarProposto[]>();
  for (const lugar of proposta.lugares) {
    if (lugar.fileira.trim() === "" || lugar.numero.trim() === "") continue;
    const rotulo = `${lugar.fileira.trim()}-${lugar.numero.trim()}`;
    porRotulo.set(rotulo, [...(porRotulo.get(rotulo) ?? []), lugar]);
  }
  for (const [rotulo, lugares] of porRotulo) {
    if (lugares.length > 1) {
      pendencias.push({
        tipo: "LUGAR_REPETIDO",
        mensagem: `${rotulo} aparece duas vezes`,
        lugarIds: lugares.map((lugar) => lugar.id),
      });
    }
  }

  return pendencias;
}

export function resumoProposta(proposta: PropostaMapa): {
  fileiras: number;
  blocos: number;
  lugares: number;
  porCategoria: Record<CategoriaLugar | "SEM_CATEGORIA", number>;
  acessoExterno: number;
  naoVender: number;
} {
  const porCategoria: Record<CategoriaLugar | "SEM_CATEGORIA", number> = {
    COMUM: 0,
    CADEIRANTE: 0,
    OPCIONAL_CADEIRANTE: 0,
    OBESO: 0,
    SEM_CATEGORIA: 0,
  };
  let acessoExterno = 0;
  let naoVender = 0;
  for (const lugar of proposta.lugares) {
    porCategoria[categoriaEfetiva(proposta, lugar) ?? "SEM_CATEGORIA"] += 1;
    if (acessoExternoEfetivo(proposta, lugar)) acessoExterno += 1;
    if (!lugar.vender) naoVender += 1;
  }
  return {
    fileiras: new Set(proposta.lugares.map((lugar) => lugar.fileira.trim()).filter((fileira) => fileira !== "")).size,
    blocos: new Set(proposta.lugares.map((lugar) => lugar.blocoId).filter((bloco) => bloco !== null)).size,
    lugares: proposta.lugares.length,
    porCategoria,
    acessoExterno,
    naoVender,
  };
}
