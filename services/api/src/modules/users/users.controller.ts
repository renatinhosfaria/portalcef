import { createUserSchema, updateUserSchema } from "@essencia/shared/schemas";
import { canViewRole } from "@essencia/shared/roles";
import { stageRequiredRoles } from "@essencia/shared/types";
import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { SchoolsService } from "../schools/schools.service";
import { UnitsService } from "../units/units.service";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
export class UsersController {
  constructor(
    private usersService: UsersService,
    private schoolsService: SchoolsService,
    private unitsService: UnitsService,
  ) {}

  @Get()
  @Roles(
    "master",
    "diretora_geral",
    "gerente_unidade",
    "gerente_financeiro",
    "coordenadora_geral",
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_medio",
    "analista_pedagogico",
    "professora",
    "auxiliar_sala",
  )
  async findAll(
    @CurrentUser()
    currentUser: {
      userId: string;
      role: string;
      schoolId: string;
      unitId: string;
      stageId: string | null;
    },
    @Query("inativos") inativos?: string,
  ) {
    const incluirInativos = inativos === "true";
    const users = await this.usersService.findAllByTenant(
      currentUser,
      incluirInativos,
    );

    // Batch fetch schools and units to resolve names
    const schoolIds = Array.from(
      new Set(users.map((u) => u.schoolId).filter(Boolean)),
    ) as string[];
    const unitIds = Array.from(
      new Set(users.map((u) => u.unitId).filter(Boolean)),
    ) as string[];

    const schools = schoolIds.length
      ? await this.schoolsService.findByIds(schoolIds)
      : [];
    const units = unitIds.length
      ? await this.unitsService.findByIds(unitIds)
      : [];

    const schoolMap = Object.fromEntries(schools.map((s) => [s.id, s.name]));
    const unitMap = Object.fromEntries(units.map((u) => [u.id, u.name]));

    const data = users.map((u) => ({
      ...u,
      schoolName: u.schoolId ? (schoolMap[u.schoolId] ?? null) : null,
      unitName: u.unitId ? (unitMap[u.unitId] ?? null) : null,
    }));

    return {
      success: true,
      data,
    };
  }

  @Get("buscar")
  @Roles(
    "master",
    "diretora_geral",
    "gerente_unidade",
    "coordenadora_geral",
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_medio",
    "analista_pedagogico",
    "professora",
    "auxiliar_sala",
  )
  async buscarParaAtribuicao(
    @CurrentUser()
    currentUser: {
      userId: string;
      role: string;
      schoolId: string;
      unitId: string;
      stageId: string | null;
    },
    @Query("busca") busca?: string,
    @Query("roles") rolesParam?: string,
  ) {
    if (!currentUser.schoolId) {
      throw new ForbiddenException("Escola não encontrada");
    }
    const roles = rolesParam ? rolesParam.split(",") : undefined;
    const resultado = await this.usersService.buscarParaAtribuicao({
      schoolId: currentUser.schoolId,
      busca,
      roles,
    });
    return { success: true, data: resultado };
  }

