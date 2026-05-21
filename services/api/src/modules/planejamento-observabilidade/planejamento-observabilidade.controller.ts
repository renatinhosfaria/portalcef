import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";

import {
  AuthGuard,
  type AuthenticatedRequest,
} from "../../common/guards/auth.guard";
import {
  observabilidadeEventosSchema,
  type ObservabilidadeEventosDto,
} from "./dto/observabilidade-evento.dto";
import { PlanejamentoObservabilidadeService } from "./planejamento-observabilidade.service";
import type {
  PlanejamentoObservabilidadeEvento,
  PlanejamentoObservabilidadeNivel,
} from "./planejamento-observabilidade.types";

@Controller("planejamento-observabilidade")
@UseGuards(AuthGuard)
export class PlanejamentoObservabilidadeController {
  constructor(
    private readonly service: PlanejamentoObservabilidadeService,
  ) {}

  @Post("eventos")
  async registrarEventos(
    @Req() req: { user: AuthenticatedRequest["user"] },
    @Body() body: unknown,
  ) {
    const parsed = observabilidadeEventosSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Evento de observabilidade invalido",
        errors: parsed.error.errors,
      });
    }

    await Promise.allSettled(
      parsed.data.eventos.map(async (evento) =>
        this.service.registrarEvento({
          ...evento,
          nivel: this.obterNivel(evento),
          usuario: {
            id: req.user.userId,
            role: req.user.role,
            schoolId: req.user.schoolId,
            unitId: req.user.unitId,
          },
        }),
      ),
    );

    return { success: true };
  }

  private obterNivel(
    evento: ObservabilidadeEventosDto["eventos"][number],
  ): PlanejamentoObservabilidadeNivel {
    if (evento.nivel) {
      return evento.nivel;
    }

    const niveisPadrao: Partial<
      Record<
        PlanejamentoObservabilidadeEvento,
        PlanejamentoObservabilidadeNivel
      >
    > = {
      api_lenta: "warn",
      erro_navegador: "error",
    };

    return niveisPadrao[evento.evento] ?? "info";
  }
}
