import { BadRequestException } from "@nestjs/common";
import { carregarPdfjs, URL_FONTES_PADRAO } from "./pdfjs";

/** Coordenadas em pontos, na página como ela aparece (y para baixo). */
export interface TokenLido {
  texto: string;
  x: number;
  y: number;
  angulo: number;
  tamanho: number;
  cor: string;
}

export interface FraseLida {
  texto: string;
  x: number;
  y: number;
  esquerda: number;
  tamanho: number;
  cor: string;
}

export interface PlantaLida {
  pagina: { numero: number; largura: number; altura: number };
  tokens: TokenLido[];
  frases: FraseLida[];
}

const COR_PADRAO = "#000000";
// Fração do tamanho da fonte entre a linha de base e o centro visual dos dígitos.
const FATOR_CENTRO_VERTICAL = 0.35;

/** Erro devolvido quando a planta não tem números de assento suficientes para montar o mapa. */
export function erroPlantaSemNumeros(): BadRequestException {
  return erro(
    "PLANTA_SEM_NUMEROS",
    "Não encontramos os números dos assentos nesta planta. Se ela foi escaneada ou salva como imagem, envie o PDF exportado do programa em que a planta foi desenhada.",
  );
}

function erro(code: string, message: string, details?: unknown): BadRequestException {
  return new BadRequestException({ code, message, details });
}

interface TokenDoOperador {
  texto: string;
  cor: string;
}

function ehGlifo(valor: unknown): valor is { unicode?: string } {
  return typeof valor === "object" && valor !== null;
}

/** Percorre os operadores gráficos e devolve os tokens de cada showText com a cor corrente. */
function coletarTokensDoOperador(
  ops: { fnArray: number[]; argsArray: unknown[] },
  OPS: Record<string, number>,
): TokenDoOperador[] {
  const resultado: TokenDoOperador[] = [];
  const pilha: string[] = [];
  let cor = COR_PADRAO;
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i] as unknown[] | null;
    if (fn === OPS.save) {
      pilha.push(cor);
    } else if (fn === OPS.restore) {
      cor = pilha.pop() ?? cor;
    } else if (fn === OPS.setFillRGBColor && typeof args?.[0] === "string") {
      cor = args[0];
    } else if (fn === OPS.showText && Array.isArray(args?.[0])) {
      const texto = (args[0] as unknown[])
        .map((g) => (ehGlifo(g) ? (g.unicode ?? "") : ""))
        .join("");
      for (const token of texto.split(/\s+/).filter(Boolean)) {
        resultado.push({ texto: token, cor });
      }
    }
  }
  return resultado;
}

export async function lerPlantaPdf(buffer: Buffer, pagina?: number): Promise<PlantaLida> {
  const pdfjs = await carregarPdfjs();
  // O tipo do pdf.js 6 não declara isEvalSupported, mas a opção continua valendo em tempo de execução.
  const parametros = {
    data: new Uint8Array(buffer),
    standardFontDataUrl: URL_FONTES_PADRAO,
    isEvalSupported: false,
    useSystemFonts: false,
    verbosity: 0, // só erros: PDFs inválidos não devem poluir o log com avisos de reparo
  };
  const tarefa = pdfjs.getDocument(parametros);
  let doc: Awaited<typeof tarefa.promise>;
  try {
    doc = await tarefa.promise;
  } catch {
    await tarefa.destroy().catch(() => undefined);
    throw erro("PDF_INVALIDO", "Não foi possível ler este arquivo. Envie a planta em PDF.");
  }

  try {
    if (pagina === undefined && doc.numPages > 1) {
      throw erro(
        "PDF_PAGINA_OBRIGATORIA",
        `Este PDF tem ${doc.numPages} páginas. Escolha a página que contém a planta.`,
        { paginas: doc.numPages },
      );
    }
    const numero = pagina ?? 1;
    if (!Number.isInteger(numero) || numero < 1 || numero > doc.numPages) {
      throw erro("PDF_PAGINA_INEXISTENTE", `A página ${numero} não existe neste PDF.`);
    }

    const pag = await doc.getPage(numero);
    const viewport = pag.getViewport({ scale: 1 });
    const conteudo = await pag.getTextContent();
    const doOperador = coletarTokensDoOperador(
      await pag.getOperatorList(),
      pdfjs.OPS as unknown as Record<string, number>,
    );

    const tokens: TokenLido[] = [];
    const frases: FraseLida[] = [];
    let cursor = 0;

    for (const item of conteudo.items) {
      if (!("str" in item) || item.str.length === 0) continue;
      const m = pdfjs.Util.transform(viewport.transform, item.transform);
      const tamanho = Math.hypot(m[2], m[3]);
      const norma = Math.hypot(m[0], m[1]) || 1;
      const dir = { x: m[0] / norma, y: m[1] / norma };
      const cima = { x: dir.y, y: -dir.x };
      const angulo = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
      const porCaractere = item.width / item.str.length;

      const centroDe = (inicio: number, comprimento: number) => {
        const deslocamento = (inicio + comprimento / 2) * porCaractere;
        return {
          x: m[4] + dir.x * deslocamento + cima.x * FATOR_CENTRO_VERTICAL * tamanho,
          y: m[5] + dir.y * deslocamento + cima.y * FATOR_CENTRO_VERTICAL * tamanho,
        };
      };

      let corPrimeiroToken: string | undefined;
      for (const achado of item.str.matchAll(/\S+/g)) {
        const texto = achado[0];
        // Casa com o operador em ordem; se divergir, avança até o próximo igual.
        let cor = COR_PADRAO;
        const k = doOperador.findIndex((t, idx) => idx >= cursor && t.texto === texto);
        if (k >= 0) {
          cor = doOperador[k].cor;
          cursor = k + 1;
        }
        corPrimeiroToken ??= cor;
        const centro = centroDe(achado.index ?? 0, texto.length);
        tokens.push({ texto, x: centro.x, y: centro.y, angulo, tamanho, cor });
      }

      if (/\p{L}{3,}/u.test(item.str)) {
        const centro = centroDe(0, item.str.length);
        frases.push({
          texto: item.str.trim(),
          x: centro.x,
          y: centro.y,
          esquerda: m[4],
          tamanho,
          cor: corPrimeiroToken ?? COR_PADRAO,
        });
      }
    }

    if (!tokens.some((t) => /^\d{1,4}$/.test(t.texto))) {
      throw erroPlantaSemNumeros();
    }

    return {
      pagina: { numero, largura: viewport.width, altura: viewport.height },
      tokens,
      frases,
    };
  } finally {
    await tarefa.destroy();
  }
}
