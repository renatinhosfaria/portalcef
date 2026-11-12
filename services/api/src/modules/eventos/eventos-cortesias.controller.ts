import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { cancelarCortesiaSchema, emitirCortesiasSchema } from "@essencia/shared/schemas";
import type { ZodTypeAny, z } from "zod";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ExactRoles, Roles } from "../../common/decorators/roles.decorator";
import { EVENTOS_ADMIN_ROLES } from "./eventos.constants";
import { EventosCortesiasService } from "./eventos-cortesias.service";

function validar<S extends ZodTypeAny>(schema: S, corpo: unknown): z.infer<S> {
  const parsed = schema.safeParse(corpo);
  if (!parsed.success) {
    throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Dados inválidos", details: parsed.error.flatten() });
  }
  return parsed.data;
}

@Controller("eventos/admin/:id")
@UseGuards(AuthGuard, RolesGuard)
@ExactRoles()
@Roles(...EVENTOS_ADMIN_ROLES)
export class EventosCortesiasController {
  constructor(private readonly service: EventosCortesiasService) {}

  @Get("cortesias")
  listar(@Param("id") id: string, @CurrentUser() actor: any) { return this.service.listar(id, actor); }

  @Get("sessoes/:sessionId/mapa-admin")
  mapaAdmin(@Param("id") id: string, @Param("sessionId") sessionId: string, @CurrentUser() actor: any) { return this.service.obterMapaAdmin(id, sessionId, actor); }

  @Post("cortesias")
  async emitir(@Param("id") id: string, @Body() body: unknown, @CurrentUser() actor: any) {
    return this.service.emitir(id, validar(emitirCortesiasSchema, body), actor);
  }

  @Get("cortesias/:orderId/voucher")
  voucher(@Param("id") id: string, @Param("orderId") orderId: string, @CurrentUser() actor: any) { return this.service.obterVoucher(id, orderId, actor); }

  @Post("cortesias/:orderId/cancelar")
  async cancelar(@Param("id") id: string, @Param("orderId") orderId: string, @Body() body: unknown, @CurrentUser() actor: any) {
    return this.service.cancelar(id, orderId, validar(cancelarCortesiaSchema, body), actor);
  }
}
