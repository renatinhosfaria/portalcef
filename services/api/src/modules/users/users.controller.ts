import { createUserSchema, updateUserSchema } from "@essencia/shared/schemas";
import { canViewRole } from "@essencia/shared/roles";
import { stageRequiredRoles } from "@essencia/shared/types";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
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
  ) {
    const users = await this.usersService.findAllByTenant(currentUser);

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

    // Verify user can access this user
    if (user && currentUser.role !== "master") {
      if (user.schoolId !== currentUser.schoolId) {
        return {
          success: false,
          error: { code: "FORBIDDEN", message: "Acesso negado" },
        };
      }
      // Non-diretora can only see users in their unit
      if (
        currentUser.role !== "diretora_geral" &&
        user.unitId !== currentUser.unitId
      ) {
        return {
          success: false,
          error: { code: "FORBIDDEN", message: "Acesso negado" },
        };
      }
      // Stage-scoped roles can only see users in their stage
      if (
        stageRequiredRoles.includes(
          currentUser.role as (typeof stageRequiredRoles)[number],
        ) &&
        user.stageId !== currentUser.stageId
      ) {
        return {
          success: false,
          error: { code: "FORBIDDEN", message: "Acesso negado" },
        };
      }
    }

    // Hierarchy validation: can only view users with equal or lower privilege
    if (user && !canViewRole(currentUser.role, user.role)) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Acesso negado - usuário de maior privilégio",
        },
      };
    }

    // Enrich with school/unit names
    let schoolName: string | null = null;
    let unitName: string | null = null;
    if (user) {
      if (user.schoolId) {
        const s = await this.schoolsService.findById(user.schoolId);
        schoolName = s?.name ?? null;
      }
      if (user.unitId) {
        const u = await this.unitsService.findById(user.unitId);
        unitName = u?.name ?? null;
      }
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
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Dados invalidos",
          details: result.error.flatten(),
        },
      };
    }

    // Verify user can create users in this school/unit
    if (
      currentUser.role !== "master" &&
      result.data.schoolId !== currentUser.schoolId
    ) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Acesso negado - escola diferente",
        },
      };
    }

    // Gerente can only create users in their unit
    if (
      currentUser.role !== "master" &&
      currentUser.role !== "diretora_geral" &&
      result.data.unitId !== currentUser.unitId
    ) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Acesso negado - unidade diferente",
        },
      };
    }

    // Stage-scoped roles can only create users in their stage
    if (
      stageRequiredRoles.includes(
        currentUser.role as (typeof stageRequiredRoles)[number],
      ) &&
      result.data.stageId !== currentUser.stageId
    ) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Acesso negado - etapa diferente",
        },
      };
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
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Usuario nao encontrado" },
      };
    }

    if (
      currentUser.role !== "master" &&
      existingUser.schoolId !== currentUser.schoolId
    ) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Acesso negado" },
      };
    }

    // Non-diretora can only update users in their unit
    if (
      currentUser.role !== "master" &&
      currentUser.role !== "diretora_geral" &&
      existingUser.unitId !== currentUser.unitId
    ) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Acesso negado" },
      };
    }

    // Stage-scoped roles can only update users in their stage
    if (
      stageRequiredRoles.includes(
        currentUser.role as (typeof stageRequiredRoles)[number],
      ) &&
      existingUser.stageId !== currentUser.stageId
    ) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Acesso negado" },
      };
    }

    const result = updateUserSchema.safeParse(body);
    if (!result.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Dados invalidos",
          details: result.error.flatten(),
        },
      };
    }

    // Non-diretora geral cannot change unitId (only block if actually changing to a different unit)
    if (
      currentUser.role !== "master" &&
      currentUser.role !== "diretora_geral" &&
      result.data.unitId &&
      result.data.unitId !== existingUser.unitId
    ) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message:
            "Apenas diretora geral ou master pode transferir usuarios entre unidades",
        },
      };
    }

    // Stage-scoped roles cannot change stageId (only block if actually changing to a different stage)
    if (
      stageRequiredRoles.includes(
        currentUser.role as (typeof stageRequiredRoles)[number],
      ) &&
      result.data.stageId &&
      result.data.stageId !== existingUser.stageId
    ) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message:
            "Apenas diretora geral ou master pode transferir usuarios entre etapas",
        },
      };
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
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Usuario nao encontrado" },
      };
    }

    if (
      currentUser.role !== "master" &&
      existingUser.schoolId !== currentUser.schoolId
    ) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Acesso negado" },
      };
    }

    // Non-diretora can only delete users in their unit
    if (
      currentUser.role !== "master" &&
      currentUser.role !== "diretora_geral" &&
      existingUser.unitId !== currentUser.unitId
    ) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Acesso negado" },
      };
    }

    // Stage-scoped roles can only delete users in their stage
    if (
      stageRequiredRoles.includes(
        currentUser.role as (typeof stageRequiredRoles)[number],
      ) &&
      existingUser.stageId !== currentUser.stageId
    ) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Acesso negado" },
      };
    }

    // Cannot delete yourself
    if (id === currentUser.userId) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Nao pode deletar seu proprio usuario",
        },
      };
    }

    await this.usersService.delete(id, currentUser);
    return {
      success: true,
      data: null,
    };
  }
}
