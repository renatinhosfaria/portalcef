import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  aplicarOperacoes,
  categoriaEfetiva,
  resumoProposta,
  type LugarProposto,
  type OperacaoProposta,
  type PontoConferir,
  type PropostaMapa,
} from "@essencia/shared/eventos/mapa-proposta";
import { criarPdfSintetico, type TextoSintetico } from "./__fixtures__/pdf-sintetico";
import { GeradorMapaPdf } from "./gerador-mapa-pdf";
import { gerarPropostaDePdf } from "./gerar-proposta";
import { lerPlantaPdf } from "./ler-planta-pdf";

const FIXTURE = join(__dirname, "__fixtures__/planta-ballet.pdf");

function contarPorFileira(p: PropostaMapa): Record<string, number> {
  const contagem: Record<string, number> = {};
  for (const l of p.lugares) contagem[l.fileira] = (contagem[l.fileira] ?? 0) + 1;
  return contagem;
}

/** Tamanhos dos blocos de cada fileira, ordenados pelo menor número de cada bloco. */
function blocosPorFileira(p: PropostaMapa): Record<string, number[]> {
  const blocos = new Map<string, Map<string | null, number[]>>();
  for (const l of p.lugares) {
    const daFileira = blocos.get(l.fileira) ?? new Map<string | null, number[]>();
    daFileira.set(l.blocoId, [...(daFileira.get(l.blocoId) ?? []), Number(l.numero)]);
    blocos.set(l.fileira, daFileira);
  }
  const resultado: Record<string, number[]> = {};
  for (const [fileira, daFileira] of blocos) {
    resultado[fileira] = [...daFileira.values()]
      .sort((a, b) => Math.min(...a) - Math.min(...b))
      .map((numeros) => numeros.length);
  }
  return resultado;
}

/** Confirma cada cor da legenda com a categoria e o acesso externo sugeridos pelo gerador. */
function confirmarLegendaSugerida(p: PropostaMapa): PropostaMapa {
  const operacoes: OperacaoProposta[] = p.legenda.flatMap((e) =>
    e.categoria === null
      ? []
      : [{ tipo: "CONFIRMAR_LEGENDA" as const, cor: e.cor, categoria: e.categoria, acessoExterno: e.acessoExterno }],
  );
  return aplicarOperacoes(p, operacoes);
}

function lugar(p: PropostaMapa, fileira: string, numero: string): LugarProposto {
  const achado = p.lugares.find((l) => l.fileira === fileira && l.numero === numero);
  if (!achado) throw new Error(`Lugar ${fileira}-${numero} não existe na proposta`);
  return achado;
}

/** "fileira-numero" dos lugares do ponto, em ordem numérica. */
function numerosDoPonto(p: PropostaMapa, ponto: PontoConferir): string[] {
  return ponto.lugarIds
    .map((id) => p.lugares.find((l) => l.id === id))
    .filter((l): l is LugarProposto => l !== undefined)
    .sort((a, b) => Number(a.numero) - Number(b.numero))
    .map((l) => `${l.fileira}-${l.numero}`);
}

/** Lugares do bloco do lugar indicado, em ordem numérica. */
function blocoDe(p: PropostaMapa, fileira: string, numero: string): LugarProposto[] {
  const { blocoId } = lugar(p, fileira, numero);
  return p.lugares
    .filter((l) => l.blocoId === blocoId)
    .sort((a, b) => Number(a.numero) - Number(b.numero));
}

/** Números de `inicio` a `fim`, como texto, para comparar com `LugarProposto.numero`. */
function range(inicio: number, fim: number): string[] {
  return Array.from({ length: fim - inicio + 1 }, (_, i) => String(inicio + i));
}

