/**
 * Script de migração: Corrigir Content-Disposition dos arquivos no MinIO
 *
 * Adiciona o header Content-Disposition com o nome original do arquivo
 * para que o browser use o nome correto ao baixar/exibir.
 *
 * Uso: npx tsx scripts/fix-minio-filenames.ts
 *
 * Requer variáveis de ambiente:
 *   DATABASE_URL, MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET
 */

import {
  CopyObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import postgres from "postgres";

// Configuração do banco
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL não definida");
  process.exit(1);
}

// Configuração do MinIO
const minioEndpoint = process.env.MINIO_ENDPOINT;
const minioAccessKey = process.env.MINIO_ACCESS_KEY;
const minioSecretKey = process.env.MINIO_SECRET_KEY;
const minioBucket = process.env.MINIO_BUCKET;

if (!minioEndpoint || !minioAccessKey || !minioSecretKey || !minioBucket) {
  console.error(
    "Variáveis do MinIO ausentes: MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET",
  );
  process.exit(1);
}

const sql = postgres(databaseUrl);

const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: minioEndpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: minioAccessKey,
    secretAccessKey: minioSecretKey,
  },
});

interface ResultadoMigracao {
  total: number;
  atualizados: number;
  jaCorretos: number;
  erros: number;
}

/**
 * Atualiza o Content-Disposition de um objeto no MinIO
 * copiando-o para si mesmo com a nova metadata.
 */
async function atualizarContentDisposition(
  key: string,
  fileName: string,
): Promise<boolean> {
  try {
    // Buscar metadata atual do objeto
    const head = await s3Client.send(
      new HeadObjectCommand({
        Bucket: minioBucket,
        Key: key,
      }),
    );

    const disposicaoEsperada = `inline; filename="${fileName}"`;

    // Verificar se já está correto
    if (head.ContentDisposition === disposicaoEsperada) {
      return false; // Já correto, nada a fazer
    }

    // Tentar CopyObject primeiro (mais eficiente)
    try {
      await s3Client.send(
        new CopyObjectCommand({
          Bucket: minioBucket,
          Key: key,
          CopySource: `${minioBucket}/${key}`,
          ContentType: head.ContentType || "application/octet-stream",
          ContentDisposition: disposicaoEsperada,
          MetadataDirective: "REPLACE",
        }),
      );
      return true;
    } catch {
      // Fallback: download + re-upload (resolve erro de assinatura do MinIO)
      const getResponse = await s3Client.send(
        new GetObjectCommand({ Bucket: minioBucket, Key: key }),
      );
      const chunks: Uint8Array[] = [];
      for await (const chunk of getResponse.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);

      await s3Client.send(
        new PutObjectCommand({
          Bucket: minioBucket,
          Key: key,
          Body: body,
          ContentType: head.ContentType || "application/octet-stream",
          ContentDisposition: disposicaoEsperada,
        }),
      );
      return true;
    }
  } catch (error) {
    const mensagem =
      error instanceof Error ? error.message : String(error);
    console.error(`  ERRO ao atualizar ${key}: ${mensagem}`);
    throw error;
  }
}

/**
 * Migra os documentos da tabela plano_documento
 */
async function migrarPlanoDocumento(): Promise<ResultadoMigracao> {
  console.log("\n--- plano_documento ---");

  const documentos = await sql`
    SELECT storage_key, file_name, preview_key
    FROM plano_documento
    WHERE storage_key IS NOT NULL
      AND file_name IS NOT NULL
  `;

  const resultado: ResultadoMigracao = {
    total: documentos.length,
    atualizados: 0,
    jaCorretos: 0,
    erros: 0,
  };

  console.log(`Encontrados ${documentos.length} documentos`);

  for (const doc of documentos) {
    const storageKey = doc.storage_key as string;
    const fileName = doc.file_name as string;
    const previewKey = doc.preview_key as string | null;

    // Atualizar arquivo original
    try {
      const atualizado = await atualizarContentDisposition(
        storageKey,
        fileName,
      );
      if (atualizado) {
        resultado.atualizados++;
        console.log(`  ✓ ${storageKey} → "${fileName}"`);
      } else {
        resultado.jaCorretos++;
      }
    } catch {
      resultado.erros++;
    }

    // Atualizar preview (PDF convertido)
    if (previewKey) {
      const nomePdf = fileName.replace(/\.(docx?|odt)$/i, ".pdf");
      try {
        const atualizado = await atualizarContentDisposition(
          previewKey,
          nomePdf,
        );
        if (atualizado) {
          resultado.atualizados++;
          console.log(`  ✓ ${previewKey} → "${nomePdf}" (preview)`);
        } else {
          resultado.jaCorretos++;
        }
      } catch {
        resultado.erros++;
      }
    }
  }

  return resultado;
}

/**
 * Migra os documentos da tabela quinzena_documents
 */
async function migrarQuinzenaDocuments(): Promise<ResultadoMigracao> {
  console.log("\n--- quinzena_documents ---");

  const documentos = await sql`
    SELECT file_key, file_name
    FROM quinzena_documents
    WHERE file_key IS NOT NULL
      AND file_name IS NOT NULL
  `;

  const resultado: ResultadoMigracao = {
    total: documentos.length,
    atualizados: 0,
    jaCorretos: 0,
    erros: 0,
  };

  console.log(`Encontrados ${documentos.length} documentos`);

  for (const doc of documentos) {
    const fileKey = doc.file_key as string;
    const fileName = doc.file_name as string;

    try {
      const atualizado = await atualizarContentDisposition(fileKey, fileName);
      if (atualizado) {
        resultado.atualizados++;
        console.log(`  ✓ ${fileKey} → "${fileName}"`);
      } else {
        resultado.jaCorretos++;
      }
    } catch {
      resultado.erros++;
    }
  }

  return resultado;
}

/**
 * Execução principal
 */
async function main() {
  console.log("=== Migração: Content-Disposition dos arquivos no MinIO ===");
  console.log(`Bucket: ${minioBucket}`);
  console.log(`Endpoint: ${minioEndpoint}`);

  const resultados: ResultadoMigracao[] = [];

  resultados.push(await migrarPlanoDocumento());
  resultados.push(await migrarQuinzenaDocuments());

  // Resumo
  const total = resultados.reduce((s, r) => s + r.total, 0);
  const atualizados = resultados.reduce((s, r) => s + r.atualizados, 0);
  const jaCorretos = resultados.reduce((s, r) => s + r.jaCorretos, 0);
  const erros = resultados.reduce((s, r) => s + r.erros, 0);

  console.log("\n=== Resumo ===");
  console.log(`Total de registros: ${total}`);
  console.log(`Atualizados: ${atualizados}`);
  console.log(`Já corretos: ${jaCorretos}`);
  console.log(`Erros: ${erros}`);

  await sql.end();

  if (erros > 0) {
    console.error(`\n⚠ ${erros} erros encontrados. Verifique os logs acima.`);
    process.exit(1);
  }

  console.log("\n✓ Migração concluída com sucesso!");
}

main().catch((error) => {
  console.error("Erro fatal:", error);
  process.exit(1);
});
