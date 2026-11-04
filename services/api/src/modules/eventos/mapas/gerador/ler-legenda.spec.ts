import type { FraseLida, PlantaLida, TokenLido } from "./ler-planta-pdf";
import { dentroDaCaixa, interpretarTextoLegenda, lerElementos, lerLegenda } from "./ler-legenda";

function token(texto: string, x: number, y: number, cor: string, tamanho = 8): TokenLido {
  return { texto, x, y, angulo: 0, tamanho, cor };
}

function frase(texto: string, esquerda: number, y: number, cor = "#000000", tamanho = 8.3): FraseLida {
  const largura = texto.length * tamanho * 0.5;
  return { texto, x: esquerda + largura / 2, y, esquerda, tamanho, cor };
}

function planta(tokens: TokenLido[], frases: FraseLida[]): PlantaLida {
  return { pagina: { numero: 1, largura: 842, altura: 595 }, tokens, frases };
}

// Números de assento em preto, mais algumas letras de fileira em vermelho.
const numeros = [token("1", 100, 100, "#000000"), token("2", 110, 100, "#000000"), token("3", 120, 100, "#000000")];
const coresDosNumeros = new Set(["#000000", "#ff0000"]);

describe("interpretarTextoLegenda", () => {
  it.each([
    ["EXCLUSIVO CADEIRANTES", "CADEIRANTE", false],
    ["OPCIONAL PARA CADEIRANTES", "OPCIONAL_CADEIRANTE", false],
    ["OPCIONAL PARA CADEIRANTES entrada atraves de acesso externo", "OPCIONAL_CADEIRANTE", true],
    ["ESPECIAIS OBESOS", "OBESO", false],
    ["CAMAROTE VIP", null, false],
  ])("interpreta '%s'", (texto, categoria, acessoExterno) => {
    expect(interpretarTextoLegenda(texto)).toEqual({ categoria, acessoExterno });
  });
});

describe("lerLegenda", () => {
  const amostras = [
    token("X", 707, 46, "#006edd", 16.7),
    token("X", 707, 62, "#0000ff", 16.7),
    token("X", 707, 78, "#00ffff", 16.7),
    token("X", 707, 94, "#ff00ff", 16.7),
  ];
  const frasesLegenda = [
    frase("EXCLUSIVO CADEIRANTES", 723, 41),
    frase("OPCIONAL PARA CADEIRANTES", 724, 62),
    frase("OPCIONAL PARA CADEIRANTES", 724, 78),
    frase("entrada atraves de acesso externo", 724, 86),
    frase("ESPECIAIS OBESOS", 723, 103),
  ];
  const cores = new Set(["#000000", "#ff0000", "#006edd", "#0000ff", "#00ffff", "#ff00ff"]);

  it("associa amostra colorida à frase da direita, inclusive a linha de continuação", () => {
    const { entradas, area } = lerLegenda(planta([...numeros, ...amostras], frasesLegenda), cores);
    expect(entradas).toEqual([
      { cor: "#006edd", texto: "EXCLUSIVO CADEIRANTES", categoria: "CADEIRANTE", acessoExterno: false },
      { cor: "#0000ff", texto: "OPCIONAL PARA CADEIRANTES", categoria: "OPCIONAL_CADEIRANTE", acessoExterno: false },
      {
        cor: "#00ffff",
        texto: "OPCIONAL PARA CADEIRANTES entrada atraves de acesso externo",
        categoria: "OPCIONAL_CADEIRANTE",
        acessoExterno: true,
      },
      { cor: "#ff00ff", texto: "ESPECIAIS OBESOS", categoria: "OBESO", acessoExterno: false },
    ]);
    expect(area).not.toBeNull();
    for (const t of amostras) expect(dentroDaCaixa(t, area)).toBe(true);
    for (const f of frasesLegenda) expect(dentroDaCaixa(f, area)).toBe(true);
    expect(dentroDaCaixa({ x: 100, y: 100 }, area)).toBe(false);
  });

  it("a linha de continuação equidistante vai para a amostra acima, qualquer que seja a ordem dos tokens", () => {
    const invertidos = [...amostras].reverse();
    const { entradas } = lerLegenda(planta([...numeros, ...invertidos], frasesLegenda), cores);
    expect(entradas.find((e) => e.cor === "#00ffff")).toEqual({
      cor: "#00ffff",
      texto: "OPCIONAL PARA CADEIRANTES entrada atraves de acesso externo",
      categoria: "OPCIONAL_CADEIRANTE",
      acessoExterno: true,
    });
    expect(entradas.find((e) => e.cor === "#ff00ff")).toEqual({
      cor: "#ff00ff",
      texto: "ESPECIAIS OBESOS",
      categoria: "OBESO",
      acessoExterno: false,
    });
  });

  it("ignora amostra cuja cor não aparece em nenhum número e letras de fileira sem frase ao lado", () => {
    const letraFileira = token("A", 90, 100, "#ff0000");
    const corDesconhecida = token("X", 707, 300, "#123456", 16.7);
    const resultado = lerLegenda(
      planta([...numeros, letraFileira, corDesconhecida, amostras[0]], [frasesLegenda[0]]),
      cores,
    );
    expect(resultado.entradas.map((e) => e.cor)).toEqual(["#006edd"]);
  });

  it("sem legenda devolve entradas vazias e área nula", () => {
    const resultado = lerLegenda(planta([...numeros, token("A", 90, 100, "#ff0000")], []), coresDosNumeros);
    expect(resultado).toEqual({ entradas: [], area: null });
  });
});

describe("lerElementos", () => {
  it("lê PALCO, ENTRADA e SAÍDA fora da legenda e ignora 'entrada' dentro dela", () => {
    const area = { x0: 690, y0: 30, x1: 840, y1: 120 };
    const frases = [
      frase("PALCO", 300, 20, "#000000", 20),
      frase("ENTRADA", 50, 300),
      frase("SAÍDA", 400, 500),
      frase("SAIDA", 600, 500),
      frase("entrada atraves de acesso externo", 724, 86),
      frase("CAMAROTE", 200, 200),
    ];
    const elementos = lerElementos(planta([], frases), area);
    expect(elementos.map((e) => [e.tipo, e.texto])).toEqual([
      ["PALCO", "PALCO"],
      ["ENTRADA", "ENTRADA"],
      ["SAIDA", "SAÍDA"],
      ["SAIDA", "SAIDA"],
    ]);
    expect(elementos[0].x).toBe(frases[0].x);
    expect(elementos[0].y).toBe(frases[0].y);
  });

  it("sem área de legenda considera todas as frases", () => {
    expect(lerElementos(planta([], [frase("PALCO", 10, 10)]), null)).toHaveLength(1);
  });
});
