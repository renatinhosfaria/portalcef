import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";

import { ExactRoles, Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import {
  atualizarCategoriaSchema,
  atualizarEtapaSchema,
  atualizarModeloSchema,
  criarCategoriaSchema,
  criarModeloSchema,
  editarTituloExecucaoSchema,
  iniciarExecucaoSchema,
  listarExecucoesSchema,
  listarModelosSchema,
  motivoObrigatorioSchema,
} from "./dto/workflows.dto";
import {
  WORKFLOW_GESTAO_ROLES,
  WORKFLOW_ROLES_ACESSO,
} from "./workflows.constants";
import { WorkflowsCategoriasService } from "./workflows-categorias.service";
import { WorkflowsExecucoesService } from "./workflows-execucoes.service";
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
@ExactRoles()
@UseGuards(AuthGuard, RolesGuard)
export class WorkflowsController {
  constructor(
    private readonly categoriasService: WorkflowsCategoriasService,
    private readonly modelosService: WorkflowsModelosService,
    private readonly execucoesService: WorkflowsExecucoesService,
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

  @Post("modelos")
  @Roles(...WORKFLOW_GESTAO_ROLES)
  async criarModelo(@Req() req: RequestComUsuario, @Body() body: unknown) {
    const dto = this.validar(criarModeloSchema, body);
    return {
      success: true,
      data: await this.modelosService.criar(req.user, dto),
    };
  }

  @Get("modelos/:modeloId")
  @Roles(...WORKFLOW_ROLES_ACESSO)
  async buscarModelo(
    @Req() req: RequestComUsuario,
    @Param("modeloId") modeloId: string,
  ) {
    return {
      success: true,
      data: await this.modelosService.buscarPorId(req.user, modeloId),
    };
  }

  @Patch("modelos/:modeloId")
  @Roles(...WORKFLOW_GESTAO_ROLES)
  async atualizarModelo(
    @Req() req: RequestComUsuario,
    @Param("modeloId") modeloId: string,
    @Body() body: unknown,
  ) {
    const dto = this.validar(atualizarModeloSchema, body);
    return {
      success: true,
      data: await this.modelosService.atualizar(req.user, modeloId, dto),
    };
  }

  @Post("modelos/:modeloId/publicar")
  @Roles(...WORKFLOW_GESTAO_ROLES)
  async publicarModelo(
    @Req() req: RequestComUsuario,
    @Param("modeloId") modeloId: string,
  ) {
    return {
      success: true,
      data: await this.modelosService.publicar(req.user, modeloId),
    };
  }

  @Post("modelos/:modeloId/inativar")
  @Roles(...WORKFLOW_GESTAO_ROLES)
  async inativarModelo(
    @Req() req: RequestComUsuario,
    @Param("modeloId") modeloId: string,
  ) {
    return {
      success: true,
      data: await this.modelosService.inativar(req.user, modeloId),
    };
  }

  @Post("modelos/:modeloId/duplicar")
  @Roles(...WORKFLOW_GESTAO_ROLES)
  async duplicarModelo(
    @Req() req: RequestComUsuario,
    @Param("modeloId") modeloId: string,
  ) {
    return {
      success: true,
      data: await this.modelosService.duplicar(req.user, modeloId),
    };
  }

  @Post("modelos/:modeloId/execucoes")
  @Roles(...WORKFLOW_ROLES_ACESSO)
  async iniciarExecucao(
    @Req() req: RequestComUsuario,
    @Param("modeloId") modeloId: string,
    @Body() body: unknown,
  ) {
    const dto = this.validar(iniciarExecucaoSchema, body);
    return {
      success: true,
      data: await this.execucoesService.iniciar(req.user, modeloId, dto),
    };
  }

  @Get("execucoes")
  @Roles(...WORKFLOW_ROLES_ACESSO)
  async listarExecucoes(
    @Req() req: RequestComUsuario,
    @Query() query: unknown,
  ) {
    const dto = this.validar(listarExecucoesSchema, query);
    return {
      success: true,
      data: await this.execucoesService.listar(req.user, dto),
    };
  }

  @Get("execucoes/:execucaoId")
  @Roles(...WORKFLOW_ROLES_ACESSO)
  async buscarExecucao(
    @Req() req: RequestComUsuario,
    @Param("execucaoId") execucaoId: string,
  ) {
    return {
      success: true,
      data: await this.execucoesService.buscarPorId(req.user, execucaoId),
    };
  }

  @Patch("execucoes/:execucaoId/titulo")
  @Roles(...WORKFLOW_ROLES_ACESSO)
  async editarTituloExecucao(
    @Req() req: RequestComUsuario,
    @Param("execucaoId") execucaoId: string,
    @Body() body: unknown,
  ) {
    const dto = this.validar(editarTituloExecucaoSchema, body);
    return {
      success: true,
      data: await this.execucoesService.editarTitulo(
        req.user,
        execucaoId,
        dto,
      ),
    };
  }

  @Patch("execucoes/:execucaoId/etapas/:etapaId")
  @Roles(...WORKFLOW_ROLES_ACESSO)
  async atualizarEtapa(
    @Req() req: RequestComUsuario,
    @Param("execucaoId") execucaoId: string,
    @Param("etapaId") etapaId: string,
    @Body() body: unknown,
  ) {
    const dto = this.validar(atualizarEtapaSchema, body);
    return {
      success: true,
      data: await this.execucoesService.atualizarEtapa(
        req.user,
        execucaoId,
        etapaId,
        dto,
      ),
    };
  }

  @Post("execucoes/:execucaoId/concluir")
  @Roles(...WORKFLOW_ROLES_ACESSO)
  async concluirExecucao(
    @Req() req: RequestComUsuario,
    @Param("execucaoId") execucaoId: string,
  ) {
    return {
      success: true,
      data: await this.execucoesService.concluir(req.user, execucaoId),
    };
  }

  @Post("execucoes/:execucaoId/cancelar")
  @Roles(...WORKFLOW_ROLES_ACESSO)
  async cancelarExecucao(
    @Req() req: RequestComUsuario,
    @Param("execucaoId") execucaoId: string,
    @Body() body: unknown,
  ) {
    const dto = this.validar(motivoObrigatorioSchema, body);
    return {
      success: true,
      data: await this.execucoesService.cancelar(req.user, execucaoId, dto),
    };
  }

  @Post("execucoes/:execucaoId/reabrir")
  @Roles(...WORKFLOW_GESTAO_ROLES)
  async reabrirExecucao(
    @Req() req: RequestComUsuario,
    @Param("execucaoId") execucaoId: string,
    @Body() body: unknown,
  ) {
    const dto = this.validar(motivoObrigatorioSchema, body);
    return {
      success: true,
      data: await this.execucoesService.reabrir(req.user, execucaoId, dto),
    };
  }

  @Delete("execucoes/:execucaoId")
  @Roles(...WORKFLOW_GESTAO_ROLES)
  async descartarExecucaoTeste(
    @Req() req: RequestComUsuario,
    @Param("execucaoId") execucaoId: string,
  ) {
    await this.execucoesService.descartarTeste(req.user, execucaoId);
    return { success: true, data: null };
  }
}
