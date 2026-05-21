import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { AuthModule } from "../auth/auth.module";
import { PlanejamentoObservabilidadeController } from "./planejamento-observabilidade.controller";
import { PlanejamentoObservabilidadeInterceptor } from "./planejamento-observabilidade.interceptor";
import {
  PLANEJAMENTO_OBSERVABILIDADE_CONFIG,
  PlanejamentoObservabilidadeService,
} from "./planejamento-observabilidade.service";

function obterSlowMsConfigurado(): number | undefined {
  const valor = Number(process.env.PLANEJAMENTO_OBSERVABILIDADE_SLOW_MS);

  return Number.isFinite(valor) && valor > 0 ? valor : undefined;
}

@Module({
  providers: [
    {
      provide: PLANEJAMENTO_OBSERVABILIDADE_CONFIG,
      useFactory: () => ({
        slowMs: obterSlowMsConfigurado(),
      }),
    },
    PlanejamentoObservabilidadeService,
  ],
  exports: [PlanejamentoObservabilidadeService],
})
export class PlanejamentoObservabilidadeProvidersModule {}

@Module({
  imports: [AuthModule, PlanejamentoObservabilidadeProvidersModule],
  controllers: [PlanejamentoObservabilidadeController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: PlanejamentoObservabilidadeInterceptor,
    },
  ],
  exports: [PlanejamentoObservabilidadeProvidersModule],
})
export class PlanejamentoObservabilidadeModule {}