describe("gerarPropostaDePdf com a planta do ballet", () => {
  it("gera o mapa do ballet conforme a tabela da spec", async () => {
    const inicio = Date.now();
    const p = await gerarPropostaDePdf(readFileSync(FIXTURE));
    expect(Date.now() - inicio).toBeLessThan(10_000);
    expect(p.lugares).toHaveLength(786);
    expect(contarPorFileira(p)).toEqual({ X: 34, A: 35, B: 37, C: 39, D: 39, E: 41, F: 41, G: 43, H: 43, I: 39, J: 45, K: 45, L: 45, M: 45, N: 45, O: 45, P: 43, Q: 43, R: 39 });
    expect(blocosPorFileira(p)).toMatchObject({ X: [5, 5, 14, 5, 5], A: [11, 13, 11], B: [11, 15, 11], C: [12, 15, 12], E: [13, 15, 13], G: [14, 15, 14], I: [12, 15, 12], J: [15, 15, 15], P: [14, 15, 14], R: [12, 15, 12] }); // tamanhos ordenados pelo primeiro número
    const comLegendaSugerida = confirmarLegendaSugerida(p); // CONFIRMAR_LEGENDA com a sugestão de cada cor
    expect(resumoProposta(comLegendaSugerida).porCategoria).toMatchObject({ COMUM: 750, CADEIRANTE: 4, OPCIONAL_CADEIRANTE: 24, OBESO: 8 });
    expect(resumoProposta(comLegendaSugerida).acessoExterno).toBe(12);
    expect(p.pontos).toHaveLength(1);
    expect(p.pontos[0]).toMatchObject({ tipo: "FORA_DA_LINHA" });
    expect(numerosDoPonto(p, p.pontos[0])).toEqual(["R-13", "R-14", "R-26", "R-27"]);
    expect(blocoDe(p, "I", "39").map((l) => l.numero)).toEqual(range(28, 39)); // bloco esquerdo inclinado da I
    expect(categoriaEfetiva(comLegendaSugerida, lugar(p, "I", "39"))).toBe("OBESO");
    expect(p.rotulos).toHaveLength(38);
    expect(p.elementos.map((e) => e.tipo).sort()).toEqual(["ENTRADA", "PALCO", "SAIDA", "SAIDA"]);
    expect(p.pagina).toEqual({ numero: 1, largura: 8420, altura: 5950 });
  }, 20_000);

  it("sugere a legenda do ballet", async () => {
    const p = await gerarPropostaDePdf(readFileSync(FIXTURE));
    // No empate de quantidade (12 e 12), vale a ordem em que a cor aparece nos lugares.
    expect(p.legenda).toEqual([
      { cor: "#000000", texto: null, quantidade: 750, categoria: "COMUM", acessoExterno: false, confirmada: false },
      {
        cor: "#0000ff",
        texto: "OPCIONAL PARA CADEIRANTES",
        quantidade: 12,
        categoria: "OPCIONAL_CADEIRANTE",
        acessoExterno: false,
        confirmada: false,
      },
      {
        cor: "#00ffff",
        texto: "OPCIONAL PARA CADEIRANTES entrada atraves de acesso externo",
        quantidade: 12,
        categoria: "OPCIONAL_CADEIRANTE",
        acessoExterno: true,
        confirmada: false,
      },
      {
        cor: "#ff00ff",
        texto: "ESPECIAIS OBESOS",
        quantidade: 8,
        categoria: "OBESO",
        acessoExterno: false,
        confirmada: false,
      },
      {
        cor: "#006edd",
        texto: "EXCLUSIVO CADEIRANTES",
        quantidade: 4,
        categoria: "CADEIRANTE",
        acessoExterno: false,
        confirmada: false,
      },
    ]);
  }, 20_000);
});

const PASSO = 13;
const VERMELHO = "#ff0000";

/** Origem de texto a `d` pontos de (x0, y0), na direção de `angulo` graus (anti-horário, y para baixo). */
function aoLongo(x0: number, y0: number, d: number, angulo = 0): { x: number; y: number } {
  const radianos = (angulo * Math.PI) / 180;
  return { x: x0 + d * Math.cos(radianos), y: y0 - d * Math.sin(radianos) };
}

/** Letra de fileira em vermelho e, 20 pt adiante, os números com passo de 13 pt. */
function fileira(
  letra: string | null,
  y: number,
  numeros: string[],
  opcoes: { angulo?: number; cores?: Record<string, string> } = {},
): TextoSintetico[] {
  const { angulo = 0, cores = {} } = opcoes;
  const textos: TextoSintetico[] = numeros.map((numero, i) => ({
    texto: numero,
    ...aoLongo(60, y, 20 + i * PASSO, angulo),
    angulo,
    cor: cores[numero] ?? "#000000",
  }));
  if (letra !== null) textos.unshift({ texto: letra, ...aoLongo(60, y, 0, angulo), angulo, cor: VERMELHO });
  return textos;
}

const umaPagina = (textos: TextoSintetico[]) => criarPdfSintetico([{ largura: 400, altura: 300, textos }]);

