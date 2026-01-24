import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DocumentosConversaoQueueService } from "./documentos-conversao.queue";

/**
 * Módulo de fila de conversão de documentos
 */
@Module({
  imports: [ConfigModule],
  providers: [DocumentosConversaoQueueService],
  exports: [DocumentosConversaoQueueService],
})
export class DocumentosConversaoModule {}
