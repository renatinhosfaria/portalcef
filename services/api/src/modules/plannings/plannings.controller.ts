import { Controller, Get, Req, UseGuards } from "@nestjs/common";

import { Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import {
  PlanningsService,
  type UserContext,
} from "./plannings.service";

/**
 * Controller legado mantido apenas para a consulta de turmas usada pelo app.
 * Os fluxos de plano de aula foram migrados para os módulos `plano-aula` e
 * `plano-aula-periodo`.
 */
@Controller("plannings")
export class PlanningsController {
  constructor(private readonly planningsService: PlanningsService) {}

  /**
   * Lista turmas disponíveis para o usuário.
   */
  @Get("turmas")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("professora", "auxiliar_sala")
  async getTurmas(@Req() req: { user: UserContext }) {
    return this.planningsService.getTurmas(req.user);
  }
}
