import { Module } from "@nestjs/common";

import { DocumentosConversaoModule } from "../../common/queues/documentos-conversao.module";
import { StorageModule } from "../../common/storage/storage.module";
import { AuthModule } from "../auth/auth.module";
import { PlanoAulaController } from "./plano-aula.controller";
import { PlanoAulaHistoricoService } from "./plano-aula-historico.service";
import { PlanoAulaService } from "./plano-aula.service";

/**
 * PlanoAulaModule
 *
 * Módulo responsável pelo workflow de planos de aula:
 * - Professora cria e submete planos
 * - Analista revisa e aprova/devolve
 * - Coordenadora aprova final ou devolve
 * - Gestão visualiza dashboard e define deadlines
 */
@Module({
  imports: [AuthModule, StorageModule.forRoot(), DocumentosConversaoModule],
  controllers: [PlanoAulaController],
  providers: [PlanoAulaService, PlanoAulaHistoricoService],
  exports: [PlanoAulaService],
})
export class PlanoAulaModule {}
