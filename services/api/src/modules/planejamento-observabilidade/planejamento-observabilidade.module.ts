import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { PlanejamentoObservabilidadeController } from "./planejamento-observabilidade.controller";
import { PlanejamentoObservabilidadeService } from "./planejamento-observabilidade.service";

@Module({
  imports: [AuthModule],
  controllers: [PlanejamentoObservabilidadeController],
  providers: [PlanejamentoObservabilidadeService],
  exports: [PlanejamentoObservabilidadeService],
})
export class PlanejamentoObservabilidadeModule {}
