import type { Multipart } from "@fastify/multipart";
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ExactRoles, Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { atualizarMapaPadraoSchema, atualizarRascunhoSchema, criarEventoSchema, criarRascunhoSchema, criarSessaoSchema, eventoListQuerySchema, politicaSchema } from "@essencia/shared/schemas";
import { EventosService } from "./eventos.service";
import { EventosReadinessService } from "./eventos-readiness.service";
import { EVENTOS_ADMIN_ROLES } from "./eventos.constants";

@Controller("eventos/admin")
@UseGuards(AuthGuard, RolesGuard)
@ExactRoles()
@Roles(...EVENTOS_ADMIN_ROLES)
export class EventosAdminController {
  constructor(private readonly service: EventosService, private readonly readinessService: EventosReadinessService) {}

  @Get()
  async list(@Query() query: unknown, @CurrentUser() actor: any) {
    const parsed = eventoListQuerySchema.safeParse(query);
    return this.service.listarAdmin(parsed.success ? parsed.data : {}, actor);
  }

  @Post("rascunhos")
  async createDraft(@Body() body: unknown, @CurrentUser() actor: any) {
    const parsed = criarRascunhoSchema.safeParse(body);
    if (!parsed.success) return { success: false, error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } };
    return { success: true, data: await this.service.criarRascunho(parsed.data, actor) };
  }

  @Post()
  async create(@Body() body: unknown, @CurrentUser() actor: any) {
    const parsed = criarEventoSchema.safeParse(body);
    if (!parsed.success) return { success: false, error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } };
    return { success: true, data: await this.service.criarEvento(parsed.data, actor) };
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: unknown, @CurrentUser() actor: any) {
    const parsed = atualizarRascunhoSchema.safeParse(body);
    if (!parsed.success) return { success: false, error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } };
    return { success: true, data: await this.service.atualizarEvento(id, parsed.data, actor) };
  }

  @Post(":id/imagem")
  async uploadImage(@Param("id") id: string, @Req() req: FastifyRequest & { isMultipart: () => boolean; parts: () => AsyncIterableIterator<Multipart> }, @CurrentUser() actor: any) {
    if (!req.isMultipart()) return { success: false, error: { code: "INVALID_REQUEST", message: "Request deve ser multipart/form-data" } };
    let arquivo: { buffer: Buffer; filename: string; mimetype: string } | undefined;
    let expectedUpdatedAt: Date | undefined;
    for await (const part of req.parts()) {
      if (part.type === "file") {
        if (part.fieldname !== "file") continue;
        if (arquivo) return { success: false, error: { code: "MULTIPLE_FILES", message: "Envie apenas uma imagem" } };
        arquivo = { buffer: await part.toBuffer(), filename: part.filename, mimetype: part.mimetype };
      } else if (part.fieldname === "expectedUpdatedAt" && typeof part.value === "string" && part.value) {
        expectedUpdatedAt = new Date(part.value);
        if (Number.isNaN(expectedUpdatedAt.getTime())) return { success: false, error: { code: "INVALID_REQUEST", message: "Versão do evento inválida" } };
      }
    }
    if (!arquivo || arquivo.buffer.length === 0) return { success: false, error: { code: "FILE_REQUIRED", message: "Envie uma imagem" } };
    return { success: true, data: await this.service.atualizarImagem(id, arquivo, actor, expectedUpdatedAt) };
  }

  @Get(":id")
  detail(@Param("id") id: string, @CurrentUser() actor: any) { return this.service.detalheAdmin(id, actor); }

  @Get(":id/prontidao")
  async readiness(@Param("id") id: string, @CurrentUser() actor: any) { return { success: true, data: await this.readinessService.verificar(id, actor) }; }

  @Patch(":id/mapa-padrao")
  async updateDefaultMap(@Param("id") id: string, @Body() body: unknown, @CurrentUser() actor: any) {
    const parsed = atualizarMapaPadraoSchema.safeParse(body);
    if (!parsed.success) return { success: false, error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } };
    return { success: true, data: await this.service.atualizarMapaPadrao(id, parsed.data.mapId, actor) };
  }

  @Get(":id/inventario")
  inventory(@Param("id") id: string, @CurrentUser() actor: any) { return this.service.listarInventario(id, actor); }

  @Post(":id/sessoes")
  async createSession(@Param("id") id: string, @Body() body: unknown, @CurrentUser() actor: any) {
    const parsed = criarSessaoSchema.safeParse(body);
    if (!parsed.success) return { success: false, error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } };
    return { success: true, data: await this.service.criarSessao(id, parsed.data, actor) };
  }

  @Get(":id/sessoes")
  sessions(@Param("id") id: string, @CurrentUser() actor: any) { return this.service.listarSessoesAdmin(id, actor); }

  @Get(":id/sessoes/opcoes")
  sessionOptions(@Param("id") id: string, @CurrentUser() actor: any) { return this.service.listarOpcoesSessoes(id, actor); }

  @Get(":id/ingressos")
  tickets(@Param("id") id: string, @CurrentUser() actor: any) { return this.service.listarIngressosAdmin(id, actor); }

  @Patch(":id/ingressos")
  async updateTickets(@Param("id") id: string, @Body() body: unknown, @CurrentUser() actor: any) {
    const values = Array.isArray(body) ? body : [body];
    if (!values.every((value: any) => value && typeof value.name === "string" && Number.isInteger(value.priceCents) && value.priceCents >= 0)) return { success: false, error: { code: "VALIDATION_ERROR", message: "Ingresso inválido" } };
    return { success: true, data: await this.service.atualizarIngressos(id, values as any, actor) };
  }

  @Delete(":id/sessoes/:sessionId")
  async deleteSession(@Param("id") id: string, @Param("sessionId") sessionId: string, @CurrentUser() actor: any) {
    return { success: true, data: await this.service.removerSessao(id, sessionId, actor) };
  }

  @Patch(":id/sessoes/:sessionId")
  async updateSession(@Param("id") id: string, @Param("sessionId") sessionId: string, @Body() body: unknown, @CurrentUser() actor: any) {
    const parsed = criarSessaoSchema.partial().safeParse(body);
    if (!parsed.success) return { success: false, error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } };
    return { success: true, data: await this.service.atualizarSessao(id, sessionId, parsed.data, actor) };
  }

  @Post(":id/publicar")
  publish(@Param("id") id: string, @CurrentUser() actor: any) { return this.service.publicar(id, actor); }
  @Post(":id/pausar")
  pause(@Param("id") id: string, @CurrentUser() actor: any) { return this.service.alterarStatus(id, "PAUSADO", actor); }
  @Post(":id/cancelar")
  cancel(@Param("id") id: string, @CurrentUser() actor: any) { return this.service.alterarStatus(id, "CANCELADO", actor); }

  @Get(":id/politicas")
  policies(@Param("id") id: string, @CurrentUser() actor: any) { return this.service.listarPoliticas(id, actor); }

  @Patch(":id/politicas")
  async updatePolicies(@Param("id") id: string, @Body() body: unknown, @CurrentUser() actor: any) {
    const values = Array.isArray(body) ? body : [body];
    const parsed = values.map((value) => politicaSchema.safeParse(value));
    const invalid = parsed.find((item) => !item.success);
    if (invalid && !invalid.success) return { success: false, error: { code: "VALIDATION_ERROR", details: invalid.error.flatten() } };
    return { success: true, data: await this.service.atualizarPoliticas(id, parsed.filter((item): item is { success: true; data: any } => item.success).map((item) => item.data), actor) };
  }
}
