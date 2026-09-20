import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue, type ConnectionOptions } from "bullmq";
import Redis from "ioredis";
import { randomUUID } from "node:crypto";

export const RELATORIO_PDF_QUEUE_NAME = "relatorio-pdf-impressao";
export const RELATORIO_PDF_JOB_NAME = "gerar-pdf-relatorio";

export interface RelatorioPdfJobData {
  documentoId: string;
}

@Injectable()
export class RelatorioPdfQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(RelatorioPdfQueueService.name);
  private readonly connection: Redis;
  private readonly queue: Queue<
    RelatorioPdfJobData,
    void,
    typeof RELATORIO_PDF_JOB_NAME
  >;

  constructor(private readonly configService: ConfigService) {
    const redisUrl =
      this.configService.get<string>("REDIS_URL") ?? "redis://localhost:6379";

    this.connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue<
      RelatorioPdfJobData,
      void,
      typeof RELATORIO_PDF_JOB_NAME
    >(RELATORIO_PDF_QUEUE_NAME, {
      connection: this.connection as unknown as ConnectionOptions,
    });
  }

  async adicionar(documentoId: string): Promise<void> {
    try {
      await this.queue.add(
        RELATORIO_PDF_JOB_NAME,
        { documentoId },
        {
          jobId: `relatorio-documento-${documentoId}-${randomUUID()}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        },
      );
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Falha ao enfileirar PDF do documento ${documentoId}: ${mensagem}`,
      );
      throw error instanceof Error
        ? error
        : new Error("Falha ao enfileirar PDF");
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }
}
