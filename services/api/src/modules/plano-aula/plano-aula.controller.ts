import { MultipartFile } from "@fastify/multipart";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyReply, FastifyRequest } from "fastify";

import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { StorageService } from "../../common/storage/storage.service";
import {
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
import { PlanoAulaHistoricoService } from "./plano-aula-historico.service";
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
const COORDENADORA_ACCESS = [...GESTAO_ROLES, ...COORDENADORA_ROLES] as const;

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
 * - Analista: revisar, aprovar (final)/devolver
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
    private readonly historicoService: PlanoAulaHistoricoService,
    private readonly configService: ConfigService,
  ) {}

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
   * GET /plano-aula/:id/historico
   * Busca histórico de ações do plano
   */
  @Get(":id/historico")
  @Roles(...VISUALIZAR_ACCESS)
  async getHistorico(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    // Verificar se plano existe e usuário tem acesso
    await this.planoAulaService.getPlanoById(req.user, id);

    // Buscar histórico
    const historico = await this.historicoService.buscarPorPlano(id);
    return {
      success: true,
      data: historico,
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
   * POST /plano-aula/:id/recuperar
   * Recupera plano submetido antes da análise ser iniciada
   */
  @Post(":id/recuperar")
  @Roles(...PROFESSORA_ACCESS)
  async recuperarPlano(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const plano = await this.planoAulaService.recuperarPlano(req.user, id);
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
  @Roles(...PROFESSORA_ACCESS, ...ANALISTA_ACCESS)
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

    // Verificar se plano existe e usuário tem acesso
    const plano = await this.planoAulaService.getPlanoById(user, planoId);
    const isOwner = plano.user.id === user.userId;
    const isAnalistaUser = ANALISTA_ROLES.includes(user.role as typeof ANALISTA_ROLES[number]);
    if (!isOwner && !isAnalistaUser) {
      throw new BadRequestException({
        code: "NOT_AUTHORIZED",
        message: "Você não tem permissão para anexar documentos a este plano",
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
        message:
          "Tipo de arquivo não permitido. Use PDF, DOC, DOCX, PNG ou JPG",
      });
    }

    // Validar tamanho (100MB max)
    const MAX_SIZE = 100 * 1024 * 1024; // 100MB
    const buffer = await data.toBuffer();
    if (buffer.length > MAX_SIZE) {
      throw new BadRequestException({
        code: "FILE_TOO_LARGE",
        message: "Arquivo muito grande. Tamanho máximo: 100MB",
      });
    }

    try {
      // Upload para MinIO
      const uploadResult = await this.storageService.uploadFile(data);

      // Salvar documento no banco via service
      // Conversão doc→PDF desabilitada (OnlyOffice é usado para visualização/edição)
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
   * GET /plano-aula/:id/documentos/:docId/editor-config
   * Retorna configuração do OnlyOffice para abrir o editor
   */
  @Get(":id/documentos/:docId/editor-config")
  @Roles(...VISUALIZAR_ACCESS)
  async getEditorConfig(
    @Req() req: { user: UserContext },
    @Param("id") planoId: string,
    @Param("docId") docId: string,
    @Query("mode") mode: string = "view",
  ) {
    if (mode !== "edit" && mode !== "view" && mode !== "comentar") {
      throw new BadRequestException("Mode deve ser 'edit', 'comentar' ou 'view'");
    }

    const documento = await this.planoAulaService.getDocumentoById(planoId, docId);

    if (!documento.storageKey) {
      throw new BadRequestException("Documento sem arquivo associado");
    }

    const isWord =
      documento.mimeType?.includes("word") ||
      documento.mimeType?.includes("msword");
    if (!isWord) {
      throw new BadRequestException(
        "Apenas documentos .doc/.docx podem ser abertos no editor",
      );
    }

    // URL de download direto via API (evita presigned URL que o OnlyOffice não consegue baixar).
    // O request-filtering-agent interno do OnlyOffice modifica requisições HTTP,
    // causando erro 400 em presigned URLs tanto no MinIO direto quanto via nginx.
    // Solução: o OnlyOffice baixa do endpoint da API, que faz proxy do MinIO.
    const apiBaseUrl =
      this.configService.get<string>("NEXT_PUBLIC_API_URL") ||
      "https://www.portalcef.com.br/api";
    const fileUrl = `${apiBaseUrl}/plano-aula/${planoId}/documentos/${docId}/download`;

    const onlyofficeUrl =
      this.configService.get<string>("ONLYOFFICE_PUBLIC_URL") ||
      "https://www.portalcef.com.br/onlyoffice";
    const jwtSecret = this.configService.get<string>("ONLYOFFICE_JWT_SECRET");
    // Permissões baseadas no modo
    const permissions: Record<string, boolean> = {
      edit: mode === "edit",
      comment: mode === "comentar",
      download: true,
      print: true,
    };

    // OnlyOffice precisa de mode="edit" para comentários funcionarem
    const editorMode = mode === "view" ? "view" : "edit";

    // callbackUrl inclui modo para rastreamento de comentários
    const callbackUrl = mode !== "view"
      ? `${apiBaseUrl}/plano-aula/${planoId}/documentos/${docId}/onlyoffice-callback?mode=${mode}&userId=${req.user.userId}&userRole=${req.user.role}`
      : undefined;

    const config = {
      document: {
        fileType: documento.fileName?.endsWith(".doc") ? "doc" : "docx",
        key: `${docId}-${documento.createdAt ? new Date(documento.createdAt).getTime() : docId}`,
        title: documento.fileName || "Documento",
        url: fileUrl,
        permissions,
      },
      documentType: "word",
      editorConfig: {
        mode: editorMode,
        lang: "pt",
        callbackUrl,
        customization: {
          autosave: true,
          forcesave: true,
        },
        user: {
          id: req.user.userId,
          name: "Usuário",
        },
      },
    };

    let token: string | undefined;
    if (jwtSecret) {
      const jwt = await import("jsonwebtoken");
      token = jwt.default.sign(config, jwtSecret);
    }

    return {
      success: true,
      data: {
        documentServerUrl: onlyofficeUrl,
        config: { ...config, token },
      },
    };
  }

  /**
   * GET /plano-aula/:id/documentos/:docId/download
   * Serve o arquivo diretamente do MinIO para o OnlyOffice Document Server.
   * Sem autenticação de sessão — o OnlyOffice não envia JWT ao baixar document.url.
   * Segurança: a URL é gerada server-side e requer UUIDs exatos (planoId + docId).
   */
  @Get(":id/documentos/:docId/download")
  @Public() // Sem autenticação — endpoint server-to-server para o OnlyOffice
  async downloadDocumento(
    @Res() reply: FastifyReply,
    @Param("id") planoId: string,
    @Param("docId") docId: string,
  ) {
    const documento = await this.planoAulaService.getDocumentoById(planoId, docId);
    if (!documento.storageKey) {
      return reply.status(404).send({ error: "Arquivo não encontrado" });
    }

    try {
      const s3Response = await this.storageService.getObject(documento.storageKey);
      const contentType =
        s3Response.ContentType ||
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      reply.header("Content-Type", contentType);
      if (s3Response.ContentLength) {
        reply.header("Content-Length", s3Response.ContentLength);
      }

      return reply.send(s3Response.Body);
    } catch (error) {
      this.logger.error(`Erro ao baixar documento ${docId}: ${error}`);
      return reply.status(500).send({ error: "Erro ao baixar arquivo" });
    }
  }

  /**
   * POST /plano-aula/:id/documentos/:docId/onlyoffice-callback
   * Recebe callback do OnlyOffice após salvamento (server-to-server, sem sessão)
   */
  @Post(":id/documentos/:docId/onlyoffice-callback")
  @Public() // Sem autenticação de sessão — autenticação via JWT do OnlyOffice
  @HttpCode(200) // OnlyOffice espera 200, NestJS POST retorna 201 por padrão
  async onlyofficeCallback(
    @Req() req: FastifyRequest,
    @Param("id") planoId: string,
    @Param("docId") docId: string,
    @Body() body: { status: number; url?: string; key?: string },
  ) {
    // Validar JWT do OnlyOffice no header Authorization
    const jwtSecret = this.configService.get<string>("ONLYOFFICE_JWT_SECRET");
    if (jwtSecret) {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        this.logger.warn("OnlyOffice callback sem header Authorization");
        return { error: 1 };
      }
      try {
        const jwt = await import("jsonwebtoken");
        const token = authHeader.replace("Bearer ", "");
        jwt.default.verify(token, jwtSecret);
      } catch {
        this.logger.warn("OnlyOffice callback com JWT inválido");
        return { error: 1 };
      }
    }

    // Status codes do OnlyOffice:
    // 0 - sem alteração, 1 - editando, 2 - pronto para salvar
    // 3 - erro, 4 - fechado sem mudanças, 6 - forcesave, 7 - erro forcesave
    if (body.status === 2 || body.status === 6) {
      if (!body.url) {
        this.logger.warn(`OnlyOffice callback sem URL para doc ${docId}`);
        return { error: 0 };
      }

      try {
        const documento = await this.planoAulaService.getDocumentoById(
          planoId,
          docId,
        );

        const response = await fetch(body.url);
        if (!response.ok) {
          throw new Error(
            `Falha ao baixar documento do OnlyOffice: ${response.status}`,
          );
        }
        const buffer = Buffer.from(await response.arrayBuffer());

        await this.storageService.replaceFile(
          documento.storageKey!,
          buffer,
          documento.mimeType ||
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          documento.fileName || "documento.docx",
        );

        await this.planoAulaService.atualizarDocumento(docId, {
          fileSize: buffer.length,
          updatedAt: new Date(),
        });

        this.logger.log(`Documento ${docId} atualizado via OnlyOffice`);

        // Rastreamento de comentários: se callback veio do modo "comentar",
        // marcar documento e registrar no histórico
        const callbackMode = (req.query as Record<string, string>)?.mode;
        const callbackUserId = (req.query as Record<string, string>)?.userId;

        if (callbackMode === "comentar" && callbackUserId && body.status === 2) {
          // Registrar apenas no fechamento do editor (status=2), não em cada forcesave (status=6),
          // para evitar múltiplas entradas de histórico para a mesma sessão de comentários
          await this.planoAulaService.marcarTemComentarios(docId);

          const callbackUserRole = (req.query as Record<string, string>)?.userRole;
          const userName = await this.planoAulaService.getUserNameById(callbackUserId);
          const plano = await this.planoAulaService.getPlanoStatusById(planoId);
          await this.historicoService.registrar({
            planoId,
            userId: callbackUserId,
            userName,
            userRole: callbackUserRole || "analista_pedagogico",
            acao: "COMENTARIO_ADICIONADO",
            statusAnterior: null,
            statusNovo: plano?.status || "AGUARDANDO_ANALISTA",
            detalhes: {
              documentoId: docId,
              documentoNome: documento.fileName || "Documento",
            },
          });

          this.logger.log(`Comentário rastreado no documento ${docId}`);
        } else if (callbackMode === "comentar") {
          // Em forcesave (status=6), apenas marcar o documento sem registrar no histórico
          await this.planoAulaService.marcarTemComentarios(docId);
        }
      } catch (error) {
        this.logger.error(`Erro ao salvar callback OnlyOffice: ${error}`);
      }
    }

    return { error: 0 };
  }

  /**
   * POST /plano-aula/:id/documentos/link
   * Adiciona link do YouTube ao plano
   */
  @Post(":id/documentos/link")
  @Roles(...PROFESSORA_ACCESS, ...ANALISTA_ACCESS)
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

    // Verificar se plano existe e usuário tem acesso
    const plano = await this.planoAulaService.getPlanoById(user, planoId);
    const isOwner = plano.user.id === user.userId;
    const isAnalistaUser = ANALISTA_ROLES.includes(user.role as typeof ANALISTA_ROLES[number]);
    if (!isOwner && !isAnalistaUser) {
      throw new BadRequestException({
        code: "NOT_AUTHORIZED",
        message: "Você não tem permissão para anexar documentos a este plano",
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
   * NOTA: Apenas gestão e analista podem excluir documentos.
   * Professoras NÃO têm permissão para excluir documentos após o upload.
   */
  @Delete(":id/documentos/:docId")
  @Roles(...GESTAO_ACCESS, ...ANALISTA_ACCESS)
  async deletarDocumento(
    @Param("id") planoId: string,
    @Param("docId") docId: string,
    @Req() req: { user: UserContext },
  ) {
    const user = req.user;

    // Verificar se plano existe e usuário tem acesso
    await this.planoAulaService.getPlanoById(user, planoId);

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
    const planos = await this.planoAulaService.listarPendentesAnalista(
      req.user,
    );
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
  ) {
    const plano = await this.planoAulaService.devolverComoAnalista(
      req.user,
      id,
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
  @Roles(...GESTAO_ACCESS, ...COORDENADORA_ACCESS)
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
  @Roles(...GESTAO_ACCESS, ...COORDENADORA_ACCESS)
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
      data: result,
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

  /**
   * DELETE /plano-aula/:id
   * Exclui permanentemente um plano de aula
   * Apenas roles de gestão podem excluir
   */
  @Delete(":id")
  @Roles(...GESTAO_ACCESS)
  async deletarPlano(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    await this.planoAulaService.deletarPlano(req.user, id);
    return {
      success: true,
      message: "Plano de aula excluído com sucesso",
    };
  }

  /**
   * POST /plano-aula/documentos/:id/aprovar
   * Aprova um documento individualmente (apenas analista_pedagogico)
   */
  @Post("documentos/:id/aprovar")
  @Roles("analista_pedagogico")
  async aprovarDocumento(
    @Req() req: { user: UserContext },
    @Param("id") documentoId: string,
  ) {
    const documento = await this.planoAulaService.aprovarDocumento(
      req.user,
      documentoId,
    );
    return {
      success: true,
      data: documento,
    };
  }

  /**
   * POST /plano-aula/documentos/:id/desaprovar
   * Desfaz a aprovação de um documento (apenas analista_pedagogico)
   */
  @Post("documentos/:id/desaprovar")
  @Roles("analista_pedagogico")
  async desaprovarDocumento(
    @Req() req: { user: UserContext },
    @Param("id") documentoId: string,
  ) {
    const documento = await this.planoAulaService.desaprovarDocumento(
      req.user,
      documentoId,
    );
    return {
      success: true,
      data: documento,
    };
  }

  /**
   * POST /plano-aula/documentos/:id/imprimir
   * Registra a impressão de um documento aprovado
   */
  @Post("documentos/:id/imprimir")
  @Roles(...VISUALIZAR_ACCESS)
  async imprimirDocumento(
    @Req() req: { user: UserContext },
    @Param("id") documentoId: string,
  ) {
    const documento = await this.planoAulaService.registrarImpressaoDocumento(
      req.user,
      documentoId,
    );
    return {
      success: true,
      data: documento,
    };
  }
}
