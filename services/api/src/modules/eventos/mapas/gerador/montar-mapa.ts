import type { TipoPonto } from "@essencia/shared/eventos/mapa-proposta";

export interface NumeroLido {
  id: string;
  numero: number;
  x: number;
  y: number;
  angulo: number;
  cor: string;
}

export interface LetraLida {
  letra: string;
  x: number;
  y: number;
}

/** Trecho contínuo de uma fileira; `numeros` em ordem de numeração. */
export interface BlocoMontado {
  id: string;
  fileira: string | null;
  numeros: NumeroLido[];
  foraDaLinha: string[];
}

export interface PontoMontado {
  tipo: TipoPonto;
  fileira: string | null;
  numeroIds: string[];
  mensagem: string;
}

/** Limites em múltiplos do passo típico, calibrados na planta do ballet. */
export const LIMITES = {
  aoLongo: 2.3,
  perpendicular: 0.45,
  perpendicularJuncao: 1.0,
  letra: 3.2,
  heranca: 4.6,
} as const;

interface Trecho {
  numeros: NumeroLido[];
  passo: number;
  letra: string | null;
  foraDaLinha: Set<NumeroLido>;
}

const distancia = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const primeiro = (t: Trecho) => t.numeros[0];
const ultimo = (t: Trecho) => t.numeros[t.numeros.length - 1];

/**
 * Distância de cada número ao vizinho mais próximo. Varre a lista ordenada pelo eixo de maior extensão
 * e para assim que a diferença nesse eixo passa da melhor distância achada.
 */
function distanciasAoVizinho(numeros: NumeroLido[]): number[] {
  const extensao = (eixo: "x" | "y") =>
    Math.max(...numeros.map((n) => n[eixo])) - Math.min(...numeros.map((n) => n[eixo]));
  const eixo = extensao("x") >= extensao("y") ? "x" : "y";
  const ordenados = [...numeros].sort((a, b) => a[eixo] - b[eixo]);
  return ordenados.map((a, i) => {
    let melhor = Infinity;
    for (let j = i + 1; j < ordenados.length && ordenados[j][eixo] - a[eixo] < melhor; j++) {
      melhor = Math.min(melhor, distancia(a, ordenados[j]));
    }
    for (let j = i - 1; j >= 0 && a[eixo] - ordenados[j][eixo] < melhor; j--) {
      melhor = Math.min(melhor, distancia(a, ordenados[j]));
    }
    return melhor;
  });
}

/** Mediana da distância de cada número ao vizinho mais próximo. */
export function passoTipico(numeros: NumeroLido[]): number {
  if (numeros.length < 2) return 0;
  const vizinhos = distanciasAoVizinho(numeros).sort((a, b) => a - b);
  const meio = Math.floor(vizinhos.length / 2);
  return vizinhos.length % 2 === 1 ? vizinhos[meio] : (vizinhos[meio - 1] + vizinhos[meio]) / 2;
}

/** Distâncias ao longo e na perpendicular da direção do texto da origem, em passos e em valor absoluto. */
function medir(origem: NumeroLido, alvo: NumeroLido, passo: number) {
  const radianos = (origem.angulo * Math.PI) / 180;
  const dx = alvo.x - origem.x;
  const dy = alvo.y - origem.y;
  return {
    aoLongo: Math.abs(dx * Math.cos(radianos) + dy * Math.sin(radianos)) / passo,
    perpendicular: Math.abs(dy * Math.cos(radianos) - dx * Math.sin(radianos)) / passo,
  };
}

function agrupar<T, K>(itens: T[], chave: (item: T) => K): Map<K, T[]> {
  const grupos = new Map<K, T[]>();
  for (const item of itens) {
    const lista = grupos.get(chave(item));
    if (lista) lista.push(item);
    else grupos.set(chave(item), [item]);
  }
  return grupos;
}

/**
 * Liga cada número ao `numero + salto` mais barato dentro dos limites, aceitando em ordem de custo,
 * com no máximo um próximo e um anterior por número. Devolve as cadeias de 2 ou mais números.
 */
