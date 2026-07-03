import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../common/database/database.module";
import { StorageModule } from "../../common/storage/storage.module";
import { AuthModule } from "../auth/auth.module";
import { WorkflowsAnexosService } from "./workflows-anexos.service";
import { WorkflowsCategoriasService } from "./workflows-categorias.service";
import { WorkflowsController } from "./workflows.controller";
import { WorkflowsExecucoesService } from "./workflows-execucoes.service";
import { WorkflowsHistoricoService } from "./workflows-historico.service";
import { WorkflowsModelosService } from "./workflows-modelos.service";

@Module({
  imports: [AuthModule, DatabaseModule, StorageModule.forRoot()],
  controllers: [WorkflowsController],
  providers: [
    WorkflowsCategoriasService,
    WorkflowsModelosService,
    WorkflowsExecucoesService,
    WorkflowsAnexosService,
    WorkflowsHistoricoService,
  ],
  exports: [
    WorkflowsCategoriasService,
    WorkflowsModelosService,
    WorkflowsExecucoesService,
  ],
})
export class WorkflowsModule {}
