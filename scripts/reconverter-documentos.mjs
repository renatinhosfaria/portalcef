/**
 * Script para re-enfileirar documentos com conversão falha.
 * Usa caminhos absolutos para resolver módulos no pnpm store.
 */

import { createRequire } from "node:module";
const require = createRequire("/app/services/worker/node_modules/.package-lock.json");

// Resolver módulos via pnpm store
const { Queue } = require("/app/node_modules/.pnpm/bullmq@5.66.7/node_modules/bullmq/dist/cjs/index.js");
const postgres = (await import("/app/node_modules/.pnpm/postgres@3.4.7/node_modules/postgres/src/index.js")).default;

const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

if (!DATABASE_URL) {
  console.error("DATABASE_URL não definida");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

const redisUrl = new URL(REDIS_URL);
const queue = new Queue("documentos-conversao", {
  connection: {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port || "6379"),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});

// Buscar documentos de plano_documento com erro
const planoRows = await sql`
  SELECT id, plano_id, storage_key, mime_type, file_name
  FROM plano_documento
  WHERE preview_status = 'ERRO'
  ORDER BY created_at ASC
`;

console.log(`Encontrados ${planoRows.length} documentos de plano com erro de conversão`);

// Buscar documentos de prova_documento com erro
const provaRows = await sql`
  SELECT id, prova_id, storage_key, mime_type, file_name
  FROM prova_documento
  WHERE preview_status = 'ERRO'
  ORDER BY created_at ASC
`;

console.log(`Encontrados ${provaRows.length} documentos de prova com erro de conversão`);

let enfileirados = 0;

for (const doc of planoRows) {
  // Resetar status para PENDENTE
  await sql`
    UPDATE plano_documento
    SET preview_status = 'PENDENTE', preview_error = NULL, updated_at = NOW()
    WHERE id = ${doc.id}
  `;

  // Adicionar job na fila
  await queue.add("converter", {
    documentoId: doc.id,
    planoId: doc.plano_id,
    storageKey: doc.storage_key,
    mimeType: doc.mime_type,
    fileName: doc.file_name,
    tabela: "plano_documento",
  });

  enfileirados++;
  if (enfileirados % 10 === 0) {
    console.log(`  ${enfileirados}/${planoRows.length + provaRows.length} enfileirados...`);
  }
}

for (const doc of provaRows) {
  // Resetar status para PENDENTE
  await sql`
    UPDATE prova_documento
    SET preview_status = 'PENDENTE', preview_error = NULL, updated_at = NOW()
    WHERE id = ${doc.id}
  `;

  // Adicionar job na fila
  await queue.add("converter", {
    documentoId: doc.id,
    planoId: doc.prova_id,
    storageKey: doc.storage_key,
    mimeType: doc.mime_type,
    fileName: doc.file_name,
    tabela: "prova_documento",
  });

  enfileirados++;
  if (enfileirados % 10 === 0) {
    console.log(`  ${enfileirados}/${planoRows.length + provaRows.length} enfileirados...`);
  }
}

console.log(`\nConcluído: ${enfileirados} documentos re-enfileirados com sucesso`);

await queue.close();
await sql.end();
process.exit(0);
