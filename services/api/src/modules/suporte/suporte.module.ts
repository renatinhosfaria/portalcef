import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../../common/database/database.module";
import { StorageModule } from "../../common/storage/storage.module";
import { SuporteController } from "./suporte.controller";
import { SuporteService } from "./suporte.service";

/**
 * SuporteModule
 *
 * Módulo responsável pelo sistema de Ordens de Serviço (OS):
 * - Criação de OS com categoria e descrição
 * - Mensagens com suporte a mídia (imagem, vídeo, áudio)
 * - Alteração de status (ABERTA → EM_ANDAMENTO → RESOLVIDA → FECHADA)
 * - Filtros por status, categoria e usuário
 */
@Module({
  imports: [AuthModule, DatabaseModule, StorageModule.forRoot()],
  controllers: [SuporteController],
  providers: [SuporteService],
  exports: [SuporteService],
})
export class SuporteModule {}
