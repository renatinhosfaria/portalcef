import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
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

  @Get(":id/ingressos")
  tickets(@Param("id") id: string, @CurrentUser() actor: any) { return this.service.listarIngressosAdmin(id, actor); }

  @Patch(":id/ingressos")
  async updateTickets(@Param("id") id: string, @Body() body: unknown, @CurrentUser() actor: any) {
    const values = Array.isArray(body) ? body : [body];
    if (!values.every((value: any) => value && typeof value.name === "string" && Number.isInteger(value.priceCents) && value.priceCents >= 0)) return { success: false, error: { code: "VALIDATION_ERROR", message: "Ingresso inválido" } };
    return { success: true, data: await this.service.atualizarIngressos(id, values as any, actor) };
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
