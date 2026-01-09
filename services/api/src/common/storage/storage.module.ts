import { DynamicModule, Logger, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthModule } from "../../modules/auth/auth.module";
import { StorageController } from "./storage.controller";
import { StorageService } from "./storage.service";

/**
 * StorageModule - Módulo condicional para upload de arquivos via MinIO/S3
 *
 * Este módulo só é ativado quando as variáveis de ambiente do MinIO estão configuradas:
 * - MINIO_ENDPOINT
 * - MINIO_ACCESS_KEY
 * - MINIO_SECRET_KEY
 * - MINIO_BUCKET
 *
 * Se não configurado, o módulo é carregado vazio e as rotas de upload não ficam disponíveis.
 */
@Module({})
export class StorageModule {
  private static readonly logger = new Logger(StorageModule.name);

  static forRoot(): DynamicModule {
    // Check if MinIO is configured via environment variables
    const isMinioConfigured =
      process.env.MINIO_ENDPOINT &&
      process.env.MINIO_ACCESS_KEY &&
      process.env.MINIO_SECRET_KEY &&
      process.env.MINIO_BUCKET;

    if (!isMinioConfigured) {
      this.logger.warn(
        "MinIO not configured. Storage module disabled. Set MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, and MINIO_BUCKET to enable file uploads.",
      );
      return {
        module: StorageModule,
        imports: [],
        controllers: [],
        providers: [],
        exports: [],
      };
    }

    this.logger.log("MinIO configured. Storage module enabled.");
    return {
      module: StorageModule,
      imports: [ConfigModule, AuthModule],
      controllers: [StorageController],
      providers: [StorageService],
      exports: [StorageService],
    };
  }
}
