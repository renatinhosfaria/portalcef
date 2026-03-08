import { Module } from "@nestjs/common";

import { DocumentosConversaoModule } from "../../common/queues/documentos-conversao.module";
import { StorageModule } from "../../common/storage/storage.module";
import { AuthModule } from "../auth/auth.module";
import { ProvaController } from "./prova.controller";
import { ProvaHistoricoService } from "./prova-historico.service";
import { ProvaService } from "./prova.service";

/**
 * ProvaModule
 *
 * Módulo responsável pelo workflow de provas:
 * - Professora cria e submete provas
 * - Analista revisa e aprova/devolve
 * - Coordenadora aprova final ou devolve
 * - Gestão visualiza dashboard
 */
@Module({
  imports: [AuthModule, StorageModule.forRoot(), DocumentosConversaoModule],
  controllers: [ProvaController],
  providers: [ProvaService, ProvaHistoricoService],
  exports: [ProvaService],
})
export class ProvaModule {}
