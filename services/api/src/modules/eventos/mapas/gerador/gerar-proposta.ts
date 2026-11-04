import type {
  EntradaLegenda,
  LugarProposto,
  PontoConferir,
  PropostaMapa,
} from "@essencia/shared/eventos/mapa-proposta";
import { desenharBlocos } from "./desenhar-mapa";
import { dentroDaCaixa, lerElementos, lerLegenda, type EntradaLegendaLida } from "./ler-legenda";
import { erroPlantaSemNumeros, lerPlantaPdf, type TokenLido } from "./ler-planta-pdf";
import { montarMapa, type LetraLida, type NumeroLido } from "./montar-mapa";

// Tamanho da caixa de cada lugar, em múltiplos do passo típico.
const LARGURA_POR_PASSO = 0.8;
const ALTURA_POR_PASSO = 0.72;
// Texto igual com o centro até esta distância (em pontos) de outro já aceito é o mesmo texto desenhado de novo.
const TOLERANCIA_DUPLICADO = 0.5;

const ehNumero = (texto: string) => /^\d{1,4}$/.test(texto);
const ehLetra = (texto: string) => /^[A-Z]{1,2}$/.test(texto);

/** Pontos do PDF para a unidade do mapa (0,1 pt), em inteiros. */
const naUnidade = (pontos: number) => Math.round(pontos * 10);

/**
 * Descarta texto desenhado duas vezes no mesmo lugar (negrito falso de alguns PDFs), que zeraria o
 * passo típico. Fica o primeiro desenho de cada texto.
 */
function semDuplicados(tokens: TokenLido[]): TokenLido[] {
  const aceitosPorTexto = new Map<string, TokenLido[]>();
  return tokens.filter((token) => {
    const aceitos = aceitosPorTexto.get(token.texto);
    if (!aceitos) {
      aceitosPorTexto.set(token.texto, [token]);
      return true;
    }
    if (aceitos.some((a) => Math.hypot(a.x - token.x, a.y - token.y) <= TOLERANCIA_DUPLICADO)) return false;
    aceitos.push(token);
    return true;
  });
}

function montarLegenda(lugares: LugarProposto[], lidas: EntradaLegendaLida[]): EntradaLegenda[] {
  const quantidades = new Map<string, number>();
  for (const l of lugares) quantidades.set(l.cor, (quantidades.get(l.cor) ?? 0) + 1);
  // Ordenação estável: no empate, vale a ordem em que a cor aparece nos lugares.
  const porQuantidade = [...quantidades].sort((a, b) => b[1] - a[1]);
  return porQuantidade.map(([cor, quantidade], i) => {
    const lida = lidas.find((e) => e.cor === cor);
    if (lida) {
      const { texto, categoria, acessoExterno } = lida;
      return { cor, texto, quantidade, categoria, acessoExterno, confirmada: false };
    }
    const categoria = i === 0 ? "COMUM" : null; // a cor dominante é a dos lugares comuns
    return { cor, texto: null, quantidade, categoria, acessoExterno: false, confirmada: false };
  });
}

export async function gerarPropostaDePdf(buffer: Buffer, pagina?: number): Promise<PropostaMapa> {
  const lida = await lerPlantaPdf(buffer, pagina);
  const planta = { ...lida, tokens: semDuplicados(lida.tokens) };
  const coresDosNumeros = new Set(planta.tokens.filter((t) => ehNumero(t.texto)).map((t) => t.cor));
  const legenda = lerLegenda(planta, coresDosNumeros);
  const foraDaLegenda = planta.tokens.filter((t) => !dentroDaCaixa(t, legenda.area));

  const numeros: NumeroLido[] = foraDaLegenda
    .filter((t) => ehNumero(t.texto))
    .map((t, i) => ({ id: `numero-${i}`, numero: Number(t.texto), x: t.x, y: t.y, angulo: t.angulo, cor: t.cor }));
  const letras: LetraLida[] = foraDaLegenda
    .filter((t) => ehLetra(t.texto))
    .map((t) => ({ letra: t.texto, x: t.x, y: t.y }));

  // Com menos de dois números não há passo típico: os lugares sairiam com tamanho zero.
  if (numeros.length < 2) throw erroPlantaSemNumeros();

  const { passo, blocos, pontos } = montarMapa(numeros, letras);
  // desenharBlocos devolve um lugar desenhado por número, e todo número dos pontos está num bloco.
  const desenhados = new Map(desenharBlocos(blocos).map((d) => [d.numeroId, d]));
  const largura = naUnidade(LARGURA_POR_PASSO * passo);
  const altura = naUnidade(ALTURA_POR_PASSO * passo);

  const lugares: LugarProposto[] = [];
  const lugarDoNumero = new Map<string, string>();
  for (const bloco of blocos) {
    for (const n of bloco.numeros) {
      const desenhado = desenhados.get(n.id)!;
      const id = `lugar-${lugares.length}`;
      lugarDoNumero.set(n.id, id);
      lugares.push({
        id,
        fileira: bloco.fileira ?? "",
        numero: String(n.numero),
        x: naUnidade(desenhado.x),
        y: naUnidade(desenhado.y),
        largura,
        altura,
        rotacao: Math.round(desenhado.rotacao * 10) / 10,
        blocoId: bloco.id,
        cor: n.cor,
        categoriaManual: null,
        acessoExternoManual: null,
        vender: true,
        origem: "GERADOR",
      });
    }
  }

  const pontosConferir: PontoConferir[] = pontos.map((ponto, k) => ({
    id: `ponto-${k}`,
    tipo: ponto.tipo,
    mensagem: ponto.mensagem,
    lugarIds: ponto.numeroIds.map((id) => lugarDoNumero.get(id)!),
    conferido: false,
  }));

  return {
    versao: 1,
    revisao: 0,
    pagina: {
      numero: planta.pagina.numero,
      largura: naUnidade(planta.pagina.largura),
      altura: naUnidade(planta.pagina.altura),
    },
    lugares,
    rotulos: letras.map((l) => ({ fileira: l.letra, x: naUnidade(l.x), y: naUnidade(l.y) })),
    elementos: lerElementos(planta, legenda.area).map((e) => ({ ...e, x: naUnidade(e.x), y: naUnidade(e.y) })),
    legenda: montarLegenda(lugares, legenda.entradas),
    pontos: pontosConferir,
  };
}
