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
import { FastifyReply, FastifyRequest } from "fastify";

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
  // Nota: lógica espelhada em PlanoAulaController.editarWord — manter sincronizados
  @Get(":id/documentos/:docId/editar-word")
  @Roles(...ANALISTA_ACCESS)
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
    await this.provaService.getProvaById(user, provaId);

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
    let itemId: string | null = null;
    if (documento.sharepointItemId && documento.editandoDesde) {
      const expirado = this.sharePointService.calcularLimiteEdicao();

      if (documento.editandoDesde > expirado) {
        if (documento.sharepointEditUrl) {
          // Edição ainda ativa — retornar URL existente
          const msWordUrl = this.sharePointService.construirMsWordUrl(
            documento.sharepointEditUrl,
          );
          return {
            success: true,
            data: { url: msWordUrl },
          };
        }
        // Item existe (subido pela visualização) mas sem link edit — reusar item
        itemId = documento.sharepointItemId;
      } else {
        // Edição expirada — limpar antes de criar nova (best-effort, 1 tentativa)
        await this.sharePointService.removerArquivo(documento.sharepointItemId, 1);
      }
    }

    if (!itemId) {
      // Upload para SharePoint
      itemId = await this.sharePointService.uploadParaSharePoint(
        documento.storageKey,
        documento.fileName || "documento.docx",
        docId,
      );
    }

    const { directUrl } = await this.sharePointService.criarLinkCompartilhamento(
      itemId,
      docId,
      documento.fileName || "documento.docx",
    );

    // Atualizar documento com dados do SharePoint
    await this.provaService.atualizarDocumento(docId, {
      sharepointItemId: itemId,
      sharepointEditUrl: directUrl,
      editandoDesde: new Date(),
    });

    // Gerar URL ms-word: usando URL direta do arquivo no SharePoint
    const msWordUrl = this.sharePointService.construirMsWordUrl(directUrl);

    return {
      success: true,
      data: { url: msWordUrl },
    };
  }

  /**
   * GET /prova/:id/documentos/:docId/visualizar-sharepoint
   * Retorna URL embeddable do Office para Web para visualização fiel de .docx
   */
  // Nota: lógica espelhada em PlanoAulaController.visualizarSharePoint — manter sincronizados
  @Get(":id/documentos/:docId/visualizar-sharepoint")
  @Roles(...VISUALIZAR_ACCESS)
  async visualizarSharePoint(
    @Req() req: { user: UserContext },
    @Param("id") provaId: string,
    @Param("docId") docId: string,
  ) {
    if (!this.sharePointService.isConfigurado()) {
      return { success: true, data: { disponivel: false } };
    }

    const user = req.user;
    await this.provaService.getProvaById(user, provaId);

    const documento = await this.provaService.getDocumentoById(provaId, docId);

    const isWord =
      documento.mimeType?.includes("word") ||
      documento.mimeType?.includes("msword") ||
      documento.fileName?.match(/\.docx?$/i);

    if (!isWord || !documento.storageKey) {
      return { success: true, data: { disponivel: false } };
    }

    // Reusar item existente se não expirou
    let itemId: string | null = null;
    let reutilizouItemExistente = false;
    if (documento.sharepointItemId && documento.editandoDesde) {
      const expirado = this.sharePointService.calcularLimiteEdicao();
      if (documento.editandoDesde > expirado) {
        itemId = documento.sharepointItemId;
        reutilizouItemExistente = true;
      }
    }

    if (!itemId) {
      itemId = await this.sharePointService.uploadParaSharePoint(
        documento.storageKey,
        documento.fileName || "documento.docx",
        docId,
      );

      // Persistir itemId para permitir reuso e garantir cleanup
      await this.provaService.atualizarDocumento(docId, {
        sharepointItemId: itemId,
        sharepointEditUrl: null,
        editandoDesde: new Date(),
      });
    }

    let embedUrl: string;
    try {
      ({ embedUrl } = await this.sharePointService.criarLinkVisualizacao(itemId));
    } catch (error) {
      if (
        !reutilizouItemExistente ||
        !this.sharePointService.isItemNaoEncontrado(error)
      ) {
        throw error;
      }

      this.logger.warn(
        `[visualizarSharePoint] Item ${itemId} do documento ${docId} não existe mais no SharePoint; reenviando arquivo`,
      );

      await this.provaService.atualizarDocumento(docId, {
        sharepointItemId: null,
        sharepointEditUrl: null,
        editandoDesde: null,
      });

      itemId = await this.sharePointService.uploadParaSharePoint(
        documento.storageKey,
        documento.fileName || "documento.docx",
        docId,
      );

      await this.provaService.atualizarDocumento(docId, {
        sharepointItemId: itemId,
        sharepointEditUrl: null,
        editandoDesde: new Date(),
      });

      ({ embedUrl } = await this.sharePointService.criarLinkVisualizacao(itemId));
    }

    return {
      success: true,
      data: { disponivel: true, embedUrl },
    };
  }

  /**
   * POST /prova/:id/documentos/:docId/sincronizar-word
   * Sincroniza alterações do SharePoint de volta ao MinIO
   */
  @Post(":id/documentos/:docId/sincronizar-word")
  @Roles(...ANALISTA_ACCESS)
  async sincronizarWord(
    @Req() req: { user: UserContext },
    @Param("id") provaId: string,
    @Param("docId") docId: string,
  ) {
    const user = req.user;
    await this.provaService.getProvaById(user, provaId);

    const documento = await this.provaService.getDocumentoById(provaId, docId);

    if (!documento.sharepointItemId) {
      throw new BadRequestException({
        code: "NO_SHAREPOINT_SESSION",
        message: "Nenhuma edição ativa no SharePoint para este documento",
      });
    }

    if (!documento.storageKey) {
      throw new BadRequestException("Documento sem arquivo associado");
    }

    if (!documento.editandoDesde) {
      throw new BadRequestException("Estado inconsistente: edição sem data de início");
    }

    const foiModificado = await this.sharePointService.foiModificadoApos(
      documento.sharepointItemId,
      documento.editandoDesde,
    );

    if (foiModificado) {
      const buffer = await this.sharePointService.baixarArquivo(
        documento.sharepointItemId,
      );

      await this.storageService.replaceFile(
        documento.storageKey,
        buffer,
        documento.mimeType ||
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        documento.fileName || "documento.docx",
      );

      this.logger.log(
        `[sincronizarWord] Documento ${docId} sincronizado do SharePoint (${buffer.length} bytes)`,
      );
    }

    await this.sharePointService.removerArquivo(documento.sharepointItemId);

    await this.provaService.atualizarDocumento(docId, {
      sharepointItemId: null,
      sharepointEditUrl: null,
      editandoDesde: null,
      updatedAt: new Date(),
    });

    return {
      success: true,
      data: { sincronizado: foiModificado },
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

    const user = req.user;
    const provaResult = await this.provaService.getProvaById(user, provaId);
    const isOwner = provaResult.user.id === user.userId;
    const isAnalistaUser = ANALISTA_ROLES.includes(
      user.role as (typeof ANALISTA_ROLES)[number],
    );
    if (!isOwner && !isAnalistaUser) {
      throw new BadRequestException({
        code: "NOT_AUTHORIZED",
        message: "Você não tem permissão para atualizar documentos desta prova",
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
   * GET /prova/:id/documentos/:docId/download
   * Serve o arquivo diretamente do MinIO para visualização no browser (docx-preview).
   */
  @Get(":id/documentos/:docId/download")
  @Roles(...VISUALIZAR_ACCESS)
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
