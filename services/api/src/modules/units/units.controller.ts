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
import { createUnitSchema, updateUnitSchema } from "@essencia/shared/schemas";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { UnitsService } from "./units.service";

@Controller("schools/:schoolId/units")
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
export class UnitsController {
  constructor(private unitsService: UnitsService) {}

  @Get()
  @Roles("coordenadora_geral")
  async findBySchool(
    @Param("schoolId") schoolId: string,
    @CurrentUser()
    currentUser: {
      schoolId: string | null;
      unitId: string | null;
      role: string;
    },
  ) {
    // Master can access any school's units
    if (currentUser.role === "master") {
      const units = await this.unitsService.findBySchool(schoolId);
      return {
        success: true,
        data: units,
      };
    }

    // Verify user can access this school
    if (schoolId !== currentUser.schoolId) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Acesso negado" },
      };
    }

    // Diretora geral can see all units in their school
    if (currentUser.role === "diretora_geral") {
      const units = await this.unitsService.findBySchool(schoolId);
      return {
        success: true,
        data: units,
      };
    }

    // Other roles can only see their own unit
    if (currentUser.unitId) {
      const unit = await this.unitsService.findById(currentUser.unitId);
      return {
        success: true,
        data: unit ? [unit] : [],
      };
    }

    return {
      success: true,
      data: [],
    };
  }

  @Get(":id")
  @Roles("coordenadora_geral")
  async findById(
    @Param("schoolId") schoolId: string,
    @Param("id") id: string,
    @CurrentUser()
    currentUser: {
      schoolId: string | null;
      unitId: string | null;
      role: string;
    },
  ) {
    // Master can access any unit
    if (currentUser.role === "master") {
      const unit = await this.unitsService.findById(id);
      return {
        success: true,
        data: unit,
      };
    }

    // Verify user can access this school
    if (schoolId !== currentUser.schoolId) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Acesso negado" },
      };
    }

    // Diretora geral can access any unit in their school
    if (currentUser.role === "diretora_geral") {
      const unit = await this.unitsService.findById(id);
      return {
        success: true,
        data: unit,
      };
    }

    // Other roles can only access their own unit
    if (id !== currentUser.unitId) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Acesso negado" },
      };
    }

    const unit = await this.unitsService.findById(id);
    return {
      success: true,
      data: unit,
    };
  }

  @Post()
  @Roles("diretora_geral")
  async create(
    @Param("schoolId") schoolId: string,
    @Body() body: unknown,
    @CurrentUser() currentUser: { schoolId: string | null; role: string },
  ) {
    // Master can create units in any school
    if (currentUser.role !== "master" && schoolId !== currentUser.schoolId) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Acesso negado" },
      };
    }

    const result = createUnitSchema.safeParse({
      ...(body as object),
      schoolId,
    });
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

    const unit = await this.unitsService.create(result.data);
    return {
      success: true,
      data: unit,
    };
  }

  @Put(":id")
  @Roles("diretora_geral")
  async update(
    @Param("schoolId") schoolId: string,
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() currentUser: { schoolId: string | null; role: string },
  ) {
    // Master can update any unit
    if (currentUser.role !== "master" && schoolId !== currentUser.schoolId) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Acesso negado" },
      };
    }

    // Verify unit belongs to this school
    const existingUnit = await this.unitsService.findById(id);
    if (!existingUnit || existingUnit.schoolId !== schoolId) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Unidade nao encontrada" },
      };
    }

    const result = updateUnitSchema.safeParse(body);
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

    const unit = await this.unitsService.update(id, result.data);
    return {
      success: true,
      data: unit,
    };
  }

  @Delete(":id")
  @Roles("diretora_geral")
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param("schoolId") schoolId: string,
    @Param("id") id: string,
    @CurrentUser() currentUser: { schoolId: string | null; role: string },
  ) {
    // Master can delete any unit
    if (currentUser.role !== "master" && schoolId !== currentUser.schoolId) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Acesso negado" },
      };
    }

    // Verify unit belongs to this school
    const existingUnit = await this.unitsService.findById(id);
    if (!existingUnit || existingUnit.schoolId !== schoolId) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Unidade nao encontrada" },
      };
    }

    await this.unitsService.delete(id);
    return {
      success: true,
      data: null,
    };
  }
}
