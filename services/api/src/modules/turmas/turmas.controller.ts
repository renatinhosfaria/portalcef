import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { createTurmaSchema, updateTurmaSchema } from "@essencia/shared/schemas";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { TurmasService } from "./turmas.service";

/**
 * Controller para gerenciamento de turmas.
 *
 * Acesso permitido: master, diretora_geral, gerente_unidade, gerente_financeiro
 */
@Controller()
@UseGuards(AuthGuard)
export class TurmasController {
  constructor(private readonly turmasService: TurmasService) {}

  /**
   * Lista todas as turmas com filtros opcionais
   *
   * Tenant filtering:
   * - master: vê todas as turmas (sem filtro de escola)
   * - diretora_geral: vê turmas da sua escola
   * - outros roles: vê turmas da sua unidade (devem passar unitId)
   */
  @Get("turmas")
  @UseGuards(RolesGuard)
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  async findAll(
    @CurrentUser()
    user: {
      userId: string;
      role: string;
      schoolId: string;
      unitId: string | null;
      stageId: string | null;
    },
    @Query("unitId") unitId?: string,
    @Query("stageId") stageId?: string,
    @Query("year") year?: string,
  ) {
    const turmas = await this.turmasService.findAll({
      // Master vê tudo, diretora_geral vê apenas sua escola
      schoolId: user.role === "master" ? undefined : user.schoolId,
      unitId,
      stageId,
      year: year ? parseInt(year, 10) : undefined,
    });

    return {
      success: true,
      data: turmas,
    };
  }

  /**
   * Busca turma por ID
   */
  @Get("turmas/:id")
  @UseGuards(RolesGuard)
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  async findById(@Param("id") id: string) {
    const turma = await this.turmasService.findById(id);

    if (!turma) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Turma não encontrada",
        },
      };
    }

    return {
      success: true,
      data: turma,
    };
  }

  /**
   * Lista turmas de uma unidade específica
   */
  @Get("units/:unitId/turmas")
  @UseGuards(TenantGuard, RolesGuard)
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  async findByUnit(
    @Param("unitId") unitId: string,
    @Query("year") year?: string,
  ) {
    const turmas = await this.turmasService.findByUnit(
      unitId,
      year ? parseInt(year, 10) : undefined,
    );

    return {
      success: true,
      data: turmas,
    };
  }

  /**
   * Cria nova turma
   */
  @Post("turmas")
  @UseGuards(RolesGuard, TenantGuard)
  @Roles("master", "diretora_geral", "gerente_unidade")
  async create(@Body() body: unknown) {
    const result = createTurmaSchema.safeParse(body);

    if (!result.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Dados inválidos",
          details: result.error.flatten(),
        },
      };
    }

    const turma = await this.turmasService.create(result.data);

    return {
      success: true,
      data: turma,
    };
  }

  /**
   * Atualiza turma
   */
  @Put("turmas/:id")
  @UseGuards(RolesGuard, TenantGuard)
  @Roles("master", "diretora_geral", "gerente_unidade")
  async update(@Param("id") id: string, @Body() body: unknown) {
    const result = updateTurmaSchema.safeParse(body);

    if (!result.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Dados inválidos",
          details: result.error.flatten(),
        },
      };
    }

    const turma = await this.turmasService.update(id, result.data);

    return {
      success: true,
      data: turma,
    };
  }

  /**
   * Exclui turma permanentemente do banco de dados
   */
  @Delete("turmas/:id")
  @UseGuards(RolesGuard, TenantGuard)
  @Roles("master", "diretora_geral", "gerente_unidade")
  async delete(@Param("id") id: string) {
    await this.turmasService.delete(id);

    return {
      success: true,
      data: null,
    };
  }

  /**
   * Atribui ou altera professora titular da turma
   */
  @Put("turmas/:id/professora")
  @UseGuards(RolesGuard, TenantGuard)
  @Roles("master", "diretora_geral", "gerente_unidade", "coordenadora_geral")
  async assignProfessora(
    @Param("id") turmaId: string,
    @Body() body: { professoraId: string },
  ) {
    const turma = await this.turmasService.assignProfessora(
      turmaId,
      body.professoraId,
    );

    return {
      success: true,
      data: turma,
    };
  }

  /**
   * Remove professora titular da turma
   */
  @Delete("turmas/:id/professora")
  @UseGuards(RolesGuard, TenantGuard)
  @Roles("master", "diretora_geral", "gerente_unidade", "coordenadora_geral")
  async removeProfessora(@Param("id") turmaId: string) {
    const turma = await this.turmasService.removeProfessora(turmaId);

    return {
      success: true,
      data: turma,
    };
  }

  /**
   * Lista professoras disponíveis para atribuição a uma turma
   * (professoras da mesma unidade e etapa)
   */
  @Get("turmas/:id/professoras-disponiveis")
  @UseGuards(RolesGuard, TenantGuard)
  @Roles("master", "diretora_geral", "gerente_unidade", "coordenadora_geral")
  async findAvailableProfessoras(@Param("id") turmaId: string) {
    const professoras =
      await this.turmasService.findAvailableProfessoras(turmaId);

    return {
      success: true,
      data: professoras,
    };
  }
}
