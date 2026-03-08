import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const bucketName = process.env.MINIO_BUCKET;
const endpoint = process.env.MINIO_ENDPOINT;
const publicEndpoint = process.env.MINIO_PUBLIC_ENDPOINT ?? endpoint;
const accessKeyId = process.env.MINIO_ACCESS_KEY;
const secretAccessKey = process.env.MINIO_SECRET_KEY;

if (!bucketName || !endpoint || !accessKeyId || !secretAccessKey) {
  throw new Error(
    "Configuracao do MinIO ausente. Defina MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY e MINIO_BUCKET.",
  );
}

const s3Client = new S3Client({
  region: "us-east-1",
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

export async function baixarArquivo(storageKey: string, destino: string) {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: storageKey,
    }),
  );

  if (!response.Body) {
    throw new Error("Arquivo nao encontrado no storage");
  }

  const bodyStream = response.Body as Readable;
  await pipeline(bodyStream, createWriteStream(destino));
}

/**
 * Codifica o Content-Disposition de forma segura para S3/MinIO.
 * Caracteres não-ASCII (acentos, ç, etc.) causam erro de assinatura
 * no MinIO quando enviados diretamente no header.
 * Usa RFC 5987 (filename*=UTF-8''...) para nomes com caracteres especiais.
 */
function buildContentDisposition(filename: string): string {
  const hasNonAscii = /[^\x20-\x7E]/.test(filename);
  if (!hasNonAscii) {
    return `inline; filename="${filename}"`;
  }
  const encoded = encodeURIComponent(filename);
  return `inline; filename="${encoded}"; filename*=UTF-8''${encoded}`;
}

/**
 * Verifica se uma key já existe no bucket.
 */
async function keyExiste(key: string): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({ Bucket: bucketName, Key: key }),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Gera uma key unica no bucket baseada no nome do arquivo.
 * Se "documento.pdf" já existir, tenta "documento (1).pdf", "documento (2).pdf", etc.
 */
async function gerarKeyUnica(nomePdf: string): Promise<string> {
  if (!(await keyExiste(nomePdf))) {
    return nomePdf;
  }

  const pontoIndex = nomePdf.lastIndexOf(".");
  const base = pontoIndex > 0 ? nomePdf.slice(0, pontoIndex) : nomePdf;
  const ext = pontoIndex > 0 ? nomePdf.slice(pontoIndex) : "";

  for (let i = 1; i <= 100; i++) {
    const candidata = `${base} (${i})${ext}`;
    if (!(await keyExiste(candidata))) {
      return candidata;
    }
  }

  return `${randomUUID()}.pdf`;
}

export async function enviarPdf(caminho: string, nomeOriginal?: string) {
  const buffer = await readFile(caminho);

  const nomePdf = nomeOriginal
    ? nomeOriginal.replace(/\.(docx?|odt)$/i, ".pdf")
    : undefined;

  const key = nomePdf
    ? await gerarKeyUnica(nomePdf)
    : `${randomUUID()}.pdf`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
      ...(nomePdf && { ContentDisposition: buildContentDisposition(nomePdf) }),
    }),
  );

  if (!publicEndpoint) {
    throw new Error("MINIO_PUBLIC_ENDPOINT ou MINIO_ENDPOINT nao definido");
  }

  const url = `${publicEndpoint}/${bucketName}/${key}`;

  return { key, url };
}