describe("gerarPropostaDePdf", () => {
  it("monta cada lugar na unidade do mapa, com os valores iniciais da conferência", async () => {
    const textos = [
      ...fileira("A", 150, ["1", "2", "3", "4", "5"], { angulo: 12.34, cores: { "3": "#ff00ff" } }),
      { texto: "PALCO", x: 180, y: 40, tamanho: 12 },
    ];
    const pdf = umaPagina(textos);
    const planta = await lerPlantaPdf(pdf);
    const token = (texto: string) => planta.tokens.find((t) => t.texto === texto)!;
    const palco = planta.frases.find((f) => f.texto === "PALCO")!;

    const p = await gerarPropostaDePdf(pdf);

    expect(p).toEqual({
      versao: 1,
      revisao: 0,
      pagina: { numero: 1, largura: 4000, altura: 3000 },
      lugares: ["1", "2", "3", "4", "5"].map((numero, i) => ({
        id: `lugar-${i}`,
        fileira: "A",
        numero,
        x: Math.round(token(numero).x * 10),
        y: Math.round(token(numero).y * 10),
        largura: 104, // 0,8 × passo de 13 pt
        altura: 94, // 0,72 × passo de 13 pt
        rotacao: -12.3,
        blocoId: "bloco-0",
        cor: numero === "3" ? "#ff00ff" : "#000000",
        categoriaManual: null,
        acessoExternoManual: null,
        vender: true,
        origem: "GERADOR",
      })),
      rotulos: [{ fileira: "A", x: Math.round(token("A").x * 10), y: Math.round(token("A").y * 10) }],
      elementos: [{ tipo: "PALCO", texto: "PALCO", x: Math.round(palco.x * 10), y: Math.round(palco.y * 10) }],
      legenda: [
        { cor: "#000000", texto: null, quantidade: 4, categoria: "COMUM", acessoExterno: false, confirmada: false },
        { cor: "#ff00ff", texto: null, quantidade: 1, categoria: null, acessoExterno: false, confirmada: false },
      ],
      pontos: [],
    });
  });

  it("deixa a fileira vazia nos lugares sem letra e liga cada ponto aos seus lugares", async () => {
    const p = await gerarPropostaDePdf(
      umaPagina([...fileira(null, 100, ["1", "2", "3", "4"]), ...fileira(null, 250, ["11", "12", "13", "14"])]),
    );

    expect(p.lugares.map((l) => [l.fileira, l.numero])).toEqual([
      ["", "1"], ["", "2"], ["", "3"], ["", "4"],
      ["", "11"], ["", "12"], ["", "13"], ["", "14"],
    ]);
    expect(p.pontos).toEqual([
      {
        id: "ponto-0",
        tipo: "SEM_FILEIRA",
        mensagem: expect.stringContaining("de 1 a 4"),
        lugarIds: ["lugar-0", "lugar-1", "lugar-2", "lugar-3"],
        conferido: false,
      },
      {
        id: "ponto-1",
        tipo: "SEM_FILEIRA",
        mensagem: expect.stringContaining("de 11 a 14"),
        lugarIds: ["lugar-4", "lugar-5", "lugar-6", "lugar-7"],
        conferido: false,
      },
    ]);
  });

  // Texto desenhado duas vezes (negrito falso) zeraria o passo típico e desmontaria as fileiras.
  it.each([
    ["só o número 3", (t: TextoSintetico) => t.texto === "3"],
    ["todo o texto", () => true],
  ])("descarta texto desenhado duas vezes no mesmo lugar (%s)", async (_caso, duplicar) => {
    const textos = [...fileira("A", 100, ["1", "2", "3", "4", "5"]), ...fileira("B", 120, ["1", "2", "3", "4", "5"])];
    const repetidos = textos.filter(duplicar).map((t) => ({ ...t, x: t.x + 0.3 }));

    const p = await gerarPropostaDePdf(umaPagina([...textos, ...repetidos]));

    expect(p.lugares.map((l) => `${l.fileira}-${l.numero}`)).toEqual([
      ...["A-1", "A-2", "A-3", "A-4", "A-5"],
      ...["B-1", "B-2", "B-3", "B-4", "B-5"],
    ]);
    expect(p.rotulos.map((r) => r.fileira)).toEqual(["A", "B"]);
    expect(p.pontos).toEqual([]);
  });
});

describe("GeradorMapaPdf", () => {
  it("gera a proposta da página escolhida", async () => {
    const pdf = criarPdfSintetico([
      { largura: 400, altura: 300, textos: fileira("A", 100, ["1", "2", "3"]) },
      { largura: 500, altura: 300, textos: fileira("B", 100, ["7", "8", "9", "10"]) },
    ]);

    const proposta = await new GeradorMapaPdf().gerar(pdf, 2);

    expect(proposta).toEqual(await gerarPropostaDePdf(pdf, 2));
    expect(proposta.pagina).toEqual({ numero: 2, largura: 5000, altura: 3000 });
    expect(proposta.lugares.map((l) => `${l.fileira}-${l.numero}`)).toEqual(["B-7", "B-8", "B-9", "B-10"]);
  });
});