function encadear(numeros: NumeroLido[], salto: number, passo: number): NumeroLido[][] {
  const indice = agrupar(numeros, (n) => n.numero);
  const candidatas: Array<{ de: NumeroLido; para: NumeroLido; custo: number }> = [];
  for (const de of numeros) {
    for (const para of indice.get(de.numero + salto) ?? []) {
      const { aoLongo, perpendicular } = medir(de, para, passo);
      if (aoLongo <= LIMITES.aoLongo && perpendicular <= LIMITES.perpendicular) {
        candidatas.push({ de, para, custo: aoLongo + 5 * perpendicular });
      }
    }
  }
  candidatas.sort((a, b) => a.custo - b.custo);

  const proximo = new Map<NumeroLido, NumeroLido>();
  const anterior = new Map<NumeroLido, NumeroLido>();
  for (const { de, para } of candidatas) {
    if (proximo.has(de) || anterior.has(para)) continue;
    proximo.set(de, para);
    anterior.set(para, de);
  }

  const cadeias: NumeroLido[][] = [];
  for (const inicio of numeros) {
    if (anterior.has(inicio) || !proximo.has(inicio)) continue;
    const cadeia = [inicio];
    for (let atual = proximo.get(inicio); atual; atual = proximo.get(atual)) cadeia.push(atual);
    cadeias.push(cadeia);
  }
  return cadeias;
}

/**
 * Etapas 1 e 2: cadeias de um em um e, entre os números que ficaram soltos, cadeias de dois em dois
 * (ímpares de um lado, pares do outro). O que sobra vira trecho de um número só, com passo 1.
 */
function montarTrechos(numeros: NumeroLido[], passo: number): Trecho[] {
  const deUmEmUm = encadear(numeros, 1, passo);
  const encadeados = new Set(deUmEmUm.flat());
  const soltosDaEtapa1 = numeros.filter((n) => !encadeados.has(n));
  const deDoisEmDois = encadear(soltosDaEtapa1, 2, passo);
  for (const n of deDoisEmDois.flat()) encadeados.add(n);
  const soltos = numeros.filter((n) => !encadeados.has(n));
  const trecho = (lista: NumeroLido[], salto: number): Trecho => ({
    numeros: lista,
    passo: salto,
    letra: null,
    foraDaLinha: new Set(),
  });
  return [
    ...deUmEmUm.map((c) => trecho(c, 1)),
    ...deDoisEmDois.map((c) => trecho(c, 2)),
    ...soltos.map((n) => trecho([n], 1)),
  ];
}

function letraMaisProxima(trecho: Trecho, letras: LetraLida[], passo: number): string | null {
  const pontas = [primeiro(trecho), ultimo(trecho)];
  let melhor: { letra: string; distancia: number } | null = null;
  for (const letra of letras) {
    for (const ponta of pontas) {
      const d = distancia(letra, ponta);
      if (d <= LIMITES.letra * passo && (!melhor || d < melhor.distancia)) {
        melhor = { letra: letra.letra, distancia: d };
      }
    }
  }
  return melhor?.letra ?? null;
}

/** Pares em que a ponta final de `antes` continua, no mesmo passo, na ponta inicial de `depois`. */
function continuacoes(trechos: Trecho[]): Array<{ antes: Trecho; depois: Trecho }> {
  const porPrimeiro = agrupar(trechos, (t) => primeiro(t).numero);
  return trechos.flatMap((antes) =>
    (porPrimeiro.get(ultimo(antes).numero + antes.passo) ?? [])
      .filter((depois) => depois.passo === antes.passo)
      .map((depois) => ({ antes, depois })),
  );
}

/** O menor dos dois trechos; no empate de tamanho, o de número inicial maior. */
function menorDosDois(a: Trecho, b: Trecho): Trecho {
  if (a.numeros.length !== b.numeros.length) return a.numeros.length < b.numeros.length ? a : b;
  return primeiro(a).numero > primeiro(b).numero ? a : b;
}

/**
 * Etapa 4: une trechos cuja ponta continua a numeração da ponta de outro, medindo a partir da ponta
 * do trecho maior. Os números do trecho menor de cada junção ficam fora da linha.
 */
