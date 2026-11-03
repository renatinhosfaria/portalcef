import type { BlocoMontado, LetraLida, NumeroLido } from "./montar-mapa";
import { montarMapa, passoTipico } from "./montar-mapa";

// Geometria sintética calibrada pela planta do ballet: passo de 13 pt e corredores de 45 pt (~3,5 passos).
const PASSO = 13;
const CORREDOR = 45;

interface Cena {
  numeros: NumeroLido[];
  letras: LetraLida[];
}

interface OpcoesTrecho {
  passo?: number;
  sentido?: 1 | -1;
  angulo?: number;
}

interface OpcoesFileira extends OpcoesTrecho {
  corredor?: number;
}

let proximoId = 0;

function intervalo(inicio: number, fim: number, salto = 1): number[] {
  const lista: number[] = [];
  for (let n = inicio; n <= fim; n += salto) lista.push(n);
  return lista;
}

function direcao(angulo: number): { x: number; y: number } {
  const radianos = (angulo * Math.PI) / 180;
  return { x: Math.cos(radianos), y: Math.sin(radianos) };
}

/** Números de um trecho em linha reta, sem letra de fileira por perto. */
function trecho(y: number, numeros: number[], x0: number, opcoes: OpcoesTrecho = {}): NumeroLido[] {
  const { passo = PASSO, sentido = 1, angulo = 0 } = opcoes;
  const d = direcao(angulo);
  return numeros.map((numero, i) => ({
    id: `n${proximoId++}`,
    numero,
    x: x0 + sentido * i * passo * d.x,
    y: y + sentido * i * passo * d.y,
    angulo,
    cor: "#000000",
  }));
}

/** Trecho de uma fileira com a letra no meio dos corredores das duas pontas. */
function fileira(letra: string, y: number, numeros: number[], x0: number, opcoes: OpcoesFileira = {}): Cena {
  const { corredor = CORREDOR, sentido = 1, angulo = 0 } = opcoes;
  const d = direcao(angulo);
  const lidos = trecho(y, numeros, x0, opcoes);
  const primeiro = lidos[0];
  const ultimo = lidos[lidos.length - 1];
  const meio = (sentido * corredor) / 2;
  return {
    numeros: lidos,
    letras: [
      { letra, x: primeiro.x - meio * d.x, y: primeiro.y - meio * d.y },
      { letra, x: ultimo.x + meio * d.x, y: ultimo.y + meio * d.y },
    ],
  };
}

/** Posição x do primeiro número do trecho seguinte, do outro lado do corredor. */
function xDepoisDoCorredor(cena: Cena, sentido: 1 | -1 = 1): number {
  return cena.numeros[cena.numeros.length - 1].x + sentido * CORREDOR;
}

function juntar(...cenas: Cena[]): Cena {
  return {
    numeros: cenas.flatMap((c) => c.numeros),
    letras: cenas.flatMap((c) => c.letras),
  };
}

/** Gira números e letras em torno do centro; o ângulo do texto dos números gira junto. */
function girar(cena: Cena, graus: number, centro: { x: number; y: number }): Cena {
  const d = direcao(graus);
  const girarPonto = (p: { x: number; y: number }) => {
    const dx = p.x - centro.x;
    const dy = p.y - centro.y;
    return { x: centro.x + dx * d.x - dy * d.y, y: centro.y + dx * d.y + dy * d.x };
  };
  return {
    numeros: cena.numeros.map((n) => ({ ...n, ...girarPonto(n), angulo: n.angulo + graus })),
    letras: cena.letras.map((l) => ({ ...l, ...girarPonto(l) })),
  };
}

function deslocar(numeros: NumeroLido[], valores: number[], dx: number, dy: number): NumeroLido[] {
  return numeros.map((n) => (valores.includes(n.numero) ? { ...n, x: n.x + dx, y: n.y + dy } : n));
}

function idsDe(numeros: NumeroLido[], valores: number[]): string[] {
  return valores.map((valor) => {
    const achado = numeros.find((n) => n.numero === valor);
    if (!achado) throw new Error(`número ${valor} ausente da cena`);
    return achado.id;
  });
}

function resumo(blocos: BlocoMontado[]) {
  return blocos.map((b) => ({
    id: b.id,
    fileira: b.fileira,
    numeros: b.numeros.map((n) => n.numero),
    foraDaLinha: b.foraDaLinha.map((id) => b.numeros.find((n) => n.id === id)?.numero),
  }));
}

