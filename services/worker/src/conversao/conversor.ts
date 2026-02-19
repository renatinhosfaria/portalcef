import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { promisify } from "node:util";

const MIME_TYPE_DOC = "application/msword";
const EXTENSAO_DOC_REGEX = /\.doc$/i;
const execFileAsync = promisify(execFile);

interface ConversaoDocOptions {
  caminhoEntrada: string;
  mimeType?: string;
  nomeArquivoOriginal?: string;
}

interface ConverterDocParaPdfOptions {
  mimeType?: string;
  nomeArquivoOriginal?: string;
}

export function caminhoSaidaPdf(entrada: string, pastaSaida: string) {
  const nomeBase = basename(entrada).replace(/\.(doc|docx)$/i, ".pdf");
  return join(pastaSaida, nomeBase);
}

export function caminhoSaidaDocxIntermediario(
  entrada: string,
  pastaSaida: string,
) {
  const nomeBase = basename(entrada).replace(/\.doc$/i, ".docx");
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

export function deveUsarLibreOfficeParaDoc(
  options: ConversaoDocOptions,
): boolean {
  if (options.mimeType?.toLowerCase() === MIME_TYPE_DOC) {
    return true;
  }

  const nomesArquivo = [
    options.nomeArquivoOriginal,
    options.caminhoEntrada,
  ].filter(Boolean) as string[];

  return nomesArquivo.some((nomeArquivo) => EXTENSAO_DOC_REGEX.test(nomeArquivo));
}

async function converterDocParaDocxComLibreOffice(
  entrada: string,
  pastaSaida: string,
): Promise<string> {
  const caminhoDocxIntermediario = caminhoSaidaDocxIntermediario(
    entrada,
    pastaSaida,
  );
  
  // Cada execução usa um perfil isolado para evitar conflito entre jobs concorrentes.
  // Sem isso, o LibreOffice pode falhar ao tentar compartilhar lock de perfil.
  const pastaPerfilLibreOffice = join(
    pastaSaida,
    `libreoffice-profile-${randomUUID()}`,
  );
  await mkdir(pastaPerfilLibreOffice, { recursive: true });

  const args = gerarArgsConversaoDocParaDocx(
    entrada,
    pastaSaida,
    pastaPerfilLibreOffice,
  );
  const comandoLibreOffice = process.env.LIBREOFFICE_BIN || "soffice";

  try {
    await execFileAsync(comandoLibreOffice, args);
    await access(caminhoDocxIntermediario);
    return caminhoDocxIntermediario;
  } catch (error) {
    const erroExec = error as { stderr?: string; stdout?: string; message?: string };
    const detalhes = erroExec.stderr || erroExec.stdout || erroExec.message || String(error);
    throw new Error(
      `Falha na conversao DOC -> DOCX via LibreOffice (${comandoLibreOffice}): ${detalhes}`,
    );
  }
}

export function gerarArgsConversaoDocParaDocx(
  entrada: string,
  pastaSaida: string,
  pastaPerfilLibreOffice: string,
) {
  return [
    "--headless",
    "--convert-to",
    "docx",
    "--outdir",
    pastaSaida,
    entrada,
    `-env:UserInstallation=file://${pastaPerfilLibreOffice}`,
  ];
}

async function converterDocxParaPdfComCarbone(
  entrada: string,
  caminhoPdf: string,
) {
  // Usar Carbone API para conversão de documentos
  // Carbone é 57x mais rápido que LibreOffice direto e resolve problemas de formatação
  // Ref: https://github.com/carboneio/document-converter-benchmark
  //
  // Fluxo da API Carbone:
  // 1. POST /template - fazer upload do template e obter templateId
  // 2. POST /render/:templateId - fazer render com dados e obter renderId
  // 3. GET /render/:renderId - baixar o PDF gerado
  const carboneUrl = process.env.CARBONE_URL || "http://carbone:4000";

  // Ler o arquivo de entrada
  const arquivoBuffer = await readFile(entrada);

  // Passo 1: Upload do template
  const uploadFormData = new FormData();
  const blob = new Blob([arquivoBuffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  uploadFormData.append("template", blob, basename(entrada));

  const uploadResponse = await fetch(`${carboneUrl}/template`, {
    method: "POST",
    body: uploadFormData,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(
      `Falha ao fazer upload do template: ${uploadResponse.status} - ${errorText}`,
    );
  }

  const uploadData = (await uploadResponse.json()) as { data: { templateId: string } };
  const templateId = uploadData.data.templateId;

  // Passo 2: Render do template com conversão para PDF
  const renderBody = {
    data: {}, // Dados vazios (documento sem variáveis)
    convertTo: "pdf",
  };

  const renderResponse = await fetch(`${carboneUrl}/render/${templateId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(renderBody),
  });

  if (!renderResponse.ok) {
    const errorText = await renderResponse.text();
    throw new Error(
      `Falha ao renderizar template: ${renderResponse.status} - ${errorText}`,
    );
  }

  const renderData = (await renderResponse.json()) as { data: { renderId: string } };
  const renderId = renderData.data.renderId;

  // Passo 3: Download do PDF gerado
  const downloadResponse = await fetch(`${carboneUrl}/render/${renderId}`, {
    method: "GET",
  });

  if (!downloadResponse.ok) {
    const errorText = await downloadResponse.text();
    throw new Error(
      `Falha ao baixar PDF: ${downloadResponse.status} - ${errorText}`,
    );
  }

  // Salvar o PDF retornado
  const pdfBuffer = await downloadResponse.arrayBuffer();
  await writeFile(caminhoPdf, Buffer.from(pdfBuffer));

  // Verificar se o arquivo foi criado
  await access(caminhoPdf);

  return caminhoPdf;
}

export async function converterDocParaPdf(
  entrada: string,
  pastaSaida: string,
  options: ConverterDocParaPdfOptions = {},
): Promise<string> {
  const caminhoPdf = caminhoSaidaPdf(entrada, pastaSaida);

  try {
    if (
      deveUsarLibreOfficeParaDoc({
        caminhoEntrada: entrada,
        mimeType: options.mimeType,
        nomeArquivoOriginal: options.nomeArquivoOriginal,
      })
    ) {
      const caminhoDocxIntermediario = await converterDocParaDocxComLibreOffice(
        entrada,
        pastaSaida,
      );
      return converterDocxParaPdfComCarbone(caminhoDocxIntermediario, caminhoPdf);
    }

    return converterDocxParaPdfComCarbone(entrada, caminhoPdf);
  } catch (error) {
    throw new Error(
      `Erro ao converter documento: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
