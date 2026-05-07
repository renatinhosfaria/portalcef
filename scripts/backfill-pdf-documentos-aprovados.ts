#!/usr/bin/env node
/**
 * Script de back-fill: PDF derivado para documentos já aprovados.
 *
 * - Documentos PDF: espelha `pdfStorageKey`/`pdfUrl` a partir de `storageKey`/`url`
 *   (batch SQL direto, muito rápido).
 * - Documentos Word (.docx/.doc): sobe para SharePoint, converte via
 *   Graph /content?format=pdf, salva no MinIO, grava os campos.
 *
 * Idempotente — ignora documentos que já têm `pdfUrl` preenchido.
 *
 * Uso (dentro do container da API ou em ambiente com .env configurado):
 *   pnpm tsx scripts/backfill-pdf-documentos-aprovados.ts
 */

import { config } from "dotenv";
import axios from "axios";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import "isomorphic-fetch";
import postgres from "postgres";

config({ path: ".env" });

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIME = "application/msword";
const PDF_MIME = "application/pdf";

const DATABASE_URL = requireEnv("DATABASE_URL");
const MINIO_ENDPOINT = requireEnv("MINIO_ENDPOINT");
const MINIO_PUBLIC_ENDPOINT =
  process.env.MINIO_PUBLIC_ENDPOINT ?? MINIO_ENDPOINT;
const MINIO_ACCESS_KEY = requireEnv("MINIO_ACCESS_KEY");
const MINIO_SECRET_KEY = requireEnv("MINIO_SECRET_KEY");
const MINIO_BUCKET = requireEnv("MINIO_BUCKET");
const AZURE_TENANT_ID = requireEnv("AZURE_TENANT_ID");
const AZURE_CLIENT_ID = requireEnv("AZURE_CLIENT_ID");
const AZURE_CLIENT_SECRET = requireEnv("AZURE_CLIENT_SECRET");
const SHAREPOINT_SITE_ID = requireEnv("SHAREPOINT_SITE_ID");
const SHAREPOINT_DRIVE_ID = requireEnv("SHAREPOINT_DRIVE_ID");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`\u274c Vari\u00e1vel de ambiente ausente: ${name}`);
    process.exit(1);
  }
  return value;
}

const sql = postgres(DATABASE_URL, { max: 1 });

const s3 = new S3Client({
  region: "us-east-1",
  endpoint: MINIO_ENDPOINT,
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: MINIO_ACCESS_KEY,
    secretAccessKey: MINIO_SECRET_KEY,
  },
});

const credential = new ClientSecretCredential(
  AZURE_TENANT_ID,
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
);
const authProvider = new TokenCredentialAuthenticationProvider(credential, {
  scopes: ["https://graph.microsoft.com/.default"],
});
const graph = Client.initWithMiddleware({ authProvider });

async function espelharPdfsJaExistentes(): Promise<void> {
  const updates = [
    sql`
      UPDATE plano_documento
         SET pdf_storage_key = storage_key,
             pdf_url = url
       WHERE approved_at IS NOT NULL
         AND mime_type = ${PDF_MIME}
         AND pdf_url IS NULL
    `,
    sql`
      UPDATE prova_documento
         SET pdf_storage_key = storage_key,
             pdf_url = url
       WHERE approved_at IS NOT NULL
         AND mime_type = ${PDF_MIME}
         AND pdf_url IS NULL
    `,
  ];

  for (const u of updates) {
    const result = await u;
    console.log(`\u{1F4D1} Espelhados ${result.count} documento(s) PDF.`);
  }
}

interface DocumentoDocx {
  id: string;
  storage_key: string;
  url: string;
  file_name: string;
  mime_type: string;
}

async function baixarDoMinio(key: string): Promise<Buffer> {
  const res = await s3.send(
    new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: key }),
  );
  const chunks: Buffer[] = [];
  for await (const chunk of res.Body as NodeJS.ReadableStream) {
    chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk as any));
  }
  return Buffer.concat(chunks);
}