describe("passoTipico", () => {
  it("é a mediana da distância de cada número ao vizinho mais próximo", () => {
    // Vizinhos mais próximos: 10, 10, 15, 15, 15 → mediana 15 (a média seria 13 e o mínimo, 10).
    const numeros = [0, 10, 25, 40, 55].map((x, i) => ({
      id: `p${i}`,
      numero: i + 1,
      x,
      y: 0,
      angulo: 0,
      cor: "#000000",
    }));
    expect(passoTipico(numeros)).toBeCloseTo(15);
  });
});

describe("montarMapa", () => {
  it("monta três blocos separados por corredores e dá a letra de cada ponta", () => {
    // Numeração crescendo para a esquerda, como no teatro: direita 1–12 · centro 13–27 · esquerda 28–39.
    const direita = fileira("R", 100, intervalo(1, 12), 700, { sentido: -1 });
    const centro = fileira("R", 100, intervalo(13, 27), xDepoisDoCorredor(direita, -1), { sentido: -1 });
    const esquerda = fileira("R", 100, intervalo(28, 39), xDepoisDoCorredor(centro, -1), { sentido: -1 });
    const cena = juntar(direita, centro, esquerda);

    const { passo, blocos, pontos } = montarMapa(cena.numeros, cena.letras);

    expect(passo).toBeCloseTo(PASSO);
    expect(resumo(blocos)).toEqual([
      { id: "bloco-0", fileira: "R", numeros: intervalo(1, 12), foraDaLinha: [] },
      { id: "bloco-1", fileira: "R", numeros: intervalo(13, 27), foraDaLinha: [] },
      { id: "bloco-2", fileira: "R", numeros: intervalo(28, 39), foraDaLinha: [] },
    ]);
    expect(pontos).toEqual([]);
  });

  it("não atravessa o corredor mesmo com a numeração contínua", () => {
    // Sem letras: só o limite ao longo da fileira impede a junção de 12 com 13, a 45 pt.
    const antes = trecho(100, intervalo(1, 12), 100);
    const depois = trecho(100, intervalo(13, 24), antes[antes.length - 1].x + CORREDOR);

    const { blocos } = montarMapa([...antes, ...depois], []);

    expect(resumo(blocos).map((b) => b.numeros)).toEqual([intervalo(1, 12), intervalo(13, 24)]);
  });

  it("segue blocos inclinados", () => {
    // 25° como os blocos laterais da planta; −40° com numeração para a esquerda deixaria a
    // perpendicular medida no eixo x acima de 0,45 passo, então só passa medindo pelo ângulo do texto.
    const lateralDireito = girar(fileira("I", 300, intervalo(1, 12), 600), 25, { x: 670, y: 300 });
    const lateralEsquerdo = girar(fileira("H", 300, intervalo(28, 39), 300, { sentido: -1 }), -40, {
      x: 230,
      y: 300,
    });
    const cena = juntar(lateralDireito, lateralEsquerdo);

    const { blocos, pontos } = montarMapa(cena.numeros, cena.letras);

    expect(resumo(blocos)).toEqual([
      { id: "bloco-0", fileira: "H", numeros: intervalo(28, 39), foraDaLinha: [] },
      { id: "bloco-1", fileira: "I", numeros: intervalo(1, 12), foraDaLinha: [] },
    ]);
    expect(pontos).toEqual([]);
  });

  it("aceita numeração de dois em dois sem pontos", () => {
    // Pares à esquerda do corredor central, crescendo para a esquerda; ímpares à direita.
    const pares = fileira("F", 100, intervalo(2, 24, 2), 300, { sentido: -1 });
    const impares = fileira("F", 100, intervalo(1, 23, 2), 300 + CORREDOR);
    const cena = juntar(pares, impares);

    const { blocos, pontos } = montarMapa(cena.numeros, cena.letras);

    expect(resumo(blocos)).toEqual([
      { id: "bloco-0", fileira: "F", numeros: intervalo(1, 23, 2), foraDaLinha: [] },
      { id: "bloco-1", fileira: "F", numeros: intervalo(2, 24, 2), foraDaLinha: [] },
    ]);
    expect(pontos).toEqual([]);
  });

  it("liga números fora da linha pela continuidade e gera um ponto por fileira", () => {
    // Como os cadeirantes da fileira R: o número fica abaixo do ícone, ~1 passo ao longo e ~0,77 na perpendicular.
    const r = fileira("R", 100, intervalo(13, 27), 500, { sentido: -1 });
    const numerosR = deslocar(r.numeros, [13, 14, 26, 27], 0, 10);
    const q = fileira("Q", 300, intervalo(13, 27), 500, { sentido: -1 });
    const numerosQ = deslocar(q.numeros, [13], 0, 10);

    const { blocos, pontos } = montarMapa([...numerosQ, ...numerosR], [...q.letras, ...r.letras]);

    expect(resumo(blocos)).toEqual([
      { id: "bloco-0", fileira: "Q", numeros: intervalo(13, 27), foraDaLinha: [13] },
      { id: "bloco-1", fileira: "R", numeros: intervalo(13, 27), foraDaLinha: [13, 14, 26, 27] },
    ]);
    expect(pontos).toEqual([
      {
        tipo: "FORA_DA_LINHA",
        fileira: "Q",
        numeroIds: idsDe(numerosQ, [13]),
        mensagem:
          "Fileira Q: o número 13 está fora da linha da fileira e foi ligado a ela pela numeração. Confira na planta.",
      },
      {
        tipo: "FORA_DA_LINHA",
        fileira: "R",
        numeroIds: idsDe(numerosR, [13, 14, 26, 27]),
        mensagem:
          "Fileira R: os números 13, 14, 26 e 27 estão fora da linha da fileira e foram ligados a ela pela numeração. Confira na planta.",
      },
    ]);
  });

  it.each([
    { caso: "lacuna de 2,2 passos ao longo", aoLongo: 1.2, perpendicular: 0, blocos: [[1, 12]], fora: [] },
    { caso: "lacuna de 2,4 passos ao longo", aoLongo: 1.4, perpendicular: 0, blocos: [[1, 3], [4, 12]], fora: [] },
    { caso: "0,4 passo na perpendicular", aoLongo: 0, perpendicular: 0.4, blocos: [[1, 12]], fora: [] },
    { caso: "0,6 passo na perpendicular", aoLongo: 0, perpendicular: 0.6, blocos: [[1, 12]], fora: [1, 2, 3] },
    { caso: "1,1 passo na perpendicular", aoLongo: 0, perpendicular: 1.1, blocos: [[1, 3], [4, 12]], fora: [] },
  ])("respeita os limites do encadeamento e da junção: $caso", ({ aoLongo, perpendicular, blocos, fora }) => {
    // Os números 1 a 3 se afastam do resto do bloco: para fora ao longo da fileira e/ou na perpendicular.
    const a = fileira("A", 100, intervalo(1, 12), 100);
    const numeros = deslocar(a.numeros, [1, 2, 3], -aoLongo * PASSO, perpendicular * PASSO);

    const resultado = montarMapa(numeros, a.letras);

    expect(resumo(resultado.blocos).map((b) => [b.numeros[0], b.numeros[b.numeros.length - 1]])).toEqual(blocos);
    expect(resultado.blocos.flatMap((b) => b.foraDaLinha)).toEqual(idsDe(numeros, fora));
    expect(resultado.blocos.every((b) => b.fileira === "A")).toBe(true);
  });

  it("trecho sem letra herda pela numeração (LETRA_HERDADA)", () => {
    // Camarote em três linhas a 3,6 passos; só a do meio tem a letra X nos corredores.
    // A numeração serpenteia: 5 fica atrás do 6 e o 11 fica à frente do 10.
    const meio = fileira("X", 200, intervalo(6, 10), 100);
    const atras = trecho(200 - 3.6 * PASSO, intervalo(1, 5), 100 + 4 * PASSO, { sentido: -1 });
    const frente = trecho(200 + 3.6 * PASSO, intervalo(11, 15), 100 + 4 * PASSO, { sentido: -1 });

    const { blocos, pontos } = montarMapa([...atras, ...meio.numeros, ...frente], meio.letras);

    expect(resumo(blocos)).toEqual([
      { id: "bloco-0", fileira: "X", numeros: intervalo(1, 5), foraDaLinha: [] },
      { id: "bloco-1", fileira: "X", numeros: intervalo(6, 10), foraDaLinha: [] },
      { id: "bloco-2", fileira: "X", numeros: intervalo(11, 15), foraDaLinha: [] },
    ]);
    expect(pontos).toEqual([
      {
        tipo: "LETRA_HERDADA",
        fileira: "X",
        numeroIds: idsDe(atras, intervalo(1, 5)),
        mensagem:
          "Os lugares 1 a 5 não têm letra de fileira por perto e receberam a letra X porque continuam a numeração. Confira.",
      },
      {
        tipo: "LETRA_HERDADA",
        fileira: "X",
        numeroIds: idsDe(frente, intervalo(11, 15)),
        mensagem:
          "Os lugares 11 a 15 não têm letra de fileira por perto e receberam a letra X porque continuam a numeração. Confira.",
      },
    ]);
  });

  it("trecho sem letra e sem continuidade fica com fileira null (SEM_FILEIRA)", () => {
    const a = fileira("A", 100, intervalo(1, 12), 100);
    // 3 a 9 não continua a numeração de nenhum trecho com letra.
    const solto = trecho(400, intervalo(3, 9), 100);
    // 13 a 20 continua o 12 da fileira A, mas a 5 passos, além do alcance da herança (4,6).
    const ultimoA = a.numeros[a.numeros.length - 1];
    const longe = trecho(ultimoA.y + 5 * PASSO, intervalo(13, 20), ultimoA.x);

    const { blocos, pontos } = montarMapa([...a.numeros, ...solto, ...longe], a.letras);

    expect(resumo(blocos)).toEqual([
      { id: "bloco-0", fileira: "A", numeros: intervalo(1, 12), foraDaLinha: [] },
      { id: "bloco-1", fileira: null, numeros: intervalo(3, 9), foraDaLinha: [] },
      { id: "bloco-2", fileira: null, numeros: intervalo(13, 20), foraDaLinha: [] },
    ]);
    expect(pontos).toEqual([
      {
        tipo: "SEM_FILEIRA",
        fileira: null,
        numeroIds: idsDe(solto, intervalo(3, 9)),
        mensagem: "Os lugares numerados de 3 a 9 não ficam ao lado de nenhuma letra de fileira. Informe a fileira.",
      },
      {
        tipo: "SEM_FILEIRA",
        fileira: null,
        numeroIds: idsDe(longe, intervalo(13, 20)),
        mensagem: "Os lugares numerados de 13 a 20 não ficam ao lado de nenhuma letra de fileira. Informe a fileira.",
      },
    ]);
  });

  it("usa o singular quando o trecho tem um lugar só", () => {
    // X: 2 a 6 com letra; o 1 fica sozinho 3,6 passos atrás do 2. O 50 fica sozinho, longe de tudo.
    const x = fileira("X", 200, intervalo(2, 6), 100);
    const sozinhoAtras = trecho(200 - 3.6 * PASSO, [1], 100);
    const solto = trecho(500, [50], 400);

    const { pontos } = montarMapa([...sozinhoAtras, ...x.numeros, ...solto], x.letras);

    expect(pontos).toEqual([
      {
        tipo: "LETRA_HERDADA",
        fileira: "X",
        numeroIds: idsDe(sozinhoAtras, [1]),
        mensagem:
          "O lugar 1 não tem letra de fileira por perto e recebeu a letra X porque continua a numeração. Confira.",
      },
      {
        tipo: "SEM_FILEIRA",
        fileira: null,
        numeroIds: idsDe(solto, [50]),
        mensagem: "O lugar numerado 50 não fica ao lado de nenhuma letra de fileira. Informe a fileira.",
      },
    ]);
  });

  it("aponta número fora da linha também em trecho sem fileira", () => {
    const semLetra = deslocar(trecho(100, intervalo(13, 27), 500, { sentido: -1 }), [13], 0, 10);

    const { blocos, pontos } = montarMapa(semLetra, []);

    expect(resumo(blocos)).toEqual([{ id: "bloco-0", fileira: null, numeros: intervalo(13, 27), foraDaLinha: [13] }]);
    expect(pontos).toEqual([
      {
        tipo: "FORA_DA_LINHA",
        fileira: null,
        numeroIds: idsDe(semLetra, [13]),
        mensagem:
          "O número 13 está fora da linha da fileira e foi ligado a ela pela numeração. Confira na planta.",
      },
      {
        tipo: "SEM_FILEIRA",
        fileira: null,
        numeroIds: idsDe(semLetra, intervalo(13, 27)),
        mensagem: "Os lugares numerados de 13 a 27 não ficam ao lado de nenhuma letra de fileira. Informe a fileira.",
      },
    ]);
  });

  it("conta quantos trechos repetem o número quando são mais de dois", () => {
    const d1 = fileira("D", 100, intervalo(1, 12), 100);
    const d2 = fileira("D", 100, [12], xDepoisDoCorredor(d1));
    const d3 = fileira("D", 100, intervalo(12, 20), xDepoisDoCorredor(d2));
    const cena = juntar(d1, d2, d3);

    const { pontos } = montarMapa(cena.numeros, cena.letras);

    expect(pontos).toEqual([
      {
        tipo: "NUMERO_REPETIDO",
        fileira: "D",
        numeroIds: [...idsDe(d1.numeros, [12]), ...idsDe(d2.numeros, [12]), ...idsDe(d3.numeros, [12])],
        mensagem: "Fileira D: o número 12 aparece em 3 trechos.",
      },
    ]);
  });

  it("aponta salto de numeração e número repetido", () => {
    // C: falta o 13 e o 14 entre os trechos.
    const c1 = fileira("C", 100, intervalo(1, 12), 100);
    const c2 = fileira("C", 100, intervalo(15, 27), xDepoisDoCorredor(c1));
    // D: o 12 aparece no fim de um trecho e no começo do outro.
    const d1 = fileira("D", 300, intervalo(1, 12), 100);
    const d2 = fileira("D", 300, intervalo(12, 23), xDepoisDoCorredor(d1));
    // E: o 11 aparece num trecho de dois em dois e num trecho de um em um, validados em grupos separados.
    const e1 = fileira("E", 500, intervalo(1, 11, 2), 100);
    const e2 = fileira("E", 500, intervalo(11, 13), xDepoisDoCorredor(e1));
    const cena = juntar(c1, c2, d1, d2, e1, e2);

    const { pontos } = montarMapa(cena.numeros, cena.letras);

    expect(pontos).toHaveLength(3);
    expect(pontos).toEqual(
      expect.arrayContaining([
        {
          tipo: "SALTO_NUMERACAO",
          fileira: "C",
          numeroIds: [...idsDe(c1.numeros, [12]), ...idsDe(c2.numeros, [15])],
          mensagem: "Fileira C: a numeração pula de 12 para 15.",
        },
        {
          tipo: "NUMERO_REPETIDO",
          fileira: "D",
          numeroIds: [...idsDe(d1.numeros, [12]), ...idsDe(d2.numeros, [12])],
          mensagem: "Fileira D: o número 12 aparece em dois trechos.",
        },
        {
          tipo: "NUMERO_REPETIDO",
          fileira: "E",
          numeroIds: [...idsDe(e1.numeros, [11]), ...idsDe(e2.numeros, [11])],
          mensagem: "Fileira E: o número 11 aparece em dois trechos.",
        },
      ]),
    );
  });

  it("não mistura fileiras vizinhas a 1,7 passo", () => {
    // A e B com a mesma numeração; B desencontrada meio passo, como cadeiras intercaladas.
    // C continua a numeração de B a partir do 12, uma fileira atrás (perpendicular de 1,7 passo).
    const a = fileira("A", 100, intervalo(1, 12), 100);
    const b = fileira("B", 100 + 1.7 * PASSO, intervalo(1, 12), 100 + PASSO / 2);
    const ultimoB = b.numeros[b.numeros.length - 1];
    const c = fileira("C", 100 + 3.4 * PASSO, intervalo(13, 24), ultimoB.x, { sentido: -1 });
    const cena = juntar(a, b, c);

    const { blocos, pontos } = montarMapa(cena.numeros, cena.letras);

    expect(resumo(blocos)).toEqual([
      { id: "bloco-0", fileira: "A", numeros: intervalo(1, 12), foraDaLinha: [] },
      { id: "bloco-1", fileira: "B", numeros: intervalo(1, 12), foraDaLinha: [] },
      { id: "bloco-2", fileira: "C", numeros: intervalo(13, 24), foraDaLinha: [] },
    ]);
    expect(pontos).toEqual([]);
  });

  it("monta 2000 números em menos de 2 s", () => {
    const letraDe = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `A${String.fromCharCode(65 + i - 26)}`);
    const cena = juntar(
      ...Array.from({ length: 40 }, (_, i) => fileira(letraDe(i), 100 + i * 1.75 * PASSO, intervalo(1, 50), 100)),
    );
    expect(cena.numeros).toHaveLength(2000);

    const inicio = performance.now();
    const { blocos, pontos } = montarMapa(cena.numeros, cena.letras);
    const duracao = performance.now() - inicio;

    expect(duracao).toBeLessThan(2000);
    expect(blocos).toHaveLength(40);
    expect(blocos.every((b) => b.numeros.length === 50)).toBe(true);
    expect(pontos).toEqual([]);
  });
});
