import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { basename, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function caminhoSaidaPdf(entrada: string, pastaSaida: string) {
  const nomeBase = basename(entrada).replace(/\.(doc|docx)$/i, ".pdf");
  return join(pastaSaida, nomeBase);
}

export function normalizarNomeArquivo(
  nomeArquivo: string | undefined,
  fallback: string,
) {
  if (!nomeArquivo) {
    return fallback;
  }

  const nomeSeguro = basename(nomeArquivo);
  return nomeSeguro || fallback;
}

export async function converterDocParaPdf(
  entrada: string,
  pastaSaida: string,
): Promise<string> {
  await execFileAsync("soffice", [
    "--headless",
    "--convert-to",
    "pdf",
    "--outdir",
    pastaSaida,
    entrada,
  ]);

  const caminhoPdf = caminhoSaidaPdf(entrada, pastaSaida);
  await access(caminhoPdf);

  return caminhoPdf;
}
