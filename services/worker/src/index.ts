import { Worker } from "bullmq";
import { getDb, planoDocumento, provaDocumento, eq } from "@essencia/db";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { converterDocParaPdf, normalizarNomeArquivo } from "./conversao/conversor";
import { baixarArquivo, enviarPdf } from "./storage/minio-client";

type TabelaDocumento = "plano_documento" | "prova_documento";

interface ConversaoDocumentoJob {
  documentoId: string;
  planoId: string;
  storageKey: string;
  mimeType: string;
  fileName: string;
  /** Tabela de origem do documento. Default: "plano_documento" (retrocompatível) */
  tabela?: TabelaDocumento;
}

/**
 * Retorna a referência da tabela Drizzle com base no nome da tabela.
 */
function getTabelaDocumento(tabela: TabelaDocumento) {
  if (tabela === "prova_documento") {
    return provaDocumento;
  }
  return planoDocumento;
}

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const healthPort = parseInt(process.env.HEALTH_PORT ?? "3100", 10);
const concurrency = parseInt(process.env.WORKER_CONCURRENCY ?? "2", 10);

const startTime = Date.now();

const worker = new Worker<ConversaoDocumentoJob>(
  "documentos-conversao",
  async (job) => {
    const { documentoId, storageKey, fileName } = job.data;
    const tabela = job.data.tabela ?? "plano_documento";
    const tabelaRef = getTabelaDocumento(tabela);
    const db = getDb();

    console.log(`[worker] Processando documento ${documentoId} da tabela ${tabela}`);

    const pastaTemp = await mkdtemp(join(tmpdir(), "doc-conversao-"));
    const nomeSeguro = normalizarNomeArquivo(fileName, `${documentoId}.docx`);
    const caminhoEntrada = join(pastaTemp, nomeSeguro);

    try {
      await baixarArquivo(storageKey, caminhoEntrada);
      const caminhoPdf = await converterDocParaPdf(caminhoEntrada, pastaTemp, {
        mimeType: job.data.mimeType,
        nomeArquivoOriginal: job.data.fileName,
      });
      const preview = await enviarPdf(caminhoPdf, fileName);

      await db
        .update(tabelaRef)
        .set({
          previewKey: preview.key,
          previewUrl: preview.url,
          previewMimeType: "application/pdf",
          previewStatus: "PRONTO",
          previewError: null,
          updatedAt: new Date(),
        })
        .where(eq(tabelaRef.id, documentoId));
    } catch (error) {
      await db
        .update(tabelaRef)
        .set({
          previewStatus: "ERRO",
          previewError: error instanceof Error ? error.message : String(error),
          updatedAt: new Date(),
        })
        .where(eq(tabelaRef.id, documentoId));

      throw error;
    } finally {
      await rm(pastaTemp, { recursive: true, force: true });
    }
  },
  {
    connection: { url: redisUrl },
    concurrency,
  },
);

console.log(`[worker] Iniciado com concurrency: ${concurrency}`);

worker.on("completed", (job) => {
  console.log(`[worker] Documento convertido: ${job.data.documentoId}`);
});

worker.on("failed", (job, err) => {
  if (!job) return;
  console.error(
    `[worker] Falha ao converter documento ${job.data.documentoId}: ${err.message}`,
  );
});

/**
 * Health check endpoint
 * Retorna status do worker e metricas basicas
 */
const healthServer = createServer((req, res) => {
  if (req.url === "/health" && req.method === "GET") {
    const uptime = Math.floor((Date.now() - startTime) / 1000);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        worker: "documentos-conversao",
        uptime,
        timestamp: new Date().toISOString(),
      }),
    );
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(healthPort, () => {
  console.log(`[worker] Health check rodando na porta ${healthPort}`);
});

process.on("SIGTERM", async () => {
  console.log("[worker] Recebido SIGTERM, encerrando gracefully...");
  healthServer.close();
  await worker.close();
  process.exit(0);
});
