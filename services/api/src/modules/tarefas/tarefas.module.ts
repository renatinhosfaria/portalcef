import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../../common/database/database.module";
import { TarefasController } from "./tarefas.controller";
import { TarefasService } from "./tarefas.service";

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
  imports: [AuthModule, DatabaseModule],
  controllers: [TarefasController],
  providers: [TarefasService],
  exports: [TarefasService],
})
export class TarefasModule {}
