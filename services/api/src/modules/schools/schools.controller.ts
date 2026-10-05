import {
  createSchoolSchema,
  createSchoolProvisioningSchema,
  updateSchoolSchema,
} from "@essencia/shared/schemas";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Put,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { SchoolsService } from "./schools.service";
import { SchoolsProvisioningService } from "./schools-provisioning.service";

@Controller("schools")
@UseGuards(AuthGuard, RolesGuard)
export class SchoolsController {
  constructor(
    private schoolsService: SchoolsService,
    private provisioningService: SchoolsProvisioningService,
  ) {}

  @Get()
  @Roles("master")
  async findAll(
    @CurrentUser() _currentUser: { role: string; schoolId: string | null },
    @Query("summary") summary?: string,
  ) {
    const schools =
      summary === "true"
        ? await this.schoolsService.findAllWithUnitCounts()
        : await this.schoolsService.findAll();
    return {
      success: true,
      data: schools,
    };
  }

  @Get(":id")
  @Roles("gerente_financeiro")
  async findById(
    @Param("id") id: string,
    @CurrentUser() currentUser: { role: string; schoolId: string | null },
  ) {
    // Diretora geral só pode ver sua própria escola
    if (currentUser.role !== "master" && currentUser.schoolId !== id) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Acesso negado a esta escola",
        },
      };
    }

    const school = await this.schoolsService.findById(id);
    if (!school) {
      throw new NotFoundException("Escola não encontrada");
    }
    return {
      success: true,
      data: school,
    };
  }

  @Post()
  @Roles("master")
  async create(@Body() body: unknown) {
    const result = createSchoolSchema.safeParse(body);
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
    const school = await this.schoolsService.create(result.data);
    return {
      success: true,
      data: school,
    };
  }

  @Post("provision")
  @Roles("master")
  async provision(@Body() body: unknown) {
    const result = createSchoolProvisioningSchema.safeParse(body);
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

    const provisioned = await this.provisioningService.create(result.data);
    return { success: true, data: provisioned };
  }

  @Put(":id")
  @Roles("master")
  async update(@Param("id") id: string, @Body() body: unknown) {
    const result = updateSchoolSchema.safeParse(body);
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
    const school = await this.schoolsService.update(id, result.data);
    return {
      success: true,
      data: school,
    };
  }

  @Delete(":id")
  @Roles("master")
  @HttpCode(HttpStatus.OK)
  async delete(@Param("id") id: string) {
    await this.schoolsService.delete(id);
    return {
      success: true,
      data: null,
    };
  }
}
