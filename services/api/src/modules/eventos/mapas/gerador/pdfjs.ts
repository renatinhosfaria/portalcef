import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

type Pdfjs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

// O Jest (CommonJS) troca import() por require(), que não carrega o pdf.js (ESM).
// O import nativo, com o caminho resolvido, funciona no build da API e no Jest com --experimental-vm-modules.
// eslint-disable-next-line @typescript-eslint/no-implied-eval -- preserva o import() nativo, que o ts-jest reescreveria
const importarNativo = new Function("especificador", "return import(especificador)") as (
  especificador: string,
) => Promise<Pdfjs>;

let carregado: Promise<Pdfjs> | undefined;

/** Carrega o pdf.js uma vez. O parâmetro existe para o teste injetar o import; o código usa o padrão. */
export function carregarPdfjs(
  importar: (especificador: string) => Promise<Pdfjs> = importarNativo,
): Promise<Pdfjs> {
  carregado ??= importar(pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href).catch(
    (erro: unknown) => {
      // Uma falha passageira não pode ficar guardada: a próxima chamada tenta de novo.
      carregado = undefined;
      throw erro;
    },
  );
  return carregado;
}

export const URL_FONTES_PADRAO: string = join(
  dirname(require.resolve("pdfjs-dist/package.json")),
  "standard_fonts/",
);
