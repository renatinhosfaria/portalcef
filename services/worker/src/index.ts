import { Worker } from "bullmq";
import { getDb, planoDocumento, eq } from "@essencia/db";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { converterDocParaPdf, normalizarNomeArquivo } from "./conversao/conversor";
import { baixarArquivo, enviarPdf } from "./storage/minio-client";

interface ConversaoDocumentoJob {
  documentoId: string;
  planoId: string;
  storageKey: string;
  mimeType: string;
  fileName: string;
}

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

const worker = new Worker<ConversaoDocumentoJob>(
  "documentos-conversao",
  async (job) => {
    const { documentoId, storageKey, fileName } = job.data;
    const db = getDb();

    const pastaTemp = await mkdtemp(join(tmpdir(), "doc-conversao-"));
    const nomeSeguro = normalizarNomeArquivo(fileName, `${documentoId}.docx`);
    const caminhoEntrada = join(pastaTemp, nomeSeguro);

    try {
      await baixarArquivo(storageKey, caminhoEntrada);
      const caminhoPdf = await converterDocParaPdf(caminhoEntrada, pastaTemp);
      const preview = await enviarPdf(caminhoPdf);

      await db
        .update(planoDocumento)
        .set({
          previewKey: preview.key,
          previewUrl: preview.url,
          previewMimeType: "application/pdf",
          previewStatus: "PRONTO",
          previewError: null,
          updatedAt: new Date(),
        })
        .where(eq(planoDocumento.id, documentoId));
    } catch (error) {
      await db
        .update(planoDocumento)
        .set({
          previewStatus: "ERRO",
          previewError: error instanceof Error ? error.message : String(error),
          updatedAt: new Date(),
        })
        .where(eq(planoDocumento.id, documentoId));

      throw error;
    } finally {
      await rm(pastaTemp, { recursive: true, force: true });
    }
  },
  {
    connection: { url: redisUrl },
    concurrency: 2,
  },
);

worker.on("completed", (job) => {
  console.log(`[worker] Documento convertido: ${job.data.documentoId}`);
});

worker.on("failed", (job, err) => {
  if (!job) return;
  console.error(
    `[worker] Falha ao converter documento ${job.data.documentoId}: ${err.message}`,
  );
});

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
