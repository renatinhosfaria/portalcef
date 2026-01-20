import { MultipartFile } from "@fastify/multipart";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { FastifyRequest } from "fastify";

import { Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { StorageService } from "../../common/storage/storage.service";
import {
  type AddComentarioDto,
  addComentarioSchema,
  type CreatePlanoDto,
  createPlanoSchema,
  type DashboardQueryDto,
  dashboardQuerySchema,
  type DevolverPlanoDto,
  devolverPlanoSchema,
  type SetDeadlineDto,
  setDeadlineSchema,
  type ListarPlanosGestaoDto,
  listarPlanosGestaoSchema,
  GESTAO_ROLES,
  COORDENADORA_ROLES,
  ANALISTA_ROLES,
  PROFESSORA_ROLES,
} from "./dto/plano-aula.dto";
import { PlanoAulaService, type UserContext } from "./plano-aula.service";

// ============================================
// Types
// ============================================

interface FastifyMultipartRequest extends FastifyRequest {
  isMultipart: () => boolean;
  file: () => Promise<MultipartFile>;
  user: UserContext;
}

// ============================================
// Role Arrays para Guards
// ============================================

/** Todas as roles que podem acessar endpoints de professora */
const PROFESSORA_ACCESS = [...PROFESSORA_ROLES] as const;

/** Todas as roles que podem acessar endpoints de analista */
const ANALISTA_ACCESS = [...ANALISTA_ROLES] as const;

/** Todas as roles que podem acessar endpoints de coordenadora */
const COORDENADORA_ACCESS = [
  ...GESTAO_ROLES,
  ...COORDENADORA_ROLES,
] as const;

/** Todas as roles que podem acessar endpoints de gestão/config */
const GESTAO_ACCESS = [...GESTAO_ROLES] as const;

/** Roles que podem visualizar planos (todas que participam do workflow) */
const VISUALIZAR_ACCESS = [
  ...PROFESSORA_ROLES,
  ...ANALISTA_ROLES,
  ...COORDENADORA_ROLES,
  ...GESTAO_ROLES,
] as const;

// ============================================
// Controller
// ============================================

/**
 * PlanoAulaController
 *
 * Controller para o novo workflow de planos de aula com:
 * - Professora: criar, submeter, anexar documentos
 * - Analista: revisar, aprovar/devolver
 * - Coordenadora: aprovar final/devolver
 * - Gestão: dashboard, configuração de deadlines
 *
 * NOTA: TenantGuard não é usado pois o isolamento de tenant é feito
 * via UserContext (userId, unitId da sessão). O service valida
 * o acesso em cada método.
 */
@Controller("plano-aula")
@UseGuards(AuthGuard, RolesGuard)
export class PlanoAulaController {
  private readonly logger = new Logger(PlanoAulaController.name);

  constructor(
    private readonly planoAulaService: PlanoAulaService,
    private readonly storageService: StorageService,
  ) { }

  // ============================================
  // Endpoints da Professora
  // ============================================

  /**
   * POST /plano-aula
   * Cria ou retorna plano existente para turma/quinzena
   */
  @Post()
  @Roles(...PROFESSORA_ACCESS)
  async criarPlano(
    @Req() req: { user: UserContext },
    @Body() body: CreatePlanoDto,
  ) {
    // Validar DTO
    const parsed = createPlanoSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dados inválidos",
        errors: parsed.error.errors,
      });
    }

    const plano = await this.planoAulaService.criarPlano(req.user, parsed.data);
    return {
      success: true,
      data: plano,
    };
  }

  /**
   * GET /plano-aula/meus
   * Lista planos do usuário logado
   */
  @Get("meus")
  @Roles(...PROFESSORA_ACCESS)
  async listarMeusPlanos(
    @Req() req: { user: UserContext },
    @Query("quinzenaId") quinzenaId?: string,
  ) {
    const planos = await this.planoAulaService.listarMeusPlanos(
      req.user,
      quinzenaId,
    );
    return {
      success: true,
      data: planos,
    };
  }

  /**
   * GET /plano-aula/:id
   * Busca plano por ID com documentos e comentários
   */
  @Get(":id")
  @Roles(...VISUALIZAR_ACCESS)
  async getPlanoById(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const plano = await this.planoAulaService.getPlanoById(req.user, id);
    return {
      success: true,
      data: plano,
    };
  }

  /**
   * POST /plano-aula/:id/submeter
   * Submete plano para análise
   */
  @Post(":id/submeter")
  @Roles(...PROFESSORA_ACCESS)
  async submeterPlano(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const plano = await this.planoAulaService.submeterPlano(req.user, id);
    return {
      success: true,
      data: plano,
    };
  }

  /**
   * POST /plano-aula/:id/documentos/upload
   * Upload de arquivo para o plano (multipart/form-data)
   */
  @Post(":id/documentos/upload")
  @Roles(...PROFESSORA_ACCESS)
  async uploadDocumento(
    @Param("id") planoId: string,
    @Req() req: FastifyMultipartRequest,
  ) {
    if (!req.isMultipart()) {
      throw new BadRequestException({
        code: "INVALID_REQUEST",
        message: "Request deve ser multipart/form-data",
      });
    }

    const user = req.user;

    if (!user.unitId) {
      throw new BadRequestException({
        code: "NO_UNIT",
        message: "Usuário não está associado a uma unidade",
      });
    }

    // Verificar se plano existe e pertence ao usuário
    const plano = await this.planoAulaService.getPlanoById(user, planoId);
    if (plano.user.id !== user.userId) {
      throw new BadRequestException({
        code: "NOT_OWNER",
        message: "Apenas o autor pode anexar documentos ao plano",
      });
    }

    // Parse multipart data
    const data = await req.file();

    if (!data) {
      throw new BadRequestException({
        code: "NO_FILE",
        message: "Nenhum arquivo enviado",
      });
    }

    // Validar tipo de arquivo
    const allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/png",
      "image/jpeg",
      "image/jpg",
    ];

    if (!allowedMimeTypes.includes(data.mimetype)) {
      throw new BadRequestException({
        code: "INVALID_FILE_TYPE",
        message: "Tipo de arquivo não permitido. Use PDF, DOC, DOCX, PNG ou JPG",
      });
    }

    // Validar tamanho (10MB max)
    const MAX_SIZE = 10 * 1024 * 1024;
    const buffer = await data.toBuffer();
    if (buffer.length > MAX_SIZE) {
      throw new BadRequestException({
        code: "FILE_TOO_LARGE",
        message: "Arquivo muito grande. Tamanho máximo: 10MB",
      });
    }

    try {
      // Upload para MinIO
      const uploadResult = await this.storageService.uploadFile(data);

      // Salvar documento no banco via service
      const documento = await this.planoAulaService.adicionarDocumentoUpload(
        planoId,
        {
          tipo: "UPLOAD",
          fileName: uploadResult.name,
          fileKey: uploadResult.key,
          fileUrl: uploadResult.url,
          fileSize: buffer.length,
          mimeType: data.mimetype,
        },
      );

      return {
        success: true,
        data: documento,
      };
    } catch (error) {
      this.logger.error(
        `Erro ao fazer upload: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new InternalServerErrorException({
        code: "UPLOAD_FAILED",
        message: "Erro ao fazer upload do arquivo",
      });
    }
  }

  /**
   * POST /plano-aula/:id/documentos/link
   * Adiciona link do YouTube ao plano
   */
  @Post(":id/documentos/link")
  @Roles(...PROFESSORA_ACCESS)
  async adicionarLinkYouTube(
    @Param("id") planoId: string,
    @Req() req: { user: UserContext },
    @Body() body: { url: string; titulo?: string },
  ) {
    const user = req.user;

    if (!body.url) {
      throw new BadRequestException({
        code: "NO_URL",
        message: "URL é obrigatória",
      });
    }

    // Validar URL do YouTube
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    if (!youtubeRegex.test(body.url)) {
      throw new BadRequestException({
        code: "INVALID_URL",
        message: "URL deve ser um link válido do YouTube",
      });
    }

    // Verificar se plano existe e pertence ao usuário
    const plano = await this.planoAulaService.getPlanoById(user, planoId);
    if (plano.user.id !== user.userId) {
      throw new BadRequestException({
        code: "NOT_OWNER",
        message: "Apenas o autor pode anexar documentos ao plano",
      });
    }

    const documento = await this.planoAulaService.adicionarDocumentoLink(
      planoId,
      {
        tipo: "YOUTUBE",
        url: body.url,
        titulo: body.titulo,
      },
    );

    return {
      success: true,
      data: documento,
    };
  }

  /**
   * DELETE /plano-aula/:id/documentos/:docId
   * Remove documento do plano
   */
  @Delete(":id/documentos/:docId")
  @Roles(...PROFESSORA_ACCESS)
  async deletarDocumento(
    @Param("id") planoId: string,
    @Param("docId") docId: string,
    @Req() req: { user: UserContext },
  ) {
    const user = req.user;

    // Verificar se plano existe e pertence ao usuário
    const plano = await this.planoAulaService.getPlanoById(user, planoId);
    if (plano.user.id !== user.userId) {
      throw new BadRequestException({
        code: "NOT_OWNER",
        message: "Apenas o autor pode remover documentos do plano",
      });
    }

    await this.planoAulaService.removerDocumento(planoId, docId);

    return {
      success: true,
      message: "Documento removido com sucesso",
    };
  }

  // ============================================
  // Endpoints do Analista
  // ============================================

  /**
   * GET /plano-aula/analista/pendentes
   * Lista planos pendentes para analista
   */
  @Get("analista/pendentes")
  @Roles(...ANALISTA_ACCESS)
  async listarPendentesAnalista(@Req() req: { user: UserContext }) {
    const planos = await this.planoAulaService.listarPendentesAnalista(req.user);
    return {
      success: true,
      data: planos,
    };
  }

  /**
   * POST /plano-aula/:id/analista/aprovar
   * Aprova plano como analista
   */
  @Post(":id/analista/aprovar")
  @Roles(...ANALISTA_ACCESS)
  async aprovarComoAnalista(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const plano = await this.planoAulaService.aprovarComoAnalista(req.user, id);
    return {
      success: true,
      data: plano,
    };
  }

  /**
   * POST /plano-aula/:id/analista/devolver
   * Devolve plano como analista
   */
  @Post(":id/analista/devolver")
  @Roles(...ANALISTA_ACCESS)
  async devolverComoAnalista(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
    @Body() body: { comentarios?: Array<{ documentoId: string; comentario: string }> },
  ) {
    const plano = await this.planoAulaService.devolverComoAnalista(
      req.user,
      id,
      body.comentarios,
    );
    return {
      success: true,
      data: plano,
    };
  }

  // ============================================
  // Endpoints da Coordenadora
  // ============================================

  /**
   * GET /plano-aula/coordenadora/pendentes
   * Lista planos pendentes para coordenadora
   */
  @Get("coordenadora/pendentes")
  @Roles(...COORDENADORA_ACCESS)
  async listarPendentesCoordenadora(@Req() req: { user: UserContext }) {
    const planos = await this.planoAulaService.listarPendentesCoordenadora(
      req.user,
    );
    return {
      success: true,
      data: planos,
    };
  }

  /**
   * POST /plano-aula/:id/coordenadora/aprovar
   * Aprova plano como coordenadora (aprovação final)
   */
  @Post(":id/coordenadora/aprovar")
  @Roles(...COORDENADORA_ACCESS)
  async aprovarComoCoordenadora(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const plano = await this.planoAulaService.aprovarComoCoordenadora(
      req.user,
      id,
    );
    return {
      success: true,
      data: plano,
    };
  }

  /**
   * POST /plano-aula/:id/coordenadora/devolver
   * Devolve plano como coordenadora
   */
  @Post(":id/coordenadora/devolver")
  @Roles(...COORDENADORA_ACCESS)
  async devolverComoCoordenadora(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
    @Body() body: DevolverPlanoDto,
  ) {
    // Validar DTO
    const parsed = devolverPlanoSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dados inválidos",
        errors: parsed.error.errors,
      });
    }

    const plano = await this.planoAulaService.devolverComoCoordenadora(
      req.user,
      id,
      parsed.data,
    );
    return {
      success: true,
      data: plano,
    };
  }

  // ============================================
  // Endpoints de Gestão/Config
  // ============================================

  /**
   * GET /plano-aula/dashboard
   * Dashboard com estatísticas por status e segmento
   */
  @Get("dashboard")
  @Roles(...GESTAO_ACCESS)
  async getDashboard(
    @Req() req: { user: UserContext },
    @Query() query: DashboardQueryDto,
  ) {
    // Validar query params
    const parsed = dashboardQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Parâmetros inválidos",
        errors: parsed.error.errors,
      });
    }

    const dashboard = await this.planoAulaService.getDashboard(
      req.user,
      parsed.data.unitId,
      parsed.data.quinzenaId,
    );
    return {
      success: true,
      data: dashboard,
    };
  }

  /**
   * GET /plano-aula/gestao/listar
   * Lista planos com filtros e paginação para gestão
   */
  @Get("gestao/listar")
  @Roles(...GESTAO_ACCESS)
  async listarPlanosGestao(
    @Req() req: { user: UserContext },
    @Query() query: ListarPlanosGestaoDto,
  ) {
    const parsed = listarPlanosGestaoSchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Parâmetros inválidos",
        errors: parsed.error.errors,
      });
    }

    const result = await this.planoAulaService.listarPlanosGestao(
      req.user,
      parsed.data,
    );

    return {
      success: true,
      ...result,
    };
  }

  /**
   * POST /plano-aula/config/deadline
   * Define deadline para quinzena
   */
  @Post("config/deadline")
  @Roles(...GESTAO_ACCESS)
  async setDeadline(
    @Req() req: { user: UserContext },
    @Body() body: SetDeadlineDto,
  ) {
    // Validar DTO
    const parsed = setDeadlineSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dados inválidos",
        errors: parsed.error.errors,
      });
    }

    await this.planoAulaService.setDeadline(req.user, parsed.data);
    return {
      success: true,
      message: "Deadline configurado com sucesso",
    };
  }

  /**
   * GET /plano-aula/config/deadlines
   * Lista deadlines configurados
   */
  @Get("config/deadlines")
  @Roles(...GESTAO_ACCESS)
  async getDeadlines(@Req() req: { user: UserContext }) {
    const deadlines = await this.planoAulaService.getDeadlines(req.user);
    return {
      success: true,
      data: deadlines,
    };
  }

  // ============================================
  // Endpoint de Comentários
  // ============================================

  /**
   * POST /plano-aula/comentarios
   * Adiciona comentário a um documento
   */
  @Post("comentarios")
  @Roles(...ANALISTA_ACCESS, ...COORDENADORA_ACCESS)
  async addComentario(
    @Req() req: { user: UserContext },
    @Body() body: AddComentarioDto,
  ) {
    // Validar DTO
    const parsed = addComentarioSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dados inválidos",
        errors: parsed.error.errors,
      });
    }

    const comentario = await this.planoAulaService.addComentario(
      req.user,
      parsed.data,
    );
    return {
      success: true,
      data: comentario,
    };
  }
}
