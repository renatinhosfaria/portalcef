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
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";

import { ExactRoles, Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { ExcluirDocumentoDto } from "../../common/dto/excluir-documento.dto";
import { SharePointService } from "../../common/sharepoint/sharepoint.service";
import { StorageService } from "../../common/storage/storage.service";
import {
  LIMITE_UPLOAD_ARQUIVO_BYTES,
  MENSAGEM_ARQUIVO_GRANDE,
} from "../../common/upload-limits";
import { PlanejamentoObservabilidadeService } from "../planejamento-observabilidade/planejamento-observabilidade.service";
import type { PlanejamentoObservabilidadeEventoEntrada } from "../planejamento-observabilidade/planejamento-observabilidade.types";
import {
  CreateRelatorioDto,
  ListarRelatoriosGestaoDto,
} from "./dto/relatorio.dto";
import { RelatorioHistoricoService } from "./relatorio-historico.service";
import { RelatorioService, type UserContext } from "./relatorio.service";

// ============================================
// Types
// ============================================

interface FastifyMultipartRequest extends FastifyRequest {
  isMultipart: () => boolean;
  file: () => Promise<MultipartFile>;
  user: UserContext;
  correlationId?: string;
}

type RequestComUsuario = {
  user: UserContext;
  correlationId?: string;
};

type DocumentoObservabilidade = {
  id: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
};

// ============================================
// Role Arrays para Guards
// ============================================

/** Roles de professoras com acesso ao módulo */
const PROFESSORA_ACCESS = ["professora", "auxiliar_sala"] as const;

/** Role de analista pedagógica */
const ANALISTA_ACCESS = ["analista_pedagogico"] as const;

/** Roles de coordenadora (e gestão que aprova) */
const COORDENADORA_ACCESS = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "coordenadora_geral",
  "coordenadora_bercario",
  "coordenadora_infantil",
] as const;

/** Roles de gestão (visualização ampla e configuração) */
const GESTAO_ACCESS = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_geral",
  "coordenadora_bercario",
  "coordenadora_infantil",
  "analista_pedagogico",
] as const;

/** Roles que podem visualizar relatórios (workflow inteiro) */
const VISUALIZAR_ACCESS = [
  ...PROFESSORA_ACCESS,
  ...ANALISTA_ACCESS,
  ...COORDENADORA_ACCESS,
] as const;

/** Roles que podem editar Word (professora + analista) */
const WORD_ACCESS = [
  ...PROFESSORA_ACCESS,
  ...ANALISTA_ACCESS,
] as const;

/** Todos os perfis que podem acessar o módulo de relatórios. */
const DOCUMENTO_ACCESS = [...PROFESSORA_ACCESS, ...GESTAO_ACCESS] as const;

// ============================================
// Controller
// ============================================

/**
 * RelatorioController
 *
 * Controller para o workflow de relatórios semestrais (BERCARIO e INFANTIL):
 * - Professora: criar, submeter, anexar documentos
 * - Analista: revisar, aprovar/devolver, gerenciar documentos
 * - Coordenadora: aprovação final ou devolução
 * - Gestão: dashboard e listagens
 *
 * O isolamento de tenant usa o pipeline padrão AuthGuard -> RolesGuard ->
 * TenantGuard. O service reforça as validações por unidade e ownership.
 */
@Controller("relatorio")
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
export class RelatorioController {
  private readonly logger = new Logger(RelatorioController.name);

  constructor(
    private readonly relatorioService: RelatorioService,
    private readonly storageService: StorageService,
    private readonly historicoService: RelatorioHistoricoService,
    private readonly sharePointService: SharePointService,
    private readonly observabilidadeService: PlanejamentoObservabilidadeService,
  ) {}

  private registrarObservabilidade(
    evento: PlanejamentoObservabilidadeEventoEntrada,
  ): void {
    try {
      void this.observabilidadeService.registrarEvento(evento).catch(() => undefined);
    } catch {
      return;
    }
  }

  private criarArquivoObservabilidade(
    relatorioId: string,
    documento: DocumentoObservabilidade,
  ) {
    return {
      relatorioId,
      documentoId: documento.id,
      nome: documento.fileName,
      tipo: documento.mimeType,
      tamanhoBytes: documento.fileSize,
    };
  }

