import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { ExactRoles, Roles } from "../../../common/decorators/roles.decorator";
import { EVENTOS_ADMIN_ROLES } from "../eventos.constants";
import { MapasService } from "./mapas.service";

@Controller("eventos/admin/:id/mapas")
@UseGuards(AuthGuard, RolesGuard)
@ExactRoles()
@Roles(...EVENTOS_ADMIN_ROLES)
export class MapasController {
  constructor(private readonly service: MapasService) {}
  @Post("import") async importar(@Param("id") id: string, @Req() request: any, @CurrentUser() actor: any) { const file = await request.file(); if (!file) throw new BadRequestException({ code: "FILE_REQUIRED", message: "Arquivo do mapa é obrigatório" }); return this.service.importar(id, file, actor); }
  @Get(":versionId/revisao") revisao(@Param("id") id: string, @Param("versionId") versionId: string, @CurrentUser() actor: any) { return this.service.revisao(id, versionId, actor); }
  @Patch(":versionId/deteccoes") atualizar(@Param("id") id: string, @Param("versionId") versionId: string, @Body() body: any, @CurrentUser() actor: any) { return this.service.atualizarDeteccoes(id, versionId, body, actor); }
  @Post(":versionId/confirmar") confirmar(@Param("id") id: string, @Param("versionId") versionId: string, @Body() body: any, @CurrentUser() actor: any) { return this.service.confirmar(id, versionId, body, actor); }
  @Post(":versionId/arquivar") arquivar(@Param("id") id: string, @Param("versionId") versionId: string, @CurrentUser() actor: any) { return this.service.arquivar(id, versionId, actor); }
}
