import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../../common/database/database.module";
import { TarefasController } from "./tarefas.controller";
import { TarefasService } from "./tarefas.service";
import { TarefasEventosService } from "./tarefas-eventos.service";

/**
 * TarefasModule
 *
 * Módulo responsável pelo gerenciamento de tarefas:
 * - Criação manual e automática (via eventos)
 * - Contextos estruturados (quinzena, etapa, turma, professora)
 * - Filtros avançados e dashboard
 * - Integração com workflow de planejamento
 */
@Module({
  imports: [AuthModule, DatabaseModule, EventEmitterModule],
  controllers: [TarefasController],
  providers: [TarefasService, TarefasEventosService],
  exports: [TarefasService],
})
export class TarefasModule {}