  private registrarSharePointWord(params: {
    req: RequestComUsuario;
    relatorioId: string;
    documento: DocumentoObservabilidade;
    etapa: string;
    duracaoMs: number;
    detalhes?: Record<string, unknown>;
  }): void {
    this.registrarObservabilidade({
      origem: "sharepoint",
      evento: "sharepoint_word",
      nivel: "info",
      correlationId: params.req.correlationId,
      usuario: this.observabilidadeService.criarUsuarioDoRequest(params.req.user),
      arquivo: this.criarArquivoObservabilidade(
        params.relatorioId,
        params.documento,
      ),
      detalhes: {
        etapa: params.etapa,
        duracaoMs: params.duracaoMs,
        ...params.detalhes,
      },
    });
  }

  private registrarAcaoArquivo(params: {
    req?: RequestComUsuario;
    relatorioId: string;
    documento: DocumentoObservabilidade;
    acao: string;
    status: number;
    duracaoMs: number;
    nivel?: "info" | "error";
  }): void {
    this.registrarObservabilidade({
      origem: "storage",
      evento: "arquivo_acao",
      nivel: params.nivel ?? "info",
      correlationId: params.req?.correlationId,
      usuario: this.observabilidadeService.criarUsuarioDoRequest(params.req?.user),
      arquivo: this.criarArquivoObservabilidade(
        params.relatorioId,
        params.documento,
      ),
      detalhes: {
        acao: params.acao,
        status: params.status,
        duracaoMs: params.duracaoMs,
      },
    });
  }

  // ============================================
  // Endpoints da Professora
  // ============================================

  /**
   * POST /relatorio
   * Cria (ou retorna existente) relatório para turma/semestre
   */
  @Post()
  @Roles(...PROFESSORA_ACCESS)
  async criar(
    @Req() req: { user: UserContext },
    @Body() body: CreateRelatorioDto,
  ) {
    const relatorio = await this.relatorioService.criar(body, req.user);
    return {
      success: true,
      data: relatorio,
    };
  }

  /**
   * GET /relatorio
   * Lista relatórios da professora autenticada
   */
  @Get()
  @Roles(...PROFESSORA_ACCESS)
  async listarMeusRelatorios(@Req() req: { user: UserContext }) {
    const relatorios = await this.relatorioService.listarMeusRelatorios(
      req.user,
    );
    return {
      success: true,
      data: relatorios,
    };
  }

  /**
   * GET /relatorio/tem-turma-infantil
   * Verifica se a professora tem alguma turma BERCARIO ou INFANTIL
   * IMPORTANTE: precisa vir ANTES de /:id para não ser capturado como parâmetro.
   */
  @Get("tem-turma-infantil")
  @Roles(...PROFESSORA_ACCESS)
  async temTurmaInfantil(@Req() req: { user: UserContext }) {
    const temInfantil = await this.relatorioService.verificarTurmaInfantil(
      req.user.userId,
      req.user.unitId ?? "",
    );
    return {
      success: true,
      data: { temInfantil },
    };
  }

  // ============================================
  // Endpoints do Analista
  // ============================================

  /**
   * GET /relatorio/analise/pendentes
   * Lista relatórios pendentes para a analista
   */
  @Get("analise/pendentes")
  @Roles(...ANALISTA_ACCESS)
  async listarPendentesAnalista(@Req() req: { user: UserContext }) {
    const relatorios = await this.relatorioService.listarPendentesAnalista(
      req.user,
    );
    return {
      success: true,
      data: relatorios,
    };
  }

  // ============================================
  // Endpoints de Gestão
  // ============================================

  /**
   * GET /relatorio/gestao/dashboard
   * Dashboard com contagens por status
   */
  @Get("gestao/dashboard")
  @Roles(...GESTAO_ACCESS)
  async getDashboardGestao(@Req() req: { user: UserContext }) {
    const dashboard = await this.relatorioService.getDashboardGestao(req.user);
    return {
      success: true,
      data: dashboard,
    };
  }

  /**
   * GET /relatorio/gestao/lista
   * Lista relatórios para a gestão com filtros opcionais
   */
  @Get("gestao/lista")
  @Roles(...GESTAO_ACCESS)
  async listarGestao(
    @Req() req: { user: UserContext },
    @Query() query: ListarRelatoriosGestaoDto,
  ) {
    const result = await this.relatorioService.listarGestao(req.user, query);
    return {
      success: true,
      data: result,
    };
  }

  // ============================================
  // Endpoints com parâmetro :id
  // ============================================

