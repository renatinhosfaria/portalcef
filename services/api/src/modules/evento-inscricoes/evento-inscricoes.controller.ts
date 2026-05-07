import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import {
  criarInscricaoSchema,
  listarInscricoesSchema,
} from "./dto/evento-inscricoes.dto";
import { EventoInscricoesService } from "./evento-inscricoes.service";

const ADMIN_ROLES = ["master", "diretora_geral", "gerente_unidade"];
const SLUG_REGEX = /^[a-z0-9-]{3,80}$/;

@Controller("eventos")
@UseGuards(AuthGuard, RolesGuard)
export class EventoInscricoesController {
  private readonly logger = new Logger(EventoInscricoesController.name);

  constructor(
    private readonly eventoInscricoesService: EventoInscricoesService,
  ) {}

  /**
   * GET /api/eventos/:slug/status
   * Endpoint PÚBLICO — landing consulta para saber se inscrições estão abertas.
   */
  @Get(":slug/status")
  @Public()
  status(@Param("slug") slug: string) {
    if (!SLUG_REGEX.test(slug)) {
      throw new BadRequestException("Slug do evento inválido");
    }
    return this.eventoInscricoesService.obterStatus(slug);
  }

  /**
   * POST /api/eventos/:slug/inscricoes
   * Endpoint PÚBLICO — chamado pela landing.
   */
  @Post(":slug/inscricoes")
  @Public()
  @HttpCode(201)
  async criar(
    @Param("slug") slug: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ) {
    if (!SLUG_REGEX.test(slug)) {
      throw new BadRequestException("Slug do evento inválido");
    }

    const parsed = criarInscricaoSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new BadRequestException(
        issue
          ? `${issue.path.join(".") || "campo"}: ${issue.message}`
          : "Dados inválidos",
      );
    }

    const ipAddress =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
      req.ip;
    const userAgent = req.headers["user-agent"];

    const inscricao = await this.eventoInscricoesService.criar(slug, parsed.data, {
      ipAddress,
      userAgent: typeof userAgent === "string" ? userAgent : undefined,
    });

    return {
      ok: true,
      id: inscricao.id,
      numeroInscricao: inscricao.numeroInscricao,
    };
  }

  /**
   * GET /api/eventos/:slug/inscricoes
   * Restrito: master, diretora_geral, gerente_unidade.
   */
  @Get(":slug/inscricoes")
  @Roles(...ADMIN_ROLES)
  async listar(@Param("slug") slug: string, @Query() query: unknown) {
    if (!SLUG_REGEX.test(slug)) {
      throw new BadRequestException("Slug do evento inválido");
    }

    const parsed = listarInscricoesSchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException("Filtros inválidos");
    }

    return this.eventoInscricoesService.listar(slug, parsed.data);
  }

  /**
   * GET /api/eventos/:slug/inscricoes/:id
   * Detalhes de uma inscrição (mesmas roles).
   */
  @Get(":slug/inscricoes/:id")
  @Roles(...ADMIN_ROLES)
  async obter(@Param("slug") slug: string, @Param("id") id: string) {
    if (!SLUG_REGEX.test(slug)) {
      throw new BadRequestException("Slug do evento inválido");
    }
    return this.eventoInscricoesService.obter(slug, id);
  }
}
