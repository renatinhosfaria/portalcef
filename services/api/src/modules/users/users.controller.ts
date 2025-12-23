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
import { createUserSchema, updateUserSchema } from "@essencia/shared/schemas";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles("gerente_financeiro")
  async findAll(
    @CurrentUser()
    currentUser: {
      userId: string;
      role: string;
      schoolId: string;
      unitId: string;
    },
  ) {
    const users = await this.usersService.findAllByTenant(currentUser);
    return {
      success: true,
      data: users,
    };
  }

  @Get(":id")
  @Roles("gerente_financeiro")
  async findById(
    @Param("id") id: string,
    @CurrentUser()
    currentUser: {
      userId: string;
      role: string;
      schoolId: string;
      unitId: string;
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
    }

    return {
      success: true,
      data: user,
    };
  }

  @Post()
  @Roles("gerente_financeiro")
  async create(
    @Body() body: unknown,
    @CurrentUser()
    currentUser: {
      userId: string;
      role: string;
      schoolId: string;
      unitId: string;
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

    const user = await this.usersService.create(result.data);
    return {
      success: true,
      data: user,
    };
  }

  @Put(":id")
  @Roles("gerente_financeiro")
  async update(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser()
    currentUser: {
      userId: string;
      role: string;
      schoolId: string;
      unitId: string;
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

    // Non-diretora geral cannot change unitId
    if (
      currentUser.role !== "master" &&
      currentUser.role !== "diretora_geral" &&
      result.data.unitId
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

    const user = await this.usersService.update(id, result.data);
    return {
      success: true,
      data: user,
    };
  }

  @Delete(":id")
  @Roles("gerente_financeiro")
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param("id") id: string,
    @CurrentUser()
    currentUser: {
      userId: string;
      role: string;
      schoolId: string;
      unitId: string;
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

    await this.usersService.delete(id);
    return {
      success: true,
      data: null,
    };
  }
}
