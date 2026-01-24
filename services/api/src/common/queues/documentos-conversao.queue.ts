import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";

/**
 * Job de conversão de documento
 */
export interface ConversaoDocumentoJob {
  documentoId: string;
  planoId: string;
  storageKey: string;
  mimeType: string;
  fileName: string;
}

/**
 * Serviço de fila para conversão assíncrona de documentos
 * Enfileira jobs no BullMQ para serem processados pelo worker
 */
@Injectable()
export class DocumentosConversaoQueueService implements OnModuleDestroy {
  private queue: Queue<ConversaoDocumentoJob>;

  constructor(private configService: ConfigService) {
    const redisUrl =
      this.configService.get<string>("REDIS_URL") ?? "redis://localhost:6379";

    this.queue = new Queue<ConversaoDocumentoJob>("documentos-conversao", {
      connection: { url: redisUrl },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    });
  }

  /**
   * Enfileira um documento para conversão
   */
  async enfileirar(payload: ConversaoDocumentoJob) {
    return this.queue.add("converter", payload);
  }

  /**
   * Limpa a conexão ao destruir o módulo
   */
  async onModuleDestroy() {
    await this.queue.close();
  }
}
