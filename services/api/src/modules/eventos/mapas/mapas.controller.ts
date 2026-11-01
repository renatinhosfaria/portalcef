import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { ExactRoles, Roles } from "../../../common/decorators/roles.decorator";
import { EVENTOS_ADMIN_ROLES } from "../eventos.constants";
import { MapasService } from "./mapas.service";
import { z } from "zod";

@Controller("eventos/admin/:id")
@UseGuards(AuthGuard, RolesGuard)
@ExactRoles()
@Roles(...EVENTOS_ADMIN_ROLES)
export class MapasController {
  constructor(private readonly service: MapasService) {}
  @Post("mapas/import") async importar(@Param("id") id: string, @Req() request: any, @CurrentUser() actor: any) { const file = await request.file(); if (!file) throw new BadRequestException({ code: "FILE_REQUIRED", message: "Arquivo do mapa é obrigatório" }); return this.service.importar(id, file, actor); }
  @Get("mapas/:versionId/revisao") revisao(@Param("id") id: string, @Param("versionId") versionId: string, @CurrentUser() actor: any) { return this.service.revisao(id, versionId, actor); }
  @Patch("mapas/:versionId/deteccoes") atualizar(@Param("id") id: string, @Param("versionId") versionId: string, @Body() body: any, @CurrentUser() actor: any) { return this.service.atualizarDeteccoes(id, versionId, body, actor); }
  @Post("mapas/:versionId/confirmar") confirmar(@Param("id") id: string, @Param("versionId") versionId: string, @Body() body: any, @CurrentUser() actor: any) { return this.service.confirmar(id, versionId, body, actor); }
  @Post("mapas/:versionId/arquivar") arquivar(@Param("id") id: string, @Param("versionId") versionId: string, @CurrentUser() actor: any) { return this.service.arquivar(id, versionId, actor); }
  @Post("mapa-padrao/substituir") async substituir(@Param("id") id: string, @Body() body: unknown, @CurrentUser() actor: any) {
    const parsed = z.object({ mapId: z.string().uuid() }).safeParse(body);
    if (!parsed.success) return { success: false, error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } };
    return { success: true, data: await this.service.substituirMapaPadrao(id, parsed.data.mapId, actor) };
  }
}