function juntarPorContinuidade(trechos: Trecho[], passo: number): Trecho[] {
  const candidatas = continuacoes(trechos)
    .map(({ antes, depois }) => {
      const menor = menorDosDois(antes, depois);
      const [daPontaMaior, ate] =
        menor === depois ? [ultimo(antes), primeiro(depois)] : [primeiro(depois), ultimo(antes)];
      return { antes, depois, menor, ...medir(daPontaMaior, ate, passo) };
    })
    .filter((c) => c.aoLongo <= LIMITES.aoLongo && c.perpendicular <= LIMITES.perpendicularJuncao)
    .sort((a, b) => a.aoLongo + 5 * a.perpendicular - (b.aoLongo + 5 * b.perpendicular));

  // Cada grupo guarda seus trechos na ordem da numeração: a ponta final é sempre o último membro.
  const grupoDe = new Map(trechos.map((t) => [t, { membros: [t], letra: t.letra, fora: [] as NumeroLido[] }]));
  const comProximo = new Set<Trecho>();
  const comAnterior = new Set<Trecho>();
  for (const { antes, depois, menor } of candidatas) {
    const grupoAntes = grupoDe.get(antes);
    const grupoDepois = grupoDe.get(depois);
    if (!grupoAntes || !grupoDepois || grupoAntes === grupoDepois) continue;
    if (comProximo.has(antes) || comAnterior.has(depois)) continue;
    if (grupoAntes.letra !== null && grupoDepois.letra !== null && grupoAntes.letra !== grupoDepois.letra) continue;
    comProximo.add(antes);
    comAnterior.add(depois);
    const unido = {
      membros: [...grupoAntes.membros, ...grupoDepois.membros],
      letra: grupoAntes.letra ?? grupoDepois.letra,
      fora: [...grupoAntes.fora, ...grupoDepois.fora, ...menor.numeros],
    };
    for (const membro of unido.membros) grupoDe.set(membro, unido);
  }

  return [...new Set(grupoDe.values())].map((grupo) => ({
    numeros: grupo.membros.flatMap((m) => m.numeros),
    passo: grupo.membros[0].passo,
    letra: grupo.letra,
    foraDaLinha: new Set(grupo.fora),
  }));
}

/**
 * Etapa 5: um trecho sem letra cuja ponta continua a de um trecho com letra, a até 4,6 passos, herda
 * essa letra; a continuação mais próxima vence. Repete até nada mudar, para que a letra herdada também
 * passe adiante (camarote com várias linhas). Devolve os trechos que herdaram.
 */
function herdarLetras(trechos: Trecho[], passo: number): Set<Trecho> {
  const pares = continuacoes(trechos)
    .map(({ antes, depois }) => ({ antes, depois, distancia: distancia(ultimo(antes), primeiro(depois)) }))
    .filter((p) => p.distancia <= LIMITES.heranca * passo)
    .sort((a, b) => a.distancia - b.distancia);
  const herdeiros = new Set<Trecho>();
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const { antes, depois } of pares) {
      const [semLetra, comLetra] = antes.letra === null ? [antes, depois] : [depois, antes];
      if (semLetra.letra !== null || comLetra.letra === null) continue;
      semLetra.letra = comLetra.letra;
      herdeiros.add(semLetra);
      mudou = true;
    }
  }
  return herdeiros;
}

function pontoDeFileira(trecho: Trecho, herdeiros: Set<Trecho>): PontoMontado | null {
  const de = primeiro(trecho).numero;
  const ate = ultimo(trecho).numero;
  const numeroIds = trecho.numeros.map((n) => n.id);
  const unico = trecho.numeros.length === 1;
  if (herdeiros.has(trecho) && trecho.letra !== null) {
    const mensagem = unico
      ? `O lugar ${de} não tem letra de fileira por perto e recebeu a letra ${trecho.letra} porque continua a numeração. Confira.`
      : `Os lugares ${de} a ${ate} não têm letra de fileira por perto e receberam a letra ${trecho.letra} porque continuam a numeração. Confira.`;
    return { tipo: "LETRA_HERDADA", fileira: trecho.letra, numeroIds, mensagem };
  }
  if (trecho.letra === null) {
    const mensagem = unico
      ? `O lugar numerado ${de} não fica ao lado de nenhuma letra de fileira. Informe a fileira.`
      : `Os lugares numerados de ${de} a ${ate} não ficam ao lado de nenhuma letra de fileira. Informe a fileira.`;
    return { tipo: "SEM_FILEIRA", fileira: null, numeroIds, mensagem };
  }
  return null;
}

/** "13", "13 e 14", "13, 14, 26 e 27". */
function listar(valores: number[]): string {
  return valores.length < 2 ? valores.join("") : `${valores.slice(0, -1).join(", ")} e ${valores[valores.length - 1]}`;
}

