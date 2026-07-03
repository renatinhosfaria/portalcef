import type { Multipart } from "@fastify/multipart";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { ExactRoles, Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { StorageService } from "../../common/storage/storage.service";
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
import { WorkflowsAnexosService } from "./workflows-anexos.service";
import { WorkflowsCategoriasService } from "./workflows-categorias.service";
import { WorkflowsExecucoesService } from "./workflows-execucoes.service";
import { WorkflowsModelosService } from "./workflows-modelos.service";
import type {
  ArquivoWorkflowUpload,
  WorkflowUserContext,
} from "./workflows.types";

type RequestComUsuario = { user: WorkflowUserContext };

interface FastifyMultipartRequest extends FastifyRequest {
  isMultipart: () => boolean;
  parts: () => AsyncIterableIterator<Multipart>;
  user: WorkflowUserContext;
}

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
  private readonly logger = new Logger(WorkflowsController.name);

  constructor(
    private readonly categoriasService: WorkflowsCategoriasService,
    private readonly modelosService: WorkflowsModelosService,
    private readonly execucoesService: WorkflowsExecucoesService,
    private readonly anexosService: WorkflowsAnexosService,
    private readonly storageService: StorageService,
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

  private async processarArquivoUnico(
    req: FastifyMultipartRequest,
  ): Promise<ArquivoWorkflowUpload> {
    if (!req.isMultipart()) {
      throw new BadRequestException({
        code: "INVALID_REQUEST",
        message: "Request deve ser multipart/form-data",
      });
    }

    let quantidadeArquivos = 0;
    let arquivo: ArquivoWorkflowUpload | null = null;

    for await (const part of req.parts()) {
      if (part.type !== "file") {
        continue;
      }

      quantidadeArquivos += 1;
      if (quantidadeArquivos > 1) {
        throw new BadRequestException({
          code: "MULTIPLE_FILES",
          message: "Envie apenas um arquivo por vez",
        });
      }

      const buffer = await part.toBuffer();
      if (buffer.length === 0) {
        throw new BadRequestException({
          code: "EMPTY_FILE",
          message: "Envie um arquivo nao vazio",
        });
      }

      arquivo = {
        buffer,
        nomeOriginal: part.filename,
        mimetype: part.mimetype,
        tamanhoBytes: buffer.length,
      };
    }

    if (!arquivo) {
      throw new BadRequestException({
        code: "FILE_REQUIRED",
        message: "Envie um arquivo nao vazio",
      });
    }

    return arquivo;
  }

  private async enviarArquivoParaStorage(arquivo: ArquivoWorkflowUpload) {
    try {
      return await this.storageService.uploadBuffer(
        arquivo.buffer,
        arquivo.nomeOriginal,
        arquivo.mimetype,
        "workflows",
      );
    } catch (error) {
      this.logger.error(
        `Erro ao fazer upload de anexo de workflow: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new InternalServerErrorException({
        code: "UPLOAD_FAILED",
        message: "Erro ao fazer upload do arquivo",
      });
    }
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

  @Post("execucoes/:execucaoId/anexos")
  @Roles(...WORKFLOW_ROLES_ACESSO)
  async enviarAnexo(
    @Param("execucaoId") execucaoId: string,
    @Req() req: FastifyMultipartRequest,
  ) {
    await this.execucoesService.buscarPorId(req.user, execucaoId);
    const arquivo = await this.processarArquivoUnico(req);
    const resultado = await this.enviarArquivoParaStorage(arquivo);

    try {
      const anexo = await this.anexosService.registrarUpload(req.user, execucaoId, {
        url: resultado.url,
        storageKey: resultado.key,
        nomeOriginal: arquivo.nomeOriginal,
        mimetype: arquivo.mimetype,
        tamanhoBytes: arquivo.tamanhoBytes,
      });

      return {
        success: true,
        data: {
          ...anexo,
          enviadoPorNome: null,
        },
      };
    } catch (error) {
      try {
        await this.storageService.deleteFile(resultado.key);
      } catch (deleteError) {
        this.logger.error(
          `Erro ao remover anexo de workflow apos falha de registro: ${
            deleteError instanceof Error
              ? deleteError.message
              : String(deleteError)
          }`,
        );
      }

      throw error;
    }
  }

  @Delete("execucoes/:execucaoId/anexos/:anexoId")
  @Roles(...WORKFLOW_ROLES_ACESSO)
  async removerAnexo(
    @Req() req: RequestComUsuario,
    @Param("execucaoId") execucaoId: string,
    @Param("anexoId") anexoId: string,
  ) {
    await this.execucoesService.buscarPorId(req.user, execucaoId);
    await this.anexosService.remover(req.user, execucaoId, anexoId);
    return { success: true, data: null };
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
