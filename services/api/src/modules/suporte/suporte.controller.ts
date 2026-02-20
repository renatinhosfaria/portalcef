import { MultipartFile } from "@fastify/multipart";
import {
  BadRequestException,
  Body,
  Controller,
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
import { FastifyRequest } from "fastify";

import { Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { StorageService } from "../../common/storage/storage.service";
import {
  criarOrdemServicoSchema,
  type ListarOrdemServicoDto,
  listarOrdemServicoSchema,
  enviarMensagemSchema,
  type AlterarStatusDto,
  alterarStatusSchema,
} from "./dto/suporte.dto";
import {
  SuporteService,
  type UserContext,
  type ArquivoUpload,
} from "./suporte.service";

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

/** Todas as roles que podem acessar o modulo de suporte */
const TODOS_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_geral",
  "coordenadora_bercario",
  "coordenadora_infantil",
  "coordenadora_fundamental",
  "analista_pedagogico",
  "professora",
  "auxiliar_sala",
  "auxiliar_desenvolvimento",
] as const;

/** Roles de administracao que podem alterar status */
const ADMIN_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
] as const;

// ============================================
// Controller
// ============================================

/**
 * SuporteController
 *
 * Controller para o modulo de suporte (Ordens de Servico):
 * - Abertura de OS com anexos (multipart)
 * - Listagem com filtros e paginacao
 * - Detalhamento de OS com mensagens
 * - Envio de mensagens com anexos
 * - Alteracao de status (admin)
 * - Contagem por status
 *
 * NOTA: TenantGuard nao e usado pois o isolamento de tenant e feito
 * via schoolId da sessao. O service valida acesso em cada metodo.
 */
@Controller("suporte")
@UseGuards(AuthGuard, RolesGuard)
export class SuporteController {
  private readonly logger = new Logger(SuporteController.name);

  constructor(
    private readonly suporteService: SuporteService,
    private readonly storageService: StorageService,
  ) {}

  // ============================================
  // Helpers Privados
  // ============================================

  /**
   * Processa request multipart do Fastify, extraindo campos e arquivos.
   * Os arquivos sao enviados ao storage com prefixo "suporte".
   *
   * @param req Request Fastify multipart
   * @returns Campos de texto e arquivos ja enviados ao storage
   */
  private async processarMultipart(
    req: FastifyMultipartRequest,
  ): Promise<{ campos: Record<string, string>; arquivos: ArquivoUpload[] }> {
    const campos: Record<string, string> = {};
    const arquivos: ArquivoUpload[] = [];

    const parts = req.parts();

    for await (const part of parts) {
      if (part.type === "field") {
        // Campo de texto
        campos[part.fieldname] = String(part.value);
      } else if (part.type === "file") {
        // Arquivo - enviar ao storage
        const buffer = await part.toBuffer();

        // Ignorar campos de arquivo vazios (sem conteudo enviado)
        if (buffer.length === 0) {
          continue;
        }

        try {
          const resultado = await this.storageService.uploadBuffer(
            buffer,
            part.filename,
            part.mimetype,
            "suporte",
          );

          arquivos.push({
            url: resultado.url,
            nome: resultado.name,
            mimetype: part.mimetype,
          });
        } catch (error) {
          this.logger.error(
            `Erro ao fazer upload de arquivo: ${error instanceof Error ? error.message : String(error)}`,
          );
          throw new InternalServerErrorException({
            code: "UPLOAD_FAILED",
            message: "Erro ao fazer upload do arquivo",
          });
        }
      }
    }

    return { campos, arquivos };
  }

  // ============================================
  // Endpoints de CRUD
  // ============================================

