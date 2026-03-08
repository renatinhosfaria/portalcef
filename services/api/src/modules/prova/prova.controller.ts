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
import { DocumentosConversaoQueueService } from "../../common/queues/documentos-conversao.queue";
import { StorageService } from "../../common/storage/storage.service";
import {
  type CreateProvaDto,
  createProvaSchema,
  type DashboardProvasQueryDto,
  dashboardProvasQuerySchema,
  type ListarProvasGestaoDto,
  listarProvasGestaoSchema,
  GESTAO_ROLES,
  COORDENADORA_ROLES,
  ANALISTA_ROLES,
  PROFESSORA_ROLES,
} from "./dto/prova.dto";
import { ProvaHistoricoService } from "./prova-historico.service";
import { ProvaService, type UserContext } from "./prova.service";

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

/** Roles que podem visualizar provas (todas que participam do workflow) */
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
 * ProvaController
 *
 * Controller para o workflow de provas com:
 * - Professora: criar, enviar p/ impressao, enviar p/ analise, recuperar
 * - Gestao: imprimir docs, enviar p/ responder, dashboard
 * - Analista: revisar, aprovar/devolver (aprovacao final)
 */
@Controller("prova")
@UseGuards(AuthGuard, RolesGuard)
export class ProvaController {
  private readonly logger = new Logger(ProvaController.name);

  constructor(
    private readonly provaService: ProvaService,
    private readonly storageService: StorageService,
    private readonly historicoService: ProvaHistoricoService,
    private readonly configService: ConfigService,
    private readonly conversaoQueue: DocumentosConversaoQueueService,
  ) {}

  // ============================================
  // Endpoints da Professora
  // ============================================

