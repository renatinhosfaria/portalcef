import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { AuthModule } from "../auth/auth.module";
import { PlanejamentoObservabilidadeController } from "./planejamento-observabilidade.controller";
import { PlanejamentoObservabilidadeInterceptor } from "./planejamento-observabilidade.interceptor";
import { PlanejamentoObservabilidadeService } from "./planejamento-observabilidade.service";

@Module({
  imports: [AuthModule],
  controllers: [PlanejamentoObservabilidadeController],
  providers: [
    PlanejamentoObservabilidadeService,
    {
      provide: APP_INTERCEPTOR,
      useClass: PlanejamentoObservabilidadeInterceptor,
    },
  ],
  exports: [PlanejamentoObservabilidadeService],
})
export class PlanejamentoObservabilidadeModule {}
