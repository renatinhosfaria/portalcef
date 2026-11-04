import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { ExactRoles, Roles } from "../../../common/decorators/roles.decorator";
import { EVENTOS_ADMIN_ROLES } from "../eventos.constants";
import { MAX_PLANTA_PDF_BYTES, MapasService } from "./mapas.service";
import { operacoesPropostaSchema } from "@essencia/shared/eventos/mapa-proposta";
import { z } from "zod";

@Controller("eventos/admin/:id")
@UseGuards(AuthGuard, RolesGuard)
@ExactRoles()
@Roles(...EVENTOS_ADMIN_ROLES)
export class MapasController {
  constructor(private readonly service: MapasService) {}
  @Get("mapas") listar(@Param("id") id: string, @CurrentUser() actor: any) { return this.service.listar(id, actor); }
  @Post("mapas/import") async importar(@Param("id") id: string, @Query("pagina") pagina: string | undefined, @Req() request: any, @CurrentUser() actor: any) {
    const parsed = z.coerce.number().int().min(1).optional().safeParse(pagina);
    if (!parsed.success) return { success: false, error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } };
    const file = await request.file({ limits: { fileSize: MAX_PLANTA_PDF_BYTES } });
    if (!file) throw new BadRequestException({ code: "FILE_REQUIRED", message: "Arquivo do mapa é obrigatório" });
    return this.service.importar(id, file, actor, parsed.data);
  }
  @Get("mapas/:versionId/original") async original(@Param("id") id: string, @Param("versionId") versionId: string, @CurrentUser() actor: any, @Res() reply: FastifyReply) {
    const arquivo = await this.service.obterOriginal(id, versionId, actor);
    reply.header("Content-Type", arquivo.contentType);
    reply.header("Content-Disposition", 'inline; filename="planta.pdf"');
    if (arquivo.contentLength) reply.header("Content-Length", arquivo.contentLength);
    return reply.send(arquivo.body);
  }
  @Get("mapas/:versionId/revisao") revisao(@Param("id") id: string, @Param("versionId") versionId: string, @CurrentUser() actor: any) { return this.service.revisao(id, versionId, actor); }
  @Patch("mapas/:versionId/proposta") async editarProposta(@Param("id") id: string, @Param("versionId") versionId: string, @Body() body: unknown, @CurrentUser() actor: any) {
    const parsed = z.object({ revisaoBase: z.number().int().min(0), operacoes: operacoesPropostaSchema }).safeParse(body);
    if (!parsed.success) return { success: false, error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } };
    return { success: true, data: await this.service.editarProposta(id, versionId, parsed.data, actor) };
  }
  @Post("mapas/:versionId/publicar") async publicar(@Param("id") id: string, @Param("versionId") versionId: string, @Body() body: unknown, @CurrentUser() actor: any) {
    const parsed = z.object({ revisaoBase: z.number().int().min(0), motivo: z.string().trim().max(500).optional() }).safeParse(body);
    if (!parsed.success) return { success: false, error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } };
    return { success: true, data: await this.service.publicar(id, versionId, { revisaoBase: parsed.data.revisaoBase, motivo: parsed.data.motivo || undefined }, actor) };
  }
  @Post("mapas/:versionId/arquivar") arquivar(@Param("id") id: string, @Param("versionId") versionId: string, @CurrentUser() actor: any) { return this.service.arquivar(id, versionId, actor); }
  @Post("mapa-padrao/substituir") async substituir(@Param("id") id: string, @Body() body: unknown, @CurrentUser() actor: any) {
    const parsed = z.object({ mapId: z.string().uuid() }).safeParse(body);
    if (!parsed.success) return { success: false, error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } };
    return { success: true, data: await this.service.substituirMapaPadrao(id, parsed.data.mapId, actor) };
  }
  @Post("mapas/:versionId/migrar-e-excluir") async migrarEExcluir(@Param("id") id: string, @Param("versionId") versionId: string, @Body() body: unknown, @CurrentUser() actor: any) {
    const parsed = z.object({ targetMapId: z.string().uuid(), sessionIds: z.array(z.string().uuid()).optional() }).safeParse(body);
    if (!parsed.success) return { success: false, error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } };
    return { success: true, data: await this.service.migrarSessoesEExcluir(id, versionId, parsed.data, actor) };
  }
}
