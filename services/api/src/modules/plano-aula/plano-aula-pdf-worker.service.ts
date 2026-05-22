import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Worker, type ConnectionOptions, type Job } from "bullmq";
import Redis from "ioredis";

import { PdfGeneratorService } from "../../common/sharepoint/pdf-generator.service";
import {
  PLANEJAMENTO_PDF_JOB_NAME,
  PLANEJAMENTO_PDF_QUEUE_NAME,
  type PlanoAulaPdfJobData,
} from "./plano-aula-pdf-queue.service";
import { PlanoAulaService } from "./plano-aula.service";

@Injectable()
export class PlanoAulaPdfWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(PlanoAulaPdfWorkerService.name);
  private readonly connection: Redis;
  private readonly worker: Worker<
    PlanoAulaPdfJobData,
    void,
    typeof PLANEJAMENTO_PDF_JOB_NAME
  >;

  constructor(
    private readonly configService: ConfigService,
    private readonly planoAulaService: PlanoAulaService,
    private readonly pdfGeneratorService: PdfGeneratorService,
  ) {
    const redisUrl =
      this.configService.get<string>("REDIS_URL") ?? "redis://localhost:6379";

    this.connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    this.worker = new Worker<
      PlanoAulaPdfJobData,
      void,
      typeof PLANEJAMENTO_PDF_JOB_NAME
    >(
      PLANEJAMENTO_PDF_QUEUE_NAME,
      async (job: Job<PlanoAulaPdfJobData>) => {
        await this.processarDocumento(job.data.documentoId);
      },
      {
        connection: this.connection as unknown as ConnectionOptions,
        concurrency: this.carregarConcorrencia(),
      },
    );

    this.worker.on("failed", (job, error) => {
      this.logger.error(
        `Job de PDF do planejamento falhou (${job?.id ?? "sem-id"}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }

  async processarDocumento(documentoId: string): Promise<void> {
    const documento =
      await this.planoAulaService.buscarDocumentoParaPdf(documentoId);

    if (!documento || !documento.approvedAt || !documento.approvedBy) {
      return;
    }

    if (
      documento.pdfStatus !== "PENDENTE" &&
      documento.pdfStatus !== "ERRO"
    ) {
      return;
    }

    await this.planoAulaService.marcarPdfGerando(documentoId);

    try {
      const pdf = await this.pdfGeneratorService.gerarParaImpressao({
        id: documento.id,
        storageKey: documento.storageKey,
        url: documento.url,
        fileName: documento.fileName,
        mimeType: documento.mimeType,
        sharepointItemId: documento.sharepointItemId,
        sharepointEditUrl: documento.sharepointEditUrl,
        editandoDesde: documento.editandoDesde,
      });

      if (!pdf) {
        throw new Error(
          `PDF de impressão não gerado para documento ${documentoId}`,
        );
      }

      await this.planoAulaService.marcarPdfPronto(documentoId, pdf);
    } catch (error) {
      await this.planoAulaService.marcarPdfErro(documentoId, error);
    } finally {
      if (documento.sharepointItemId) {
        await this.planoAulaService.limparEdicaoSharePoint(documentoId);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.connection.quit();
  }

  private carregarConcorrencia(): number {
    const valor = this.configService.get<string>("PLANEJAMENTO_PDF_CONCURRENCY");
    const concorrencia = Number(valor ?? 1);
    return Number.isFinite(concorrencia) && concorrencia > 0
      ? concorrencia
      : 1;
  }
}
