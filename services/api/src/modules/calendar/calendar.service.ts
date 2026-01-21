import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { getDb, calendarEvents, units, eq, and, asc, sql } from "@essencia/db";
import type {
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  QueryCalendarEventsInput,
} from "@essencia/shared/schemas";
import { getQuinzenaById } from "@essencia/shared/config/quinzenas";

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
      orderBy: [asc(calendarEvents.startDate)],
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

  // =====================================================
  // MÉTODOS DE INTEGRAÇÃO COM PLANEJAMENTO
  // =====================================================

  /**
   * Converte string ISO ou Date para Date local (evita problemas de timezone)
   */
  private toLocalDate(dateInput: string | Date): Date {
    const dateStr =
      typeof dateInput === "string" ? dateInput : dateInput.toISOString();
    const datePart = dateStr.split("T")[0] ?? dateStr;
    const parts = datePart.split("-").map(Number);
    const year = parts[0] ?? 2026;
    const month = parts[1] ?? 1;
    const day = parts[2] ?? 1;
    return new Date(year, month - 1, day);
  }

  /**
   * Formata Date para string YYYY-MM-DD
   */
  private formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Retorna todos os dias letivos em um intervalo de datas para uma unidade.
   * Considera:
   * - Eventos com isSchoolDay=false como bloqueio
   * - Domingos sempre bloqueados
   * - Sábados bloqueados exceto se houver SABADO_LETIVO
   * - Se não houver eventos, assume seg-sex como letivos (fallback)
   */
  async getSchoolDaysInRange(
    unitId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Date[]> {
    const db = getDb();
    const start = this.toLocalDate(startDate);
    const end = this.toLocalDate(endDate);

    // Buscar TODOS os eventos do calendário para o período
    const events = await db.query.calendarEvents.findMany({
      where: and(
        eq(calendarEvents.unitId, unitId),
        sql`${calendarEvents.startDate} <= ${this.formatDateKey(end)}`,
        sql`${calendarEvents.endDate} >= ${this.formatDateKey(start)}`,
      ),
    });

    const nonSchoolDaysSet = new Set<string>(); // Dias bloqueados (feriados, férias, recessos)
    const sabadosLetivosSet = new Set<string>(); // Sábados que têm aula

    // Processar eventos
    for (const event of events) {
      const eventStart = this.toLocalDate(event.startDate);
      const eventEnd = this.toLocalDate(event.endDate);

      for (
        let d = new Date(eventStart);
        d <= eventEnd;
        d.setDate(d.getDate() + 1)
      ) {
        const dateKey = this.formatDateKey(d);

        // Se o evento marca como não-letivo, adiciona ao set de bloqueio
        if (!event.isSchoolDay) {
          nonSchoolDaysSet.add(dateKey);
        }

        // SABADO_LETIVO adiciona o dia como letivo mesmo sendo sábado
        if (event.eventType === "SABADO_LETIVO") {
          sabadosLetivosSet.add(dateKey);
        }
      }
    }

    const schoolDays: Date[] = [];

    // Iterar sobre todos os dias do intervalo
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateKey = this.formatDateKey(d);
      const dayOfWeek = d.getDay(); // 0=Domingo, 6=Sábado

      // Pular domingos sempre
      if (dayOfWeek === 0) continue;

      // Sábados são letivos apenas se houver SABADO_LETIVO
      if (dayOfWeek === 6 && !sabadosLetivosSet.has(dateKey)) continue;

      // Pular dias marcados como não-letivos (feriados, férias, recessos)
      if (nonSchoolDaysSet.has(dateKey)) continue;

      schoolDays.push(new Date(d));
    }

    return schoolDays;
  }

  /**
   * Verifica se uma data específica é dia letivo para a unidade.
   */
  async isDateSchoolDay(unitId: string, date: Date): Promise<boolean> {
    const schoolDays = await this.getSchoolDaysInRange(unitId, date, date);
    return schoolDays.length > 0;
  }

  /**
   * Retorna dias não-letivos em um intervalo com o motivo do bloqueio.
   */
  async getNonSchoolDaysInRange(
    unitId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<
    Array<{
      date: Date;
      reason: string;
      eventType: string | null;
    }>
  > {
    const db = getDb();
    const start = this.toLocalDate(startDate);
    const end = this.toLocalDate(endDate);

    // Buscar eventos de bloqueio (isSchoolDay = false)
    const blockingEvents = await db.query.calendarEvents.findMany({
      where: and(
        eq(calendarEvents.unitId, unitId),
        sql`${calendarEvents.startDate} <= ${this.formatDateKey(end)}`,
        sql`${calendarEvents.endDate} >= ${this.formatDateKey(start)}`,
        eq(calendarEvents.isSchoolDay, false),
      ),
    });

    // Buscar sábados letivos
    const sabadosLetivos = await db.query.calendarEvents.findMany({
      where: and(
        eq(calendarEvents.unitId, unitId),
        eq(calendarEvents.eventType, "SABADO_LETIVO"),
        sql`${calendarEvents.startDate} <= ${this.formatDateKey(end)}`,
        sql`${calendarEvents.endDate} >= ${this.formatDateKey(start)}`,
      ),
    });

    const sabadosLetivosSet = new Set<string>();
    for (const event of sabadosLetivos) {
      const eventStart = this.toLocalDate(event.startDate);
      const eventEnd = this.toLocalDate(event.endDate);
      for (
        let d = new Date(eventStart);
        d <= eventEnd;
        d.setDate(d.getDate() + 1)
      ) {
        sabadosLetivosSet.add(this.formatDateKey(d));
      }
    }

    const nonSchoolDays: Array<{
      date: Date;
      reason: string;
      eventType: string | null;
    }> = [];
    const processedDates = new Set<string>();

    // Adicionar eventos de bloqueio
    for (const event of blockingEvents) {
      const eventStart = this.toLocalDate(event.startDate);
      const eventEnd = this.toLocalDate(event.endDate);

      for (
        let d = new Date(eventStart);
        d <= eventEnd;
        d.setDate(d.getDate() + 1)
      ) {
        if (d >= start && d <= end) {
          const dateKey = this.formatDateKey(d);
          if (!processedDates.has(dateKey)) {
            processedDates.add(dateKey);
            nonSchoolDays.push({
              date: new Date(d),
              reason: event.title,
              eventType: event.eventType,
            });
          }
        }
      }
    }

    // Adicionar finais de semana (exceto sábados letivos)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateKey = this.formatDateKey(d);
      const dayOfWeek = d.getDay();

      if (processedDates.has(dateKey)) continue;

      if (dayOfWeek === 0) {
        nonSchoolDays.push({
          date: new Date(d),
          reason: "Domingo",
          eventType: null,
        });
        processedDates.add(dateKey);
      } else if (dayOfWeek === 6 && !sabadosLetivosSet.has(dateKey)) {
        nonSchoolDays.push({
          date: new Date(d),
          reason: "Sábado (não letivo)",
          eventType: null,
        });
        processedDates.add(dateKey);
      }
    }

    return nonSchoolDays.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Valida se uma quinzena tem dias letivos suficientes.
   * Retorna objeto com validação e detalhes.
   */
  async validateQuinzenaSchoolDays(
    unitId: string,
    quinzenaId: string,
  ): Promise<{
    isValid: boolean;
    totalDays: number;
    schoolDays: number;
    nonSchoolDays: Array<{ date: string; reason: string }>;
    message: string;
  }> {
    const quinzena = getQuinzenaById(quinzenaId);
    if (!quinzena) {
      return {
        isValid: false,
        totalDays: 0,
        schoolDays: 0,
        nonSchoolDays: [],
        message: "Quinzena não encontrada",
      };
    }

    const startDate = this.toLocalDate(quinzena.startDate);
    const endDate = this.toLocalDate(quinzena.endDate);

    const schoolDays = await this.getSchoolDaysInRange(
      unitId,
      startDate,
      endDate,
    );
    const nonSchoolDaysList = await this.getNonSchoolDaysInRange(
      unitId,
      startDate,
      endDate,
    );

    const totalDays =
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1;

    // Formatar datas para resposta
    const formattedNonSchoolDays = nonSchoolDaysList.map((d) => ({
      date: this.formatDateKey(d.date),
      reason: d.reason,
    }));

    return {
      isValid: schoolDays.length > 0,
      totalDays,
      schoolDays: schoolDays.length,
      nonSchoolDays: formattedNonSchoolDays,
      message:
        schoolDays.length === 0
          ? "Esta quinzena não possui dias letivos. Verifique o calendário escolar."
          : `${schoolDays.length} dias letivos nesta quinzena.`,
    };
  }
}
