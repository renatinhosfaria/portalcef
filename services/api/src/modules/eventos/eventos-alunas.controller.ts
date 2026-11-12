import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { juntarAlunasSchema, separarAlunaSchema } from "@essencia/shared/schemas";
import type { ZodTypeAny, z } from "zod";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ExactRoles, Roles } from "../../common/decorators/roles.decorator";
import { EVENTOS_ADMIN_ROLES } from "./eventos.constants";
import { EventosAlunasService } from "./eventos-alunas.service";

function validar<S extends ZodTypeAny>(schema: S, corpo: unknown): z.infer<S> {
  const parsed = schema.safeParse(corpo);
  if (!parsed.success) {
    throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Dados inválidos", details: parsed.error.flatten() });
  }
  return parsed.data;
}

/** Convidados pagantes por aluna: contagem e junção das grafias do mesmo nome. */
@Controller("eventos/admin/:id")
@UseGuards(AuthGuard, RolesGuard)
@ExactRoles()
@Roles(...EVENTOS_ADMIN_ROLES)
export class EventosAlunasController {
  constructor(private readonly service: EventosAlunasService) {}

  @Get("alunas")
  listar(@Param("id") id: string, @CurrentUser() actor: any) { return this.service.listar(id, actor); }

  @Post("alunas/juntar")
  async juntar(@Param("id") id: string, @Body() body: unknown, @CurrentUser() actor: any) {
    return this.service.juntar(id, validar(juntarAlunasSchema, body), actor);
  }

  @Post("alunas/separar")
  async separar(@Param("id") id: string, @Body() body: unknown, @CurrentUser() actor: any) {
    return this.service.separar(id, validar(separarAlunaSchema, body), actor);
  }
}
