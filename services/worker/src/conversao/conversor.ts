import { access, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

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
  // Usar Carbone API para conversão de documentos
  // Carbone é 57x mais rápido que LibreOffice direto e resolve problemas de formatação
  // Ref: https://github.com/carboneio/document-converter-benchmark

  const carboneUrl = process.env.CARBONE_URL || "http://carbone:4000";
  const caminhoPdf = caminhoSaidaPdf(entrada, pastaSaida);

  try {
    // Ler o arquivo de entrada
    const arquivoBuffer = await readFile(entrada);

    // Preparar FormData para envio ao Carbone
    const formData = new FormData();
    const blob = new Blob([arquivoBuffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });
    formData.append("data", "{}"); // Dados vazios (não estamos usando templates)
    formData.append("convertTo", "pdf");
    formData.append("template", blob, basename(entrada));

    // Fazer requisição ao Carbone
    const response = await fetch(`${carboneUrl}/render`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Carbone API retornou erro ${response.status}: ${errorText}`
      );
    }

    // Salvar o PDF retornado
    const pdfBuffer = await response.arrayBuffer();
    await writeFile(caminhoPdf, Buffer.from(pdfBuffer));

    // Verificar se o arquivo foi criado
    await access(caminhoPdf);

    return caminhoPdf;
  } catch (error) {
    throw new Error(
      `Erro ao converter documento com Carbone: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
