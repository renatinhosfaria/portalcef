import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue, type ConnectionOptions } from "bullmq";
import Redis from "ioredis";
import { randomUUID } from "node:crypto";

export const PLANEJAMENTO_PDF_QUEUE_NAME = "planejamento-pdf-impressao";
export const PLANEJAMENTO_PDF_JOB_NAME = "gerar-pdf";

export interface PlanoAulaPdfJobData {
  documentoId: string;
}

@Injectable()
export class PlanoAulaPdfQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(PlanoAulaPdfQueueService.name);
  private readonly connection: Redis;
  private readonly queue: Queue<
    PlanoAulaPdfJobData,
    void,
    typeof PLANEJAMENTO_PDF_JOB_NAME
  >;

  constructor(private readonly configService: ConfigService) {
    const redisUrl =
      this.configService.get<string>("REDIS_URL") ?? "redis://localhost:6379";

    this.connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue<
      PlanoAulaPdfJobData,
      void,
      typeof PLANEJAMENTO_PDF_JOB_NAME
    >(PLANEJAMENTO_PDF_QUEUE_NAME, {
      connection: this.connection as unknown as ConnectionOptions,
    });
  }

  async adicionar(documentoId: string): Promise<void> {
    try {
      await this.queue.add(
        PLANEJAMENTO_PDF_JOB_NAME,
        { documentoId },
        {
          jobId: `plano-documento-${documentoId}-${randomUUID()}`,
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