  @Get(":id")
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  async findById(
    @Param("id") id: string,
    @CurrentUser()
    currentUser: {
      userId: string;
      role: string;
      schoolId: string;
      unitId: string;
      stageId: string | null;
    },
  ) {
    const user = await this.usersService.findById(id);

    if (!user) {
      throw new NotFoundException("Usuario nao encontrado");
    }

    // Verify user can access this user
    if (currentUser.role !== "master") {
      if (user.schoolId !== currentUser.schoolId) {
        throw new ForbiddenException("Acesso negado");
      }
      // Non-diretora can only see users in their unit
      if (
        currentUser.role !== "diretora_geral" &&
        user.unitId !== currentUser.unitId
      ) {
        throw new ForbiddenException("Acesso negado");
      }
      // Stage-scoped roles can only see users in their stage
      if (
        stageRequiredRoles.includes(
          currentUser.role as (typeof stageRequiredRoles)[number],
        ) &&
        user.stageId !== currentUser.stageId
      ) {
        throw new ForbiddenException("Acesso negado");
      }
    }

    // Hierarchy validation: can only view users with equal or lower privilege
    if (!canViewRole(currentUser.role, user.role)) {
      throw new ForbiddenException(
        "Acesso negado - usuário de maior privilégio",
      );
    }

    // Enrich with school/unit names
    let schoolName: string | null = null;
    let unitName: string | null = null;
    if (user.schoolId) {
      const s = await this.schoolsService.findById(user.schoolId);
      schoolName = s?.name ?? null;
    }
    if (user.unitId) {
      const u = await this.unitsService.findById(user.unitId);
      unitName = u?.name ?? null;
    }

    return {
      success: true,
      data: { ...user, schoolName, unitName },
    };
  }