  /**
   * GET /relatorio/:id
   * Busca relatório por ID com documentos
   */
  @Get(":id")
  @Roles(...VISUALIZAR_ACCESS)
  async buscarPorId(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const relatorio = await this.relatorioService.buscarPorId(id, req.user);
    return {
      success: true,
      data: relatorio,
    };
  }

  /**
   * GET /relatorio/:id/historico
   * Busca histórico de ações do relatório
   */
  @Get(":id/historico")
  @Roles(...VISUALIZAR_ACCESS)
  async getHistorico(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    // Verificar se relatório existe e usuário tem acesso
    await this.relatorioService.buscarPorId(id, req.user);

    const historico = await this.historicoService.buscarPorRelatorio(id);
    return {
      success: true,
      data: historico,
    };
  }

  /**
   * POST /relatorio/:id/submeter
   * Submete relatório para análise
   */
  @Post(":id/submeter")
  @Roles(...PROFESSORA_ACCESS)
  async submeter(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const relatorio = await this.relatorioService.submeter(id, req.user);
    return {
      success: true,
      data: relatorio,
    };
  }

  /**
   * POST /relatorio/:id/recuperar
   * Recupera relatório submetido antes da análise iniciar
   */
  @Post(":id/recuperar")
  @Roles(...PROFESSORA_ACCESS)
  async recuperar(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const relatorio = await this.relatorioService.recuperar(id, req.user);
    return {
      success: true,
      data: relatorio,
    };
  }

  // ============================================
  // Documentos - upload, link, atualização, remoção
  // ============================================

