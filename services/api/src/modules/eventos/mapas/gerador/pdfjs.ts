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

export function carregarPdfjs(): Promise<Pdfjs> {
  carregado ??= importarNativo(
    pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href,
  );
  return carregado;
}

export const URL_FONTES_PADRAO: string = join(
  dirname(require.resolve("pdfjs-dist/package.json")),
  "standard_fonts/",
);
