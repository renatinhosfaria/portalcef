import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";

import { Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import {
  atualizarCategoriaSchema,
  criarCategoriaSchema,
  listarModelosSchema,
} from "./dto/workflows.dto";
import {
  WORKFLOW_GESTAO_ROLES,
  WORKFLOW_ROLES_ACESSO,
} from "./workflows.constants";
import { WorkflowsCategoriasService } from "./workflows-categorias.service";
import { WorkflowsModelosService } from "./workflows-modelos.service";
import type { WorkflowUserContext } from "./workflows.types";

type RequestComUsuario = { user: WorkflowUserContext };

type ResultadoValidacao<T> =
  | { success: true; data: T }
  | { success: false; error: { errors: unknown[] } };

type SchemaValidavel<T> = {
  safeParse: (input: unknown) => ResultadoValidacao<T>;
};

@Controller("workflows")
@UseGuards(AuthGuard, RolesGuard)
export class WorkflowsController {
  constructor(
    private readonly categoriasService: WorkflowsCategoriasService,
    private readonly modelosService: WorkflowsModelosService,
  ) {}

  private validar<T>(schema: SchemaValidavel<T>, input: unknown): T {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dados invalidos",
        errors: parsed.error.errors,
      });
    }
    return parsed.data;
  }

  @Get("categorias")
  @Roles(...WORKFLOW_ROLES_ACESSO)
  async listarCategorias(@Req() req: RequestComUsuario) {
    return {
      success: true,
      data: await this.categoriasService.listar(req.user),
    };
  }

  @Post("categorias")
  @Roles(...WORKFLOW_GESTAO_ROLES)
  async criarCategoria(
    @Req() req: RequestComUsuario,
    @Body() body: unknown,
  ) {
    const dto = this.validar(criarCategoriaSchema, body);
    return {
      success: true,
      data: await this.categoriasService.criar(req.user, dto),
    };
  }

  @Patch("categorias/:categoriaId")
  @Roles(...WORKFLOW_GESTAO_ROLES)
  async atualizarCategoria(
    @Req() req: RequestComUsuario,
    @Param("categoriaId") categoriaId: string,
    @Body() body: unknown,
  ) {
    const dto = this.validar(atualizarCategoriaSchema, body);
    return {
      success: true,
      data: await this.categoriasService.atualizar(req.user, categoriaId, dto),
    };
  }

  @Get("categorias/:categoriaId/sugestoes")
  @Roles(...WORKFLOW_GESTAO_ROLES)
  async obterSugestoesCategoria(
    @Req() req: RequestComUsuario,
    @Param("categoriaId") categoriaId: string,
  ) {
    return {
      success: true,
      data: await this.categoriasService.obterSugestoes(req.user, categoriaId),
    };
  }

  @Get("modelos")
  @Roles(...WORKFLOW_ROLES_ACESSO)
  async listarModelos(@Req() req: RequestComUsuario, @Query() query: unknown) {
    const dto = this.validar(listarModelosSchema, query);
    return {
      success: true,
      data: await this.modelosService.listar(req.user, dto),
    };
  }
}
