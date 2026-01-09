import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";

import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { StagesService } from "./stages.service";

/**
 * Controller para gerenciamento de etapas educacionais.
 *
 * Endpoints globais (todas as etapas):
 * - GET /stages - Lista todas as etapas globais
 *
 * Endpoints por unidade:
 * - GET /units/:unitId/stages - Lista etapas atribuidas a uma unidade
 * - POST /units/:unitId/stages - Atribui etapas a uma unidade (Master only)
 * - PUT /units/:unitId/stages - Substitui todas as etapas de uma unidade (Master only)
 * - DELETE /units/:unitId/stages/:stageId - Remove etapa de uma unidade (Master only)
 */
@Controller()
@UseGuards(AuthGuard)
export class StagesController {
  constructor(private readonly stagesService: StagesService) {}

  /**
   * Lista todas as etapas globais (tabela de referencia).
   * Disponivel para todos os usuarios autenticados.
   */
  @Get("stages")
  async findAll() {
    const stages = await this.stagesService.findAll();
    return {
      success: true,
      data: stages,
    };
  }

  /**
   * Lista as etapas atribuidas a uma unidade especifica.
   * Requer autenticacao e respeita isolamento de tenant.
   */
  @Get("units/:unitId/stages")
  @UseGuards(TenantGuard)
  async findByUnit(@Param("unitId") unitId: string) {
    const stages = await this.stagesService.findByUnit(unitId);
    return {
      success: true,
      data: stages,
    };
  }

  /**
   * Atribui etapas a uma unidade (adiciona as existentes).
   * Apenas Master pode executar esta operacao.
   */
  @Post("units/:unitId/stages")
  @UseGuards(RolesGuard, TenantGuard)
  @Roles("master")
  async assignToUnit(
    @Param("unitId") unitId: string,
    @Body() body: { stageIds: string[] },
  ) {
    const unitStages = await this.stagesService.assignToUnit(
      unitId,
      body.stageIds,
    );
    return {
      success: true,
      data: unitStages,
    };
  }

  /**
   * Substitui todas as etapas de uma unidade.
   * Remove as antigas e adiciona as novas.
   * Apenas Master pode executar esta operacao.
   */
  @Put("units/:unitId/stages")
  @UseGuards(RolesGuard, TenantGuard)
  @Roles("master")
  async replaceUnitStages(
    @Param("unitId") unitId: string,
    @Body() body: { stageIds: string[] },
  ) {
    const unitStages = await this.stagesService.replaceUnitStages(
      unitId,
      body.stageIds,
    );
    return {
      success: true,
      data: unitStages,
    };
  }

  /**
   * Remove uma etapa de uma unidade (soft delete).
   * Apenas Master pode executar esta operacao.
   */
  @Delete("units/:unitId/stages/:stageId")
  @UseGuards(RolesGuard, TenantGuard)
  @Roles("master")
  async removeFromUnit(
    @Param("unitId") unitId: string,
    @Param("stageId") stageId: string,
  ) {
    await this.stagesService.removeFromUnit(unitId, stageId);
    return {
      success: true,
      data: null,
    };
  }
}
