import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";

import { SharePointModule } from "../../common/sharepoint/sharepoint.module";
import { StorageModule } from "../../common/storage/storage.module";
import { AuthModule } from "../auth/auth.module";
import { PlanejamentoObservabilidadeProvidersModule } from "../planejamento-observabilidade/planejamento-observabilidade.module";
import { PlanoAulaController } from "./plano-aula.controller";
import { PlanoAulaHistoricoService } from "./plano-aula-historico.service";
import { PlanoAulaPdfQueueService } from "./plano-aula-pdf-queue.service";
import { PlanoAulaPdfWorkerService } from "./plano-aula-pdf-worker.service";
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
  imports: [
    EventEmitterModule,
    AuthModule,
    StorageModule.forRoot(),
    SharePointModule,
    PlanejamentoObservabilidadeProvidersModule,
  ],
  controllers: [PlanoAulaController],
  providers: [
    PlanoAulaService,
    PlanoAulaHistoricoService,
    PlanoAulaPdfQueueService,
    PlanoAulaPdfWorkerService,
  ],
  exports: [PlanoAulaService],
})
export class PlanoAulaModule {}