  @Post()
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  async create(
    @Body() body: unknown,
    @CurrentUser()
    currentUser: {
      userId: string;
      role: string;
      schoolId: string;
      unitId: string;
      stageId: string | null;
    },
  ) {
    const result = createUserSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dados invalidos",
        details: result.error.flatten(),
      });
    }

    // Verify user can create users in this school/unit
    if (
      currentUser.role !== "master" &&
      result.data.schoolId !== currentUser.schoolId
    ) {
      throw new ForbiddenException("Acesso negado - escola diferente");
    }

    // Gerente can only create users in their unit
    if (
      currentUser.role !== "master" &&
      currentUser.role !== "diretora_geral" &&
      result.data.unitId !== currentUser.unitId
    ) {
      throw new ForbiddenException("Acesso negado - unidade diferente");
    }

    // Stage-scoped roles can only create users in their stage
    if (
      stageRequiredRoles.includes(
        currentUser.role as (typeof stageRequiredRoles)[number],
      ) &&
      result.data.stageId !== currentUser.stageId
    ) {
      throw new ForbiddenException("Acesso negado - etapa diferente");
    }

    const user = await this.usersService.create(result.data, currentUser);
    return {
      success: true,
      data: user,
    };
  }

  @Put(":id")
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  async update(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser()
    currentUser: {
      userId: string;
      role: string;
      schoolId: string;
      unitId: string;
      stageId: string | null;
    },
  ) {
    // Verify user exists and belongs to user's scope
    const existingUser = await this.usersService.findById(id);
    if (!existingUser) {
      throw new NotFoundException("Usuario nao encontrado");
    }

    if (
      currentUser.role !== "master" &&
      existingUser.schoolId !== currentUser.schoolId
    ) {
      throw new ForbiddenException("Acesso negado");
    }

    // Non-diretora can only update users in their unit
    if (
      currentUser.role !== "master" &&
      currentUser.role !== "diretora_geral" &&
      existingUser.unitId !== currentUser.unitId
    ) {
      throw new ForbiddenException("Acesso negado");
    }

    // Stage-scoped roles can only update users in their stage
    if (
      stageRequiredRoles.includes(
        currentUser.role as (typeof stageRequiredRoles)[number],
      ) &&
      existingUser.stageId !== currentUser.stageId
    ) {
      throw new ForbiddenException("Acesso negado");
    }

    const result = updateUserSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dados invalidos",
        details: result.error.flatten(),
      });
    }

    // Non-diretora geral cannot change unitId (only block if actually changing to a different unit)
    if (
      currentUser.role !== "master" &&
      currentUser.role !== "diretora_geral" &&
      result.data.unitId &&
      result.data.unitId !== existingUser.unitId
    ) {
      throw new ForbiddenException(
        "Apenas diretora geral ou master pode transferir usuarios entre unidades",
      );
    }

    // Stage-scoped roles cannot change stageId (only block if actually changing to a different stage)
    if (
      stageRequiredRoles.includes(
        currentUser.role as (typeof stageRequiredRoles)[number],
      ) &&
      result.data.stageId &&
      result.data.stageId !== existingUser.stageId
    ) {
      throw new ForbiddenException(
        "Apenas diretora geral ou master pode transferir usuarios entre etapas",
      );
    }

    const user = await this.usersService.update(id, result.data, currentUser);
    return {
      success: true,
      data: user,
    };
  }

  @Delete(":id")
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param("id") id: string,
    @CurrentUser()
    currentUser: {
      userId: string;
      role: string;
      schoolId: string;
      unitId: string;
      stageId: string | null;
    },
  ) {
    // Verify user exists and belongs to user's scope
    const existingUser = await this.usersService.findById(id);
    if (!existingUser) {
      throw new NotFoundException("Usuario nao encontrado");
    }

    if (
      currentUser.role !== "master" &&
      existingUser.schoolId !== currentUser.schoolId
    ) {
      throw new ForbiddenException("Acesso negado");
    }

    // Non-diretora can only delete users in their unit
    if (
      currentUser.role !== "master" &&
      currentUser.role !== "diretora_geral" &&
      existingUser.unitId !== currentUser.unitId
    ) {
      throw new ForbiddenException("Acesso negado");
    }

    // Stage-scoped roles can only delete users in their stage
    if (
      stageRequiredRoles.includes(
        currentUser.role as (typeof stageRequiredRoles)[number],
      ) &&
      existingUser.stageId !== currentUser.stageId
    ) {
      throw new ForbiddenException("Acesso negado");
    }

    // Cannot delete yourself
    if (id === currentUser.userId) {
      throw new ForbiddenException("Nao pode deletar seu proprio usuario");
    }

    await this.usersService.delete(id, currentUser);
    return {
      success: true,
      data: null,
    };
  }

  @Put(":id/inativar")
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  @HttpCode(HttpStatus.OK)
  async inativar(
    @Param("id") id: string,
    @CurrentUser()
    currentUser: {
      userId: string;
      role: string;
      schoolId: string;
      unitId: string;
      stageId: string | null;
    },
  ) {
    await this.checkTenantScope(id, currentUser);

    const user = await this.usersService.inativar(id, currentUser);
    return {
      success: true,
      data: user,
    };
  }

  @Put(":id/reativar")
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  @HttpCode(HttpStatus.OK)
  async reativar(
    @Param("id") id: string,
    @CurrentUser()
    currentUser: {
      userId: string;
      role: string;
      schoolId: string;
      unitId: string;
      stageId: string | null;
    },
  ) {
    await this.checkTenantScope(id, currentUser);

    const user = await this.usersService.reativar(id, currentUser);
    return {
      success: true,
      data: user,
    };
  }

  /**
   * Verifica que o usuário-alvo (id) pertence ao escopo de tenant do ator.
   * Reproduz o mesmo padrão usado em update/delete.
   * Lança uma exceção HTTP quando houver violação.
   */
  private async checkTenantScope(
    targetId: string,
    currentUser: {
      userId: string;
      role: string;
      schoolId: string;
      unitId: string;
      stageId: string | null;
    },
  ): Promise<void> {
    const target = await this.usersService.findById(targetId);
    if (!target) {
      throw new NotFoundException("Usuario nao encontrado");
    }

    if (
      currentUser.role !== "master" &&
      target.schoolId !== currentUser.schoolId
    ) {
      throw new ForbiddenException("Acesso negado");
    }

    if (
      currentUser.role !== "master" &&
      currentUser.role !== "diretora_geral" &&
      target.unitId !== currentUser.unitId
    ) {
      throw new ForbiddenException("Acesso negado");
    }

    if (
      stageRequiredRoles.includes(
        currentUser.role as (typeof stageRequiredRoles)[number],
      ) &&
      target.stageId !== currentUser.stageId
    ) {
      throw new ForbiddenException("Acesso negado");
    }
  }
}
