import { Module } from "@nestjs/common";

import { SharePointModule } from "../../common/sharepoint/sharepoint.module";
import { StorageModule } from "../../common/storage/storage.module";
import { AuthModule } from "../auth/auth.module";
import { PlanejamentoObservabilidadeProvidersModule } from "../planejamento-observabilidade/planejamento-observabilidade.module";
import { RelatorioController } from "./relatorio.controller";
import { RelatorioHistoricoService } from "./relatorio-historico.service";
import { RelatorioPdfQueueService } from "./relatorio-pdf-queue.service";
import { RelatorioPdfWorkerService } from "./relatorio-pdf-worker.service";
import { RelatorioService } from "./relatorio.service";

@Module({
  imports: [
    AuthModule,
    StorageModule.forRoot(),
    SharePointModule,
    PlanejamentoObservabilidadeProvidersModule,
  ],
  controllers: [RelatorioController],
  providers: [
    RelatorioService,
    RelatorioHistoricoService,
    RelatorioPdfQueueService,
    RelatorioPdfWorkerService,
  ],
  exports: [RelatorioService],
})
export class RelatorioModule {}
