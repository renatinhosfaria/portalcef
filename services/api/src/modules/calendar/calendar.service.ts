import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { getDb, calendarEvents, units, eq, and, sql } from "@essencia/db";
import type {
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  QueryCalendarEventsInput,
} from "@essencia/shared/schemas";

interface UserContext {
  userId: string;
  role: string;
  schoolId: string;
  unitId: string | null;
}

@Injectable()
export class CalendarService {
  async getEvents(user: UserContext, query: QueryCalendarEventsInput) {
    const db = getDb();
    const filters = [];

    console.log("[CalendarService] getEvents called with:", {
      user: {
        userId: user.userId,
        role: user.role,
        unitId: user.unitId,
        schoolId: user.schoolId,
      },
      query,
    });

    // Multi-tenant filtering
    if (user.role === "master") {
      if (query.unitId) filters.push(eq(calendarEvents.unitId, query.unitId));
    } else if (user.role === "diretora_geral") {
      const unitIds = await db.query.units.findMany({
        where: eq(units.schoolId, user.schoolId),
        columns: { id: true },
      });
      const ids = unitIds.map((u: { id: string }) => u.id);
      if (ids.length > 0) {
        filters.push(
          sql`${calendarEvents.unitId} IN (${sql.join(
            ids.map((id: string) => sql`${id}`),
            sql`, `,
          )})`,
        );
      }
    } else {
      // Para outros roles, filtrar pela unidade do usuário
      if (user.unitId) {
        filters.push(eq(calendarEvents.unitId, user.unitId));
      }
      // Se não tem unitId na sessão, filtrar pelo query.unitId (vem do frontend)
      else if (query.unitId) {
        filters.push(eq(calendarEvents.unitId, query.unitId));
      }
    }

    // Optional filters - converter year/month para número
    if (query.year) {
      const yearNum = Number(query.year);
      console.log(
        "[CalendarService] Filtering by year:",
        yearNum,
        typeof yearNum,
      );
      filters.push(
        sql`EXTRACT(YEAR FROM ${calendarEvents.startDate}) = ${yearNum}`,
      );
    }
    if (query.month) {
      const monthNum = Number(query.month);
      filters.push(
        sql`EXTRACT(MONTH FROM ${calendarEvents.startDate}) = ${monthNum}`,
      );
    }
    if (query.eventType) {
      filters.push(eq(calendarEvents.eventType, query.eventType));
    }

    console.log("[CalendarService] Number of filters:", filters.length);

    const events = await db.query.calendarEvents.findMany({
      where: filters.length > 0 ? and(...filters) : undefined,
      orderBy: (
        events: typeof calendarEvents.$inferSelect,
        { asc }: { asc: (column: any) => any },
      ) => [asc(events.startDate)],
    });

    console.log("[CalendarService] Found events:", events.length);

    return events;
  }

  async getEventById(user: UserContext, id: string) {
    const db = getDb();
    const event = await db.query.calendarEvents.findFirst({
      where: eq(calendarEvents.id, id),
    });

    if (!event) {
      throw new NotFoundException("Evento não encontrado");
    }

    // Verificar acesso ao tenant
    if (user.role !== "master" && user.role !== "diretora_geral") {
      if (event.unitId !== user.unitId) {
        throw new ForbiddenException("Acesso negado: evento de outra unidade");
      }
    }

    return event;
  }

  async createEvent(user: UserContext, data: CreateCalendarEventInput) {
    const db = getDb();

    // Verificar permissão de escrita na unidade
    if (user.role !== "master" && user.role !== "diretora_geral") {
      if (data.unitId !== user.unitId) {
        throw new ForbiddenException(
          "Acesso negado: não pode criar evento em outra unidade",
        );
      }
    }

    const [newEvent] = await db
      .insert(calendarEvents)
      .values({
        ...data,
        createdBy: user.userId,
      })
      .returning();

    return newEvent;
  }

  async updateEvent(
    user: UserContext,
    id: string,
    data: UpdateCalendarEventInput,
  ) {
    const db = getDb();
    // Verifica permissão
    await this.getEventById(user, id);

    const [updated] = await db
      .update(calendarEvents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(calendarEvents.id, id))
      .returning();

    return updated;
  }

  async deleteEvent(user: UserContext, id: string) {
    const db = getDb();
    await this.getEventById(user, id); // Verifica permissão

    await db.delete(calendarEvents).where(eq(calendarEvents.id, id));

    return { success: true };
  }

  async getStats(user: UserContext, unitId?: string, year = 2026) {
    const db = getDb();
    let targetUnitId = unitId;

    if (user.role !== "master" && user.role !== "diretora_geral") {
      if (!user.unitId) throw new ForbiddenException("Usuário sem unidade");
      targetUnitId = user.unitId;
    }

    const filters = [];
    if (targetUnitId) {
      filters.push(eq(calendarEvents.unitId, targetUnitId));
    }
    filters.push(sql`EXTRACT(YEAR FROM ${calendarEvents.startDate}) = ${year}`);
    filters.push(eq(calendarEvents.isSchoolDay, true));

    const events = await db.query.calendarEvents.findMany({
      where: and(...filters),
    });

    // Calcular dias letivos por mês
    const monthlyStats = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      schoolDays: 0,
    }));

    for (const event of events) {
      const start = new Date(event.startDate);
      const end = new Date(event.endDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const month = d.getMonth();
        monthlyStats[month].schoolDays++;
      }
    }

    const totalSchoolDays = monthlyStats.reduce(
      (sum, m) => sum + m.schoolDays,
      0,
    );

    return {
      year,
      totalSchoolDays,
      monthlyStats,
    };
  }
}