  /**
   * POST /relatorio/:id/documento/upload
   * Upload de arquivo para o relatório (multipart/form-data)
   */
  @Post(":id/documento/upload")
  @Roles(...PROFESSORA_ACCESS)
  async adicionarDocumentoUpload(
    @Param("id") relatorioId: string,
    @Req() req: FastifyMultipartRequest,
  ) {
    const inicio = Date.now();

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

    const buffer = await data.toBuffer();
    if (buffer.length > LIMITE_UPLOAD_ARQUIVO_BYTES) {
      throw new BadRequestException({
        code: "FILE_TOO_LARGE",
        message: MENSAGEM_ARQUIVO_GRANDE,
      });
    }

    try {
      // Upload para MinIO
      const uploadResult = await this.storageService.uploadFile(data);

      // Persistir documento via service
      const documento = await this.relatorioService.adicionarDocumentoUpload(
        relatorioId,
        {
          fileName: uploadResult.name,
          storageKey: uploadResult.key,
          url: uploadResult.url,
          fileSize: buffer.length,
          mimeType: data.mimetype,
        },
        user,
      );

      this.registrarAcaoArquivo({
        req,
        relatorioId,
        documento,
        acao: "upload",
        status: 201,
        duracaoMs: Date.now() - inicio,
      });

      return {
        success: true,
        data: documento,
      };
    } catch (error) {
      this.logger.error(
        `Erro ao fazer upload: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new InternalServerErrorException({
        code: "UPLOAD_FAILED",
        message: "Erro ao fazer upload do arquivo",
      });
    }
  }

  /**
   * POST /relatorio/:id/documento/youtube
   * Adiciona link do YouTube ao relatório
   */
  @Post(":id/documento/youtube")
  @Roles(...PROFESSORA_ACCESS)
  async adicionarYoutube(
    @Param("id") relatorioId: string,
    @Req() req: { user: UserContext },
    @Body() body: { url: string; titulo?: string },
  ) {
    if (!body.url) {
      throw new BadRequestException({
        code: "NO_URL",
        message: "URL é obrigatória",
      });
    }

    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    if (!youtubeRegex.test(body.url)) {
      throw new BadRequestException({
        code: "INVALID_URL",
        message: "URL deve ser um link válido do YouTube",
      });
    }

    const documento = await this.relatorioService.adicionarYoutube(
      relatorioId,
      { url: body.url, titulo: body.titulo },
      req.user,
    );

    return {
      success: true,
      data: documento,
    };
  }

  /**
   * PATCH /relatorio/:id/documento/:docId
   * Atualiza campos editáveis de um documento.
   */
  @Patch(":id/documento/:docId")
  @Roles(...PROFESSORA_ACCESS, ...ANALISTA_ACCESS)
  async atualizarDocumento(
    @Param("id") relatorioId: string,
    @Param("docId") docId: string,
    @Req() req: { user: UserContext },
    @Body() body: { fileSize?: number },
  ) {
    // Verificar acesso ao relatório
    await this.relatorioService.buscarPorId(relatorioId, req.user);

    // Garantir que o documento pertence ao relatório
    await this.relatorioService.getDocumentoById(relatorioId, docId);

    await this.relatorioService.atualizarDocumento(docId, {
      fileSize: body.fileSize,
      updatedAt: new Date(),
    });

    return {
      success: true,
      message: "Documento atualizado com sucesso",
    };
  }

  /**
   * DELETE /relatorio/:id/documento/:docId
   * Remove documento do relatório
   */
  @Delete(":id/documento/:docId")
  @Roles(...DOCUMENTO_ACCESS)
  @ExactRoles()
  async removerDocumento(
    @Param("id") relatorioId: string,
    @Param("docId") docId: string,
    @Req() req: { user: UserContext },
    @Body() body: ExcluirDocumentoDto,
  ) {
    await this.relatorioService.removerDocumento(
      req.user,
      relatorioId,
      docId,
      body.motivo,
    );

    return {
      success: true,
      message: "Documento removido com sucesso",
    };
  }

  /**
   * GET /relatorio/:id/documento/:docId/download
   * Serve o arquivo do MinIO para visualização no browser.
   */
  @Get(":id/documento/:docId/download")
  @Roles(...VISUALIZAR_ACCESS)
  async downloadDocumento(
    @Res() reply: FastifyReply,
    @Param("id") relatorioId: string,
    @Param("docId") docId: string,
    @Req() req?: RequestComUsuario,
  ) {
    const inicio = Date.now();
    const documento = await this.relatorioService.getDocumentoById(
      relatorioId,
      docId,
    );
    if (!documento.storageKey) {
      this.registrarAcaoArquivo({
        req,
        relatorioId,
        documento,
        acao: "download",
        status: 404,
        duracaoMs: Date.now() - inicio,
        nivel: "error",
      });
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

      const resposta = reply.send(s3Response.Body);
      this.registrarAcaoArquivo({
        req,
        relatorioId,
        documento,
        acao: "download",
        status: 200,
        duracaoMs: Date.now() - inicio,
      });

      return resposta;
    } catch (error) {
      this.logger.error(`Erro ao baixar documento ${docId}: ${error}`);
      this.registrarAcaoArquivo({
        req,
        relatorioId,
        documento,
        acao: "download",
        status: 500,
        duracaoMs: Date.now() - inicio,
        nivel: "error",
      });
      return reply.status(500).send({ error: "Erro ao baixar arquivo" });
    }
  }

  // ============================================
  // Edição via SharePoint (Word)
  // ============================================

  /**
   * POST /relatorio/:id/documento/:docId/editar-word
   * Gera URL para edição via Word desktop (SharePoint)
   */
  @Post(":id/documento/:docId/editar-word")
  @Roles(...WORD_ACCESS)
  async editarWord(
    @Req() req: RequestComUsuario,
    @Param("id") relatorioId: string,
    @Param("docId") docId: string,
  ) {
    const inicio = Date.now();

    if (!this.sharePointService.isConfigurado()) {
      throw new BadRequestException({
        code: "SHAREPOINT_NOT_CONFIGURED",
        message:
          "Edição via Word não está disponível. SharePoint não configurado.",
      });
    }

    const user = req.user;
    // Valida acesso/permissão no service
    await this.relatorioService.editarWord(relatorioId, docId, user);

    const documento = await this.relatorioService.getDocumentoById(
      relatorioId,
      docId,
    );

    if (!documento.storageKey) {
      throw new BadRequestException("Documento sem arquivo associado");
    }

    // Verificar se já existe uma edição ativa
    let itemId: string | null = null;
    if (documento.sharepointItemId && documento.editandoDesde) {
      const expirado = this.sharePointService.calcularLimiteEdicao();

      if (documento.editandoDesde > expirado) {
        if (documento.sharepointEditUrl) {
          const msWordUrl = this.sharePointService.construirMsWordUrl(
            documento.sharepointEditUrl,
          );

          this.registrarSharePointWord({
            req,
            relatorioId,
            documento,
            etapa: "editar_word",
            duracaoMs: Date.now() - inicio,
            detalhes: { reutilizouItemExistente: true },
          });

          return {
            success: true,
            data: { url: msWordUrl },
          };
        }
        itemId = documento.sharepointItemId;
      } else {
        await this.sharePointService.removerArquivo(
          documento.sharepointItemId,
          1,
        );
      }
    }

    if (!itemId) {
      itemId = await this.sharePointService.uploadParaSharePoint(
        documento.storageKey,
        documento.fileName || "documento.docx",
        docId,
      );
    }

    const { directUrl } =
      await this.sharePointService.criarLinkCompartilhamento(
        itemId,
        docId,
        documento.fileName || "documento.docx",
      );

    await this.relatorioService.atualizarDocumento(docId, {
      sharepointItemId: itemId,
      sharepointEditUrl: directUrl,
      editandoDesde: new Date(),
    });

    const msWordUrl = this.sharePointService.construirMsWordUrl(directUrl);

    this.registrarSharePointWord({
      req,
      relatorioId,
      documento,
      etapa: "editar_word",
      duracaoMs: Date.now() - inicio,
    });

    return {
      success: true,
      data: { url: msWordUrl },
    };
  }

  /**
   * GET /relatorio/:id/documento/:docId/sharepoint
   * Retorna URL embeddable do Office para Web para visualização de .docx
   */
  @Get(":id/documento/:docId/sharepoint")
  @Roles(...VISUALIZAR_ACCESS)
  async getSharePointUrl(
    @Req() req: RequestComUsuario,
    @Param("id") relatorioId: string,
    @Param("docId") docId: string,
  ) {
    const inicio = Date.now();

    if (!this.sharePointService.isConfigurado()) {
      return { success: true, data: { disponivel: false } };
    }

    const user = req.user;
    await this.relatorioService.buscarPorId(relatorioId, user);

    const documento = await this.relatorioService.getDocumentoById(
      relatorioId,
      docId,
    );

    const isWord =
      documento.mimeType?.includes("word") ||
      documento.mimeType?.includes("msword") ||
      documento.fileName?.match(/\.docx?$/i);

    if (!isWord || !documento.storageKey) {
      return { success: true, data: { disponivel: false } };
    }

    let itemId: string | null = null;
    let reutilizouItemExistente = false;
    let reenviado = false;
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
      reenviado = true;

      await this.relatorioService.atualizarDocumento(docId, {
        sharepointItemId: itemId,
        sharepointEditUrl: null,
        editandoDesde: new Date(),
      });
    }

    let embedUrl: string;
    try {
      ({ embedUrl } =
        await this.sharePointService.criarLinkVisualizacao(itemId));
    } catch (error) {
      if (
        !reutilizouItemExistente ||
        !this.sharePointService.isItemNaoEncontrado(error)
      ) {
        throw error;
      }

      this.logger.warn(
        `[getSharePointUrl] Item ${itemId} do documento ${docId} não existe mais no SharePoint; reenviando arquivo`,
      );

      await this.relatorioService.atualizarDocumento(docId, {
        sharepointItemId: null,
        sharepointEditUrl: null,
        editandoDesde: null,
      });

      itemId = await this.sharePointService.uploadParaSharePoint(
        documento.storageKey,
        documento.fileName || "documento.docx",
        docId,
      );
      reenviado = true;

      await this.relatorioService.atualizarDocumento(docId, {
        sharepointItemId: itemId,
        sharepointEditUrl: null,
        editandoDesde: new Date(),
      });

      ({ embedUrl } =
        await this.sharePointService.criarLinkVisualizacao(itemId));
    }

    this.registrarSharePointWord({
      req,
      relatorioId,
      documento,
      etapa: "visualizar_sharepoint",
      duracaoMs: Date.now() - inicio,
      detalhes: { reenviado },
    });

    return {
      success: true,
      data: { disponivel: true, embedUrl },
    };
  }

  /**
   * POST /relatorio/:id/documento/:docId/sincronizar-word
   * Sincroniza alterações do SharePoint de volta ao MinIO
   */
  @Post(":id/documento/:docId/sincronizar-word")
  @Roles(...WORD_ACCESS)
  async sincronizarWord(
    @Req() req: RequestComUsuario,
    @Param("id") relatorioId: string,
    @Param("docId") docId: string,
  ) {
    const inicio = Date.now();
    const user = req.user;
    // Validação de permissão acontece no service
    await this.relatorioService.sincronizarWord(relatorioId, docId, user);

    const documento = await this.relatorioService.getDocumentoById(
      relatorioId,
      docId,
    );

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
      throw new BadRequestException(
        "Estado inconsistente: edição sem data de início",
      );
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

    await this.relatorioService.atualizarDocumento(docId, {
      sharepointItemId: null,
      sharepointEditUrl: null,
      editandoDesde: null,
      updatedAt: new Date(),
    });

    this.registrarSharePointWord({
      req,
      relatorioId,
      documento,
      etapa: "sincronizar_word",
      duracaoMs: Date.now() - inicio,
      detalhes: { sincronizado: foiModificado },
    });

    return {
      success: true,
      data: { sincronizado: foiModificado },
    };
  }

  // ============================================
  // Aprovação / Devolução pelo Analista
  // ============================================

  /**
   * POST /relatorio/:id/aprovar-analista
   * Aprova relatório como analista
   */
  @Post(":id/aprovar-analista")
  @Roles(...ANALISTA_ACCESS)
  async aprovarAnalista(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const relatorio = await this.relatorioService.aprovarAnalista(
      id,
      req.user,
    );
    return {
      success: true,
      data: relatorio,
    };
  }

  /**
   * POST /relatorio/:id/devolver-analista
   * Devolve relatório como analista
   */
  @Post(":id/devolver-analista")
  @Roles(...ANALISTA_ACCESS)
  async devolverAnalista(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const relatorio = await this.relatorioService.devolverAnalista(
      id,
      req.user,
    );
    return {
      success: true,
      data: relatorio,
    };
  }

  // ============================================
  // Exclusão de Relatório (gestão)
  // ============================================

  /**
   * DELETE /relatorio/:id
   * Exclui permanentemente um relatório
   * Apenas master/diretora_geral (validado no service)
   */
  @Delete(":id")
  @Roles("master", "diretora_geral")
  async deletarRelatorio(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    await this.relatorioService.deletarRelatorio(id, req.user);
    return {
      success: true,
      message: "Relatório excluído com sucesso",
    };
  }

  // ============================================
  // Aprovação de Documentos (analista)
  // ============================================

  /**
   * POST /relatorio/:id/documento/:docId/aprovar
   * Aprova um documento individualmente
   */
  @Post(":id/documento/:docId/aprovar")
  @Roles(...ANALISTA_ACCESS)
  async aprovarDocumento(
    @Req() req: { user: UserContext },
    @Param("id") relatorioId: string,
    @Param("docId") docId: string,
  ) {
    const documento = await this.relatorioService.aprovarDocumento(
      relatorioId,
      docId,
      req.user,
    );
    return {
      success: true,
      data: documento,
    };
  }

  /**
   * POST /relatorio/:id/documento/:docId/desaprovar
   * Desfaz a aprovação de um documento
   */
  @Post(":id/documento/:docId/desaprovar")
  @Roles(...ANALISTA_ACCESS)
  async desaprovarDocumento(
    @Req() req: { user: UserContext },
    @Param("id") relatorioId: string,
    @Param("docId") docId: string,
  ) {
    const documento = await this.relatorioService.desaprovarDocumento(
      relatorioId,
      docId,
      req.user,
    );
    return {
      success: true,
      data: documento,
    };
  }

  /**
   * POST /relatorio/:id/documento/:docId/regerar-pdf
   * Reprocessa o PDF de um documento Word aprovado
   */
  @Post(":id/documento/:docId/regerar-pdf")
  @Roles(...ANALISTA_ACCESS)
  async regerarPdf(
    @Req() req: { user: UserContext },
    @Param("id") relatorioId: string,
    @Param("docId") docId: string,
  ) {
    const documento = await this.relatorioService.regerarPdf(
      relatorioId,
      docId,
      req.user,
    );
    return {
      success: true,
      data: documento,
    };
  }

  /**
   * POST /relatorio/:id/documento/:docId/imprimir
   * Registra a impressão de um documento aprovado
   */
  @Post(":id/documento/:docId/imprimir")
  @Roles(...VISUALIZAR_ACCESS)
  async registrarImpressao(
    @Req() req: { user: UserContext },
    @Param("id") relatorioId: string,
    @Param("docId") docId: string,
  ) {
    const documento = await this.relatorioService.registrarImpressao(
      relatorioId,
      docId,
      req.user,
    );
    return {
      success: true,
      data: documento,
    };
  }
}