async function subirParaSharePoint(
  buffer: Buffer,
  fileName: string,
  documentoId: string,
): Promise<string> {
  const token = await credential.getToken("https://graph.microsoft.com/.default");
  const uploadPath = `/sites/${SHAREPOINT_SITE_ID}/drives/${SHAREPOINT_DRIVE_ID}/root:/edicao-temporaria/${documentoId}/${fileName}:/content`;
  const response = await axios.put(
    `https://graph.microsoft.com/v1.0${uploadPath}`,
    buffer,
    {
      headers: {
        Authorization: `Bearer ${token.token}`,
        "Content-Type": "application/octet-stream",
      },
    },
  );
  return response.data.id as string;
}

async function converterParaPdfViaGraph(itemId: string): Promise<Buffer> {
  const token = await credential.getToken("https://graph.microsoft.com/.default");
  const url = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drives/${SHAREPOINT_DRIVE_ID}/items/${itemId}/content?format=pdf`;
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
    headers: { Authorization: `Bearer ${token.token}` },
    maxRedirects: 5,
  });
  return Buffer.from(response.data);
}

async function removerSharePointItem(itemId: string): Promise<void> {
  try {
    await graph
      .api(
        `/sites/${SHAREPOINT_SITE_ID}/drives/${SHAREPOINT_DRIVE_ID}/items/${itemId}`,
      )
      .delete();
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : String(error);
    console.warn(`  \u26a0\ufe0f  Falha ao remover item ${itemId}: ${mensagem}`);
  }
}

async function subirPdfMinio(
  buffer: Buffer,
  fileName: string,
): Promise<{ key: string; url: string }> {
  const ext = extname(fileName) || ".pdf";
  const baseName = fileName.slice(0, -ext.length);
  const pdfFileName = `${baseName}.pdf`;
  const key = `pdf/${randomUUID()}.pdf`;
  const hasNonAscii = /[^\x20-\x7E]/.test(pdfFileName);
  const contentDisposition = hasNonAscii
    ? `inline; filename="${encodeURIComponent(pdfFileName)}"; filename*=UTF-8''${encodeURIComponent(pdfFileName)}`
    : `inline; filename="${pdfFileName}"`;

  await s3.send(
    new PutObjectCommand({
      Bucket: MINIO_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: PDF_MIME,
      ContentDisposition: contentDisposition,
    }),
  );

  return {
    key,
    url: `${MINIO_PUBLIC_ENDPOINT}/${MINIO_BUCKET}/${key}`,
  };
}

async function gerarPdfParaDocxPendentes(
  tabela: "plano_documento" | "prova_documento",
): Promise<void> {
  const documentos = (await sql`
    SELECT id, storage_key, url, file_name, mime_type
      FROM ${sql(tabela)}
     WHERE approved_at IS NOT NULL
       AND pdf_url IS NULL
       AND mime_type IN (${DOCX_MIME}, ${DOC_MIME})
       AND storage_key IS NOT NULL
  `) as unknown as DocumentoDocx[];

  console.log(
    `\u{1F4C4} ${tabela}: ${documentos.length} documento(s) Word pendente(s).`,
  );

  for (const doc of documentos) {
    const fileName = doc.file_name ?? "documento.docx";
    console.log(`  \u2192 ${doc.id} (${fileName})`);

    let itemId: string | null = null;
    try {
      const buffer = await baixarDoMinio(doc.storage_key);
      itemId = await subirParaSharePoint(buffer, fileName, doc.id);
      const pdfBuffer = await converterParaPdfViaGraph(itemId);
      const { key, url } = await subirPdfMinio(pdfBuffer, fileName);

      await sql`
        UPDATE ${sql(tabela)}
           SET pdf_storage_key = ${key},
               pdf_url = ${url}
         WHERE id = ${doc.id}
      `;

      console.log(`    \u2713 PDF gerado em ${key}`);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      console.error(`    \u2717 Falha: ${mensagem}`);
    } finally {
      if (itemId) await removerSharePointItem(itemId);
    }
  }
}

async function main(): Promise<void> {
  console.log("\u{1F504} Iniciando back-fill de PDFs para impress\u00e3o...\n");

  await espelharPdfsJaExistentes();
  await gerarPdfParaDocxPendentes("plano_documento");
  await gerarPdfParaDocxPendentes("prova_documento");

  console.log("\n\u2705 Back-fill conclu\u00eddo.");
  await sql.end();
}

main().catch((error) => {
  console.error("\u{1F525} Erro fatal:", error);
  process.exit(1);
});