/** Um ponto por fileira com todos os números que entraram nela fora da linha. */
function pontosForaDaLinha(trechos: Trecho[]): PontoMontado[] {
  const porFileira = new Map<string | null, NumeroLido[]>();
  for (const t of trechos) {
    const fora = t.numeros.filter((n) => t.foraDaLinha.has(n));
    if (fora.length > 0) porFileira.set(t.letra, [...(porFileira.get(t.letra) ?? []), ...fora]);
  }
  return [...porFileira].map(([fileira, fora]) => {
    const lista = listar(fora.map((n) => n.numero));
    const frase =
      fora.length === 1
        ? `o número ${lista} está fora da linha da fileira e foi ligado a ela pela numeração. Confira na planta.`
        : `os números ${lista} estão fora da linha da fileira e foram ligados a ela pela numeração. Confira na planta.`;
    return {
      tipo: "FORA_DA_LINHA" as const,
      fileira,
      numeroIds: fora.map((n) => n.id),
      mensagem: fileira === null ? frase.charAt(0).toUpperCase() + frase.slice(1) : `Fileira ${fileira}: ${frase}`,
    };
  });
}

/**
 * Etapa 6: em cada fileira, os trechos de passo 1 e, à parte, os de passo 2 de cada paridade, já
 * ordenados pelo primeiro número, devem começar em `último + passo`. Um número presente em dois
 * trechos da mesma fileira é repetição, mesmo que os trechos estejam em grupos diferentes.
 */
function validarFileiras(ordenados: Trecho[]): PontoMontado[] {
  const pontos: PontoMontado[] = [];
  const comFileira = ordenados.filter((t) => t.letra !== null);
  for (const [fileira, trechos] of agrupar(comFileira, (t) => t.letra ?? "")) {
    const sequencias = agrupar(trechos, (t) => (t.passo === 1 ? "1" : `2-${primeiro(t).numero % 2}`));
    for (const [inicial, ...seguintes] of sequencias.values()) {
      let fim = ultimo(inicial);
      for (const t of seguintes) {
        if (primeiro(t).numero > fim.numero + t.passo) {
          pontos.push({
            tipo: "SALTO_NUMERACAO",
            fileira,
            numeroIds: [fim.id, primeiro(t).id],
            mensagem: `Fileira ${fileira}: a numeração pula de ${fim.numero} para ${primeiro(t).numero}.`,
          });
        }
        if (ultimo(t).numero > fim.numero) fim = ultimo(t);
      }
    }
    const ocorrencias = agrupar(
      trechos.flatMap((t) => t.numeros),
      (n) => n.numero,
    );
    for (const [numero, repetidos] of [...ocorrencias].sort((a, b) => a[0] - b[0])) {
      if (repetidos.length < 2) continue;
      const vezes = repetidos.length === 2 ? "dois" : String(repetidos.length);
      pontos.push({
        tipo: "NUMERO_REPETIDO",
        fileira,
        numeroIds: repetidos.map((n) => n.id),
        mensagem: `Fileira ${fileira}: o número ${numero} aparece em ${vezes} trechos.`,
      });
    }
  }
  return pontos;
}

/** Fileiras em ordem de teatro (A…Z, depois AA…); trechos sem fileira por último. */
function compararFileiras(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.length - b.length || (a < b ? -1 : 1);
}

export function montarMapa(
  numeros: NumeroLido[],
  letras: LetraLida[],
): { passo: number; blocos: BlocoMontado[]; pontos: PontoMontado[] } {
  const passo = passoTipico(numeros);
  const trechos = montarTrechos(numeros, passo);
  for (const trecho of trechos) trecho.letra = letraMaisProxima(trecho, letras, passo);
  const unidos = juntarPorContinuidade(trechos, passo);
  const herdeiros = herdarLetras(unidos, passo);

  const ordenados = [...unidos].sort(
    (a, b) =>
      compararFileiras(a.letra, b.letra) ||
      primeiro(a).numero - primeiro(b).numero ||
      ultimo(a).numero - ultimo(b).numero,
  );
  const blocos = ordenados.map((t, i) => ({
    id: `bloco-${i}`,
    fileira: t.letra,
    numeros: t.numeros,
    foraDaLinha: t.numeros.filter((n) => t.foraDaLinha.has(n)).map((n) => n.id),
  }));
  const pontos = [
    ...pontosForaDaLinha(ordenados),
    ...ordenados.flatMap((t) => pontoDeFileira(t, herdeiros) ?? []),
    ...validarFileiras(ordenados),
  ];
  return { passo, blocos, pontos };
}