  /**
   * POST /suporte
   * Cria nova ordem de servico (multipart/form-data)
   *
   * Campos esperados: titulo, descricao, categoria
   * Arquivos opcionais: anexos da OS
   */
  @Post()
  @Roles(...TODOS_ROLES)
  async criarOrdemServico(@Req() req: FastifyMultipartRequest) {
    if (!req.isMultipart()) {
      throw new BadRequestException({
        code: "INVALID_REQUEST",
        message: "Request deve ser multipart/form-data",
      });
    }

    const { campos, arquivos } = await this.processarMultipart(req);

    // Validar campos com schema Zod
    const parsed = criarOrdemServicoSchema.safeParse({
      titulo: campos.titulo,
      descricao: campos.descricao,
      categoria: campos.categoria,
    });

    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dados invalidos",
        errors: parsed.error.errors,
      });
    }

    const os = await this.suporteService.criar(
      parsed.data,
      arquivos,
      req.user,
    );

    return {
      success: true,
      data: os,
    };
  }

  /**
   * GET /suporte
   * Lista ordens de servico com filtros e paginacao
   */
  @Get()
  @Roles(...TODOS_ROLES)
  async listarOrdensServico(
    @Req() req: { user: UserContext },
    @Query() query: ListarOrdemServicoDto,
  ) {
    // Validar query params
    const parsed = listarOrdemServicoSchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Parametros invalidos",
        errors: parsed.error.errors,
      });
    }

    const resultado = await this.suporteService.listar(req.user, parsed.data);

    return {
      success: true,
      ...resultado,
    };
  }

  // ============================================
  // Endpoints de Estatisticas
  // ============================================

  /**
   * GET /suporte/contagem
   * Retorna contagem de OS por status
   *
   * IMPORTANTE: Esta rota DEVE ser definida ANTES da rota :id
   * para evitar conflito de rotas no NestJS.
   */
  @Get("contagem")
  @Roles(...TODOS_ROLES)
  async getContagem(@Req() req: { user: UserContext }) {
    const contagem = await this.suporteService.contagem(req.user);

    return {
      success: true,
      data: contagem,
    };
  }

  // ============================================
  // Endpoints por ID
  // ============================================

  /**
   * GET /suporte/:id
   * Busca ordem de servico por ID com todas as mensagens
   */
  @Get(":id")
  @Roles(...TODOS_ROLES)
  async buscarOrdemServicoPorId(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const os = await this.suporteService.buscarPorId(id, req.user);

    return {
      success: true,
      data: os,
    };
  }

  /**
   * POST /suporte/:id/mensagem
   * Envia mensagem em uma ordem de servico (multipart/form-data)
   *
   * Campos esperados: conteudo (opcional)
   * Arquivos opcionais: anexos da mensagem
   * Deve haver pelo menos conteudo OU arquivo
   */
  @Post(":id/mensagem")
  @Roles(...TODOS_ROLES)
  async enviarMensagem(
    @Param("id") id: string,
    @Req() req: FastifyMultipartRequest,
  ) {
    if (!req.isMultipart()) {
      throw new BadRequestException({
        code: "INVALID_REQUEST",
        message: "Request deve ser multipart/form-data",
      });
    }

    const { campos, arquivos } = await this.processarMultipart(req);

    // Validar campos com schema Zod
    const parsed = enviarMensagemSchema.safeParse({
      conteudo: campos.conteudo,
    });

    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dados invalidos",
        errors: parsed.error.errors,
      });
    }

    // Deve ter conteudo ou pelo menos um arquivo
    if (!parsed.data.conteudo && arquivos.length === 0) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "E necessario enviar um texto ou pelo menos um arquivo",
      });
    }

    const mensagens = await this.suporteService.enviarMensagem(
      id,
      parsed.data,
      arquivos,
      req.user,
    );

    return {
      success: true,
      data: mensagens,
    };
  }

  /**
   * PATCH /suporte/:id/status
   * Altera o status de uma ordem de servico (apenas admin)
   */
  @Patch(":id/status")
  @Roles(...ADMIN_ROLES)
  async alterarStatus(
    @Param("id") id: string,
    @Req() req: { user: UserContext },
    @Body() body: AlterarStatusDto,
  ) {
    // Validar body com schema Zod
    const parsed = alterarStatusSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dados invalidos",
        errors: parsed.error.errors,
      });
    }

    const os = await this.suporteService.alterarStatus(
      id,
      parsed.data,
      req.user,
    );

    return {
      success: true,
      data: os,
    };
  }
}
