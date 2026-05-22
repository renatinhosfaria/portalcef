import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Worker, type ConnectionOptions, type Job } from "bullmq";
import Redis from "ioredis";

import { PdfGeneratorService } from "../../common/sharepoint/pdf-generator.service";
import {
  RELATORIO_PDF_JOB_NAME,
  RELATORIO_PDF_QUEUE_NAME,
  type RelatorioPdfJobData,
} from "./relatorio-pdf-queue.service";

export interface IRelatorioServicePdf {
  processarPdfDocumento(
    documentoId: string,
    pdfGeneratorService: PdfGeneratorService,
  ): Promise<void>;
}

@Injectable()
export class RelatorioPdfWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(RelatorioPdfWorkerService.name);
  private readonly connection: Redis;
  private readonly worker: Worker<
    RelatorioPdfJobData,
    void,
    typeof RELATORIO_PDF_JOB_NAME
  >;

  constructor(
    private readonly configService: ConfigService,
    private readonly relatorioService: IRelatorioServicePdf,
    private readonly pdfGeneratorService: PdfGeneratorService,
  ) {
    const redisUrl =
      this.configService.get<string>("REDIS_URL") ?? "redis://localhost:6379";

    this.connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    this.worker = new Worker<
      RelatorioPdfJobData,
      void,
      typeof RELATORIO_PDF_JOB_NAME
    >(
      RELATORIO_PDF_QUEUE_NAME,
      async (job: Job<RelatorioPdfJobData>) => {
        await this.processarDocumento(job.data.documentoId);
      },
      {
        connection: this.connection as unknown as ConnectionOptions,
        concurrency: 2,
      },
    );

    this.worker.on("failed", (job, err) => {
      this.logger.error(`Job ${job?.id} falhou: ${err.message}`);
    });
  }

  private async processarDocumento(documentoId: string): Promise<void> {
    this.logger.log(`Gerando PDF para documento ${documentoId}`);
    await this.relatorioService.processarPdfDocumento(
      documentoId,
      this.pdfGeneratorService,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.connection.quit();
  }
}