  /**
   * POST /prova
   * Cria ou retorna prova existente para turma/ciclo
   */
  @Post()
  @Roles(...PROFESSORA_ACCESS)
  async criarProva(
    @Req() req: { user: UserContext },
    @Body() body: CreateProvaDto,
  ) {
    // Validar DTO
    const parsed = createProvaSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dados inválidos",
        errors: parsed.error.errors,
      });
    }

    const provaResult = await this.provaService.criarProva(req.user, parsed.data);
    return {
      success: true,
      data: provaResult,
    };
  }

  /**
   * GET /prova/meus
   * Lista provas do usuário logado
   */
  @Get("meus")
  @Roles(...PROFESSORA_ACCESS)
  async listarMinhasProvas(
    @Req() req: { user: UserContext },
    @Query("cicloId") cicloId?: string,
  ) {
    const provas = await this.provaService.listarMinhasProvas(
      req.user,
      cicloId,
    );
    return {
      success: true,
      data: provas,
    };
  }

  /**
   * GET /prova/:id
   * Busca prova por ID com documentos
   */
  @Get(":id")
  @Roles(...VISUALIZAR_ACCESS)
  async getProvaById(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const provaResult = await this.provaService.getProvaById(req.user, id);
    return {
      success: true,
      data: provaResult,
    };
  }

  /**
   * GET /prova/:id/historico
   * Busca histórico de ações da prova
   */
  @Get(":id/historico")
  @Roles(...VISUALIZAR_ACCESS)
  async getHistorico(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    // Verificar se prova existe e usuário tem acesso
    await this.provaService.getProvaById(req.user, id);

    // Buscar histórico
    const historico = await this.historicoService.buscarPorProva(id);
    return {
      success: true,
      data: historico,
    };
  }

  /**
   * POST /prova/:id/enviar-impressao
   * Envia prova para impressao pela gestao
   */
  @Post(":id/enviar-impressao")
  @Roles(...PROFESSORA_ACCESS)
  async enviarParaImpressao(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const provaResult = await this.provaService.enviarParaImpressao(req.user, id);
    return {
      success: true,
      data: provaResult,
    };
  }

  /**
   * POST /prova/:id/recuperar
   * Recupera prova submetida antes da análise ser iniciada
   */
  @Post(":id/recuperar")
  @Roles(...PROFESSORA_ACCESS)
  async recuperarProva(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const provaResult = await this.provaService.recuperarProva(req.user, id);
    return {
      success: true,
      data: provaResult,
    };
  }

  /**
   * POST /prova/:id/enviar-analise
   * Professora confirma que respondeu e envia para analista
   */
  @Post(":id/enviar-analise")
  @Roles(...PROFESSORA_ACCESS)
  async enviarParaAnalise(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const provaResult = await this.provaService.enviarParaAnalise(req.user, id);
    return {
      success: true,
      data: provaResult,
    };
  }

  /**
   * POST /prova/:id/reenviar-analise
   * Professora reenvia prova devolvida para analista
   */
  @Post(":id/reenviar-analise")
  @Roles(...PROFESSORA_ACCESS)
  async reenviarParaAnalise(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const provaResult = await this.provaService.reenviarParaAnalise(req.user, id);
    return {
      success: true,
      data: provaResult,
    };
  }

  /**
   * POST /prova/:id/documentos/upload
   * Upload de arquivo para a prova (multipart/form-data)
   */
  @Post(":id/documentos/upload")
  @Roles(...PROFESSORA_ACCESS, ...ANALISTA_ACCESS)
  async uploadDocumento(
    @Param("id") provaId: string,
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

    // Verificar se prova existe e usuário tem acesso
    const provaResult = await this.provaService.getProvaById(user, provaId);
    const isOwner = provaResult.user.id === user.userId;
    const isAnalistaUser = ANALISTA_ROLES.includes(
      user.role as (typeof ANALISTA_ROLES)[number],
    );
    if (!isOwner && !isAnalistaUser) {
      throw new BadRequestException({
        code: "NOT_AUTHORIZED",
        message: "Você não tem permissão para anexar documentos a esta prova",
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

      // Verificar se o documento precisa de conversão para PDF (DOC/DOCX)
      const isWord =
        data.mimetype?.includes("word") ||
        data.mimetype?.includes("msword") ||
        data.filename?.match(/\.docx?$/i);
      const previewStatus = isWord ? "PENDENTE" : undefined;

      // Salvar documento no banco via service
      const documento = await this.provaService.adicionarDocumentoUpload(
        provaId,
        {
          tipo: "UPLOAD",
          fileName: uploadResult.name,
          fileKey: uploadResult.key,
          fileUrl: uploadResult.url,
          fileSize: buffer.length,
          mimeType: data.mimetype,
          previewStatus: previewStatus as "PENDENTE" | undefined,
        },
      );

      // Enfileirar conversão DOC/DOCX → PDF para o worker
      if (isWord && documento.id) {
        await this.conversaoQueue.enfileirar({
          documentoId: documento.id,
          planoId: provaId,
          storageKey: uploadResult.key,
          mimeType: data.mimetype,
          fileName: uploadResult.name,
          tabela: "prova_documento",
        });
        this.logger.log(
          `Documento ${documento.id} enfileirado para conversão (prova_documento)`,
        );
      }

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
   * GET /prova/:id/documentos/:docId/editor-config
   * Retorna configuração do OnlyOffice para abrir o editor
   */
  @Get(":id/documentos/:docId/editor-config")
  @Roles(...VISUALIZAR_ACCESS)
  async getEditorConfig(
    @Req() req: { user: UserContext },
    @Param("id") provaId: string,
    @Param("docId") docId: string,
    @Query("mode") mode: string = "view",
  ) {
    if (mode !== "edit" && mode !== "view" && mode !== "comentar") {
      throw new BadRequestException(
        "Mode deve ser 'edit', 'comentar' ou 'view'",
      );
    }

    const documento = await this.provaService.getDocumentoById(provaId, docId);

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

    const apiBaseUrl =
      this.configService.get<string>("NEXT_PUBLIC_API_URL") ||
      "https://www.portalcef.com.br/api";
    const fileUrl = `${apiBaseUrl}/prova/${provaId}/documentos/${docId}/download`;

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
    const callbackUrl =
      mode !== "view"
        ? `${apiBaseUrl}/prova/${provaId}/documentos/${docId}/onlyoffice-callback?mode=${mode}&userId=${req.user.userId}&userRole=${req.user.role}`
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
   * GET /prova/:id/documentos/:docId/download
   * Serve o arquivo diretamente do MinIO para o OnlyOffice Document Server.
   */
  @Get(":id/documentos/:docId/download")
  @Public()
  async downloadDocumento(
    @Res() reply: FastifyReply,
    @Param("id") provaId: string,
    @Param("docId") docId: string,
  ) {
    const documento = await this.provaService.getDocumentoById(provaId, docId);
    if (!documento.storageKey) {
      return reply.status(404).send({ error: "Arquivo não encontrado" });
    }

    try {
      const s3Response = await this.storageService.getObject(
        documento.storageKey,
      );
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
   * POST /prova/:id/documentos/:docId/onlyoffice-callback
   * Recebe callback do OnlyOffice após salvamento
   */
  @Post(":id/documentos/:docId/onlyoffice-callback")
  @Public()
  @HttpCode(200)
  async onlyofficeCallback(
    @Req() req: FastifyRequest,
    @Param("id") provaId: string,
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

    if (body.status === 2 || body.status === 6) {
      if (!body.url) {
        this.logger.warn(`OnlyOffice callback sem URL para doc ${docId}`);
        return { error: 0 };
      }

      try {
        const documento = await this.provaService.getDocumentoById(
          provaId,
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

        await this.provaService.atualizarDocumento(docId, {
          fileSize: buffer.length,
          updatedAt: new Date(),
        });

        this.logger.log(`Documento ${docId} atualizado via OnlyOffice`);

        // Rastreamento de comentários
        const callbackMode = (req.query as Record<string, string>)?.mode;
        const callbackUserId = (req.query as Record<string, string>)?.userId;

        if (
          callbackMode === "comentar" &&
          callbackUserId &&
          body.status === 2
        ) {
          await this.provaService.marcarTemComentarios(docId);

          const callbackUserRole = (req.query as Record<string, string>)
            ?.userRole;
          const userName =
            await this.provaService.getUserNameById(callbackUserId);
          const provaStatus =
            await this.provaService.getProvaStatusById(provaId);
          await this.historicoService.registrar({
            provaId,
            userId: callbackUserId,
            userName,
            userRole: callbackUserRole || "analista_pedagogico",
            acao: "COMENTARIO_ADICIONADO",
            statusAnterior: null,
            statusNovo: provaStatus?.status || "AGUARDANDO_ANALISTA",
            detalhes: {
              documentoId: docId,
              documentoNome: documento.fileName || "Documento",
            },
          });

          this.logger.log(`Comentário rastreado no documento ${docId}`);
        } else if (callbackMode === "comentar") {
          await this.provaService.marcarTemComentarios(docId);
        }
      } catch (error) {
        this.logger.error(`Erro ao salvar callback OnlyOffice: ${error}`);
      }
    }

    return { error: 0 };
  }

  /**
   * POST /prova/:id/documentos/link
   * Adiciona link do YouTube à prova
   */
  @Post(":id/documentos/link")
  @Roles(...PROFESSORA_ACCESS, ...ANALISTA_ACCESS)
  async adicionarLinkYouTube(
    @Param("id") provaId: string,
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

    // Verificar se prova existe e usuário tem acesso
    const provaResult = await this.provaService.getProvaById(user, provaId);
    const isOwner = provaResult.user.id === user.userId;
    const isAnalistaUser = ANALISTA_ROLES.includes(
      user.role as (typeof ANALISTA_ROLES)[number],
    );
    if (!isOwner && !isAnalistaUser) {
      throw new BadRequestException({
        code: "NOT_AUTHORIZED",
        message: "Você não tem permissão para anexar documentos a esta prova",
      });
    }

    const documento = await this.provaService.adicionarDocumentoLink(provaId, {
      tipo: "YOUTUBE",
      url: body.url,
      titulo: body.titulo,
    });

    return {
      success: true,
      data: documento,
    };
  }

  /**
   * DELETE /prova/:id/documentos/:docId
   * Remove documento da prova
   */
  @Delete(":id/documentos/:docId")
  @Roles(...GESTAO_ACCESS, ...ANALISTA_ACCESS)
  async deletarDocumento(
    @Param("id") provaId: string,
    @Param("docId") docId: string,
    @Req() req: { user: UserContext },
  ) {
    const user = req.user;

    // Verificar se prova existe e usuário tem acesso
    await this.provaService.getProvaById(user, provaId);

    await this.provaService.removerDocumento(provaId, docId);

    return {
      success: true,
      message: "Documento removido com sucesso",
    };
  }

  // ============================================
  // Endpoints do Analista
  // ============================================

  /**
   * GET /prova/analista/pendentes
   * Lista provas pendentes para analista
   */
  @Get("analista/pendentes")
  @Roles(...ANALISTA_ACCESS)
  async listarPendentesAnalista(@Req() req: { user: UserContext }) {
    const provas = await this.provaService.listarPendentesAnalista(req.user);
    return {
      success: true,
      data: provas,
    };
  }

  /**
   * POST /prova/:id/analista/aprovar
   * Aprova prova como analista
   */
  @Post(":id/analista/aprovar")
  @Roles(...ANALISTA_ACCESS)
  async aprovarComoAnalista(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const provaResult = await this.provaService.aprovarComoAnalista(
      req.user,
      id,
    );
    return {
      success: true,
      data: provaResult,
    };
  }

  /**
   * POST /prova/:id/analista/devolver
   * Devolve prova como analista
   */
  @Post(":id/analista/devolver")
  @Roles(...ANALISTA_ACCESS)
  async devolverComoAnalista(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const provaResult = await this.provaService.devolverComoAnalista(
      req.user,
      id,
    );
    return {
      success: true,
      data: provaResult,
    };
  }

  // ============================================
  // Endpoints de Gestão
  // ============================================

  /**
   * POST /prova/:id/enviar-responder
   * Gestao confirma que imprimiu e envia para professora responder
   */
  @Post(":id/enviar-responder")
  @Roles(...GESTAO_ACCESS, ...COORDENADORA_ACCESS)
  async enviarParaResponder(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const provaResult = await this.provaService.enviarParaResponder(req.user, id);
    return {
      success: true,
      data: provaResult,
    };
  }

  /**
   * GET /prova/dashboard
   * Dashboard com estatísticas por status e segmento
   */
  @Get("dashboard")
  @Roles(...GESTAO_ACCESS, ...COORDENADORA_ACCESS)
  async getDashboard(
    @Req() req: { user: UserContext },
    @Query() query: DashboardProvasQueryDto,
  ) {
    // Validar query params
    const parsed = dashboardProvasQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Parâmetros inválidos",
        errors: parsed.error.errors,
      });
    }

    const dashboard = await this.provaService.getDashboard(
      req.user,
      parsed.data.unitId,
      parsed.data.cicloId,
    );
    return {
      success: true,
      data: dashboard,
    };
  }

  /**
   * GET /prova/gestao/listar
   * Lista provas com filtros e paginação para gestão
   */
  @Get("gestao/listar")
  @Roles(...GESTAO_ACCESS, ...COORDENADORA_ACCESS)
  async listarProvasGestao(
    @Req() req: { user: UserContext },
    @Query() query: ListarProvasGestaoDto,
  ) {
    const parsed = listarProvasGestaoSchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Parâmetros inválidos",
        errors: parsed.error.errors,
      });
    }

    const result = await this.provaService.listarProvasGestao(
      req.user,
      parsed.data,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * DELETE /prova/:id
   * Exclui permanentemente uma prova
   * Apenas roles de gestão podem excluir
   */
  @Delete(":id")
  @Roles(...GESTAO_ACCESS)
  async deletarProva(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    await this.provaService.deletarProva(req.user, id);
    return {
      success: true,
      message: "Prova excluída com sucesso",
    };
  }

  /**
   * POST /prova/documentos/:id/aprovar
   * Aprova um documento individualmente (apenas analista_pedagogico)
   */
  @Post("documentos/:id/aprovar")
  @Roles("analista_pedagogico")
  async aprovarDocumento(
    @Req() req: { user: UserContext },
    @Param("id") documentoId: string,
  ) {
    const documento = await this.provaService.aprovarDocumento(
      req.user,
      documentoId,
    );
    return {
      success: true,
      data: documento,
    };
  }

  /**
   * POST /prova/documentos/:id/desaprovar
   * Desfaz a aprovação de um documento (apenas analista_pedagogico)
   */
  @Post("documentos/:id/desaprovar")
  @Roles("analista_pedagogico")
  async desaprovarDocumento(
    @Req() req: { user: UserContext },
    @Param("id") documentoId: string,
  ) {
    const documento = await this.provaService.desaprovarDocumento(
      req.user,
      documentoId,
    );
    return {
      success: true,
      data: documento,
    };
  }

  /**
   * POST /prova/documentos/:id/imprimir
   * Registra a impressão de um documento aprovado
   */
  @Post("documentos/:id/imprimir")
  @Roles(...VISUALIZAR_ACCESS)
  async imprimirDocumento(
    @Req() req: { user: UserContext },
    @Param("id") documentoId: string,
  ) {
    const documento = await this.provaService.registrarImpressaoDocumento(
      req.user,
      documentoId,
    );
    return {
      success: true,
      data: documento,
    };
  }
}
