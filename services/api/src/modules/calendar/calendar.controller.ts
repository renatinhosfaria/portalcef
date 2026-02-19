import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import {
  createCalendarEventSchema,
  updateCalendarEventSchema,
  queryCalendarEventsSchema,
  type CreateCalendarEventInput,
  type UpdateCalendarEventInput,
  type QueryCalendarEventsInput,
} from "@essencia/shared/schemas";
import { CalendarService } from "./calendar.service";

interface UserContext {
  userId: string;
  role: string;
  schoolId: string;
  unitId: string | null;
}

// Todos os usuários autenticados podem visualizar o calendário
const VIEW_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_geral",
  "coordenadora_bercario",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_medio",
  "analista_pedagogico",
  "professora",
  "auxiliar_administrativo",
  "auxiliar_sala",
] as const;

const EDIT_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "coordenadora_geral",
  "coordenadora_bercario",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_medio",
] as const;

const DELETE_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "coordenadora_geral",
] as const;

@Controller("calendar")
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get("events")
  @Roles(...VIEW_ROLES)
  async getEvents(
    @CurrentUser() user: UserContext,
    @Query() query: QueryCalendarEventsInput,
  ) {
    const result = queryCalendarEventsSchema.safeParse(query);
    if (!result.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Parâmetros inválidos",
          details: result.error.flatten(),
        },
      };
    }

    const events = await this.calendarService.getEvents(user, result.data);
    return { success: true, data: events };
  }

  @Get("events/:id")
  @Roles(...VIEW_ROLES)
  async getEventById(
    @CurrentUser() user: UserContext,
    @Param("id") id: string,
  ) {
    const event = await this.calendarService.getEventById(user, id);
    return { success: true, data: event };
  }

  @Post("events")
  @Roles(...EDIT_ROLES)
  async createEvent(
    @CurrentUser() user: UserContext,
    @Body() body: CreateCalendarEventInput,
  ) {
    const result = createCalendarEventSchema.safeParse(body);
    if (!result.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Dados inválidos",
          details: result.error.flatten(),
        },
      };
    }

    const event = await this.calendarService.createEvent(user, result.data);
    return { success: true, data: event };
  }

  @Put("events/:id")
  @Roles(...EDIT_ROLES)
  async updateEvent(
    @CurrentUser() user: UserContext,
    @Param("id") id: string,
    @Body() body: UpdateCalendarEventInput,
  ) {
    const result = updateCalendarEventSchema.safeParse(body);
    if (!result.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Dados inválidos",
          details: result.error.flatten(),
        },
      };
    }

    const event = await this.calendarService.updateEvent(user, id, result.data);
    return { success: true, data: event };
  }

  @Delete("events/:id")
  @HttpCode(HttpStatus.OK)
  @Roles(...DELETE_ROLES)
  async deleteEvent(@CurrentUser() user: UserContext, @Param("id") id: string) {
    await this.calendarService.deleteEvent(user, id);
    return { success: true, data: null };
  }

  @Get("stats")
  @Roles(...VIEW_ROLES)
  async getStats(
    @CurrentUser() user: UserContext,
    @Query("unitId") unitId?: string,
    @Query("year") year?: string,
  ) {
    const stats = await this.calendarService.getStats(
      user,
      unitId,
      year ? parseInt(year, 10) : 2026,
    );
    return { success: true, data: stats };
  }

  /**
   * Retorna informações de dias letivos para uma quinzena específica.
   * Usado pelo módulo de planejamento para validar disponibilidade.
   */
  @Get("quinzena/:quinzenaId/school-days")
  @Roles(...VIEW_ROLES)
  async getQuinzenaSchoolDays(
    @CurrentUser() user: UserContext,
    @Param("quinzenaId") quinzenaId: string,
    @Query("unitId") unitId?: string,
  ) {
    // Usar unitId do query ou da sessão
    const targetUnitId = unitId || user.unitId;

    if (!targetUnitId) {
      return {
        success: false,
        error: {
          code: "MISSING_UNIT",
          message: "Unidade não especificada",
        },
      };
    }

    const result = await this.calendarService.validateQuinzenaSchoolDays(
      targetUnitId,
      quinzenaId,
    );

    return { success: true, data: result };
  }

  /**
   * Retorna a data de início das férias de julho para um ano específico.
   * Usado para determinar a divisão entre 1º e 2º semestre nos planos de aula.
   */
  @Get("ferias-julho")
  @Roles(...VIEW_ROLES)
  async getFeriasJulho(
    @CurrentUser() user: UserContext,
    @Query("unitId") unitId?: string,
    @Query("year") year?: string,
  ) {
    const targetUnitId = unitId || user.unitId;
    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();

    if (!targetUnitId) {
      return {
        success: false,
        error: {
          code: "MISSING_UNIT",
          message: "Unidade não especificada",
        },
      };
    }

    return await this.calendarService.getFeriasJulhoStartDate(
      targetUnitId,
      targetYear,
    );
  }
}
