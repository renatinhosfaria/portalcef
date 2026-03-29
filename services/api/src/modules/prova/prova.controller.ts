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
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyReply, FastifyRequest } from "fastify";

import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { SharePointService } from "../../common/sharepoint/sharepoint.service";
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
    private readonly sharePointService: SharePointService,
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
   * GET /prova/:id/documentos/:docId/editar-word
   * Gera URL para edição via Word desktop (SharePoint)
   */
  @Get(":id/documentos/:docId/editar-word")
  @Roles(...PROFESSORA_ACCESS, ...ANALISTA_ACCESS)
  async editarWord(
    @Req() req: { user: UserContext },
    @Param("id") provaId: string,
    @Param("docId") docId: string,
  ) {
    if (!this.sharePointService.isConfigurado()) {
      throw new BadRequestException({
        code: "SHAREPOINT_NOT_CONFIGURED",
        message: "Edição via Word não está disponível. SharePoint não configurado.",
      });
    }

    const user = req.user;
    const provaResult = await this.provaService.getProvaById(user, provaId);
    const isOwner = provaResult.user.id === user.userId;
    const isAnalistaUser = ANALISTA_ROLES.includes(
      user.role as (typeof ANALISTA_ROLES)[number],
    );
    if (!isOwner && !isAnalistaUser) {
      throw new BadRequestException({
        code: "NOT_AUTHORIZED",
        message: "Você não tem permissão para editar documentos desta prova",
      });
    }

    const documento = await this.provaService.getDocumentoById(provaId, docId);

    if (!documento.storageKey) {
      throw new BadRequestException("Documento sem arquivo associado");
    }

    const isWord =
      documento.mimeType?.includes("word") ||
      documento.mimeType?.includes("msword") ||
      documento.fileName?.match(/\.docx?$/i);
    if (!isWord) {
      throw new BadRequestException(
        "Apenas documentos .doc/.docx podem ser editados no Word",
      );
    }

    // Verificar se já existe uma edição ativa
    if (documento.sharepointItemId && documento.editandoDesde) {
      const expirado = new Date();
      expirado.setHours(expirado.getHours() - 2);

      if (documento.editandoDesde > expirado) {
        // Edição ainda ativa — retornar URL existente
        const msWordUrl = this.sharePointService.construirMsWordUrl(
          documento.sharepointEditUrl!,
        );
        return {
          success: true,
          data: { url: msWordUrl },
        };
      }

      // Edição expirada — limpar antes de criar nova
      await this.sharePointService.removerArquivo(documento.sharepointItemId);
    }

    // Upload para SharePoint e criar link de compartilhamento
    const itemId = await this.sharePointService.uploadParaSharePoint(
      documento.storageKey,
      documento.fileName || "documento.docx",
      docId,
    );

    const { url } = await this.sharePointService.criarLinkCompartilhamento(itemId);

    // Atualizar documento com dados do SharePoint
    await this.provaService.atualizarDocumento(docId, {
      sharepointItemId: itemId,
      sharepointEditUrl: url,
      editandoDesde: new Date(),
    });

    // Gerar URL ms-word: para abrir diretamente no Word desktop
    const msWordUrl = this.sharePointService.construirMsWordUrl(url);

    return {
      success: true,
      data: { url: msWordUrl },
    };
  }

  /**
   * POST /prova/:id/documentos/:docId/atualizar
   * Re-upload manual de documento (fallback quando ms-word: não funciona)
   */
  @Post(":id/documentos/:docId/atualizar")
  @Roles(...PROFESSORA_ACCESS, ...ANALISTA_ACCESS)
  async atualizarDocumento(
    @Param("id") provaId: string,
    @Param("docId") docId: string,
    @Req() req: FastifyMultipartRequest,
  ) {
    if (!req.isMultipart()) {
      throw new BadRequestException({
        code: "INVALID_REQUEST",
        message: "Request deve ser multipart/form-data",
      });
    }

    const documento = await this.provaService.getDocumentoById(provaId, docId);

    if (!documento.storageKey) {
      throw new BadRequestException("Documento sem arquivo associado");
    }

    const data = await req.file();
    if (!data) {
      throw new BadRequestException({
        code: "NO_FILE",
        message: "Nenhum arquivo enviado",
      });
    }

    // Validar tipo de arquivo (apenas Word)
    const wordMimeTypes = [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!wordMimeTypes.includes(data.mimetype)) {
      throw new BadRequestException({
        code: "INVALID_FILE_TYPE",
        message: "Apenas arquivos .doc/.docx são permitidos para atualização",
      });
    }

    const buffer = await data.toBuffer();
    const MAX_SIZE = 100 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      throw new BadRequestException({
        code: "FILE_TOO_LARGE",
        message: "Arquivo muito grande. Tamanho máximo: 100MB",
      });
    }

    try {
      await this.storageService.replaceFile(
        documento.storageKey,
        buffer,
        data.mimetype,
        data.filename || documento.fileName || "documento.docx",
      );

      await this.provaService.atualizarDocumento(docId, {
        fileSize: buffer.length,
        updatedAt: new Date(),
      });

      return {
        success: true,
        message: "Documento atualizado com sucesso",
      };
    } catch (error) {
      this.logger.error(
        `Erro ao atualizar documento ${docId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new InternalServerErrorException({
        code: "UPDATE_FAILED",
        message: "Erro ao atualizar o arquivo",
      });
    }
  }

  /**
   * GET /prova/:id/documentos/:docId/editor-config
   * Retorna configuração do OnlyOffice para visualização (somente leitura)
   */
  @Get(":id/documentos/:docId/editor-config")
  @Roles(...VISUALIZAR_ACCESS)
  async getEditorConfig(
    @Req() req: { user: UserContext },
    @Param("id") provaId: string,
    @Param("docId") docId: string,
  ) {
    const documento = await this.provaService.getDocumentoById(provaId, docId);

    if (!documento.storageKey) {
      throw new BadRequestException("Documento sem arquivo associado");
    }

    const isWord =
      documento.mimeType?.includes("word") ||
      documento.mimeType?.includes("msword");
    if (!isWord) {
      throw new BadRequestException(
        "Apenas documentos .doc/.docx podem ser abertos no visualizador",
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

    const config = {
      document: {
        fileType: documento.fileName?.endsWith(".doc") ? "doc" : "docx",
        key: `${docId}-${documento.updatedAt ? new Date(documento.updatedAt).getTime() : docId}`,
        title: documento.fileName || "Documento",
        url: fileUrl,
        permissions: {
          edit: false,
          comment: false,
          download: true,
          print: true,
        },
      },
      documentType: "word",
      editorConfig: {
        mode: "view",
        lang: "pt",
        customization: {
          autosave: false,
          forcesave: false,
          plugins: false,
          compactToolbar: true,
          hideRightMenu: true,
          hideRulers: true,
          spellcheck: false,
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
   * Serve o arquivo diretamente do MinIO
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
