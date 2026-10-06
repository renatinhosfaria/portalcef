import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import {
  getDb,
  calendarEvents,
  planoAulaPeriodo,
  eq,
  and,
  or,
  asc,
  sql,
} from "@essencia/db";
import type {
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  QueryCalendarEventsInput,
} from "@essencia/shared/schemas";
import { TenantScopeService } from "../../common/tenant/tenant-scope.service";

interface UserContext {
  userId: string;
  role: string;
  schoolId: string;
  unitId: string | null;
}

@Injectable()
export class CalendarService {
  constructor(private readonly tenantScope: TenantScopeService) {}

  async getEvents(user: UserContext, query: QueryCalendarEventsInput) {
    const db = getDb();
    const filters = [];

    // Multi-tenant filtering
    if (user.role === "master") {
      if (query.unitId) filters.push(eq(calendarEvents.unitId, query.unitId));
    } else if (user.role === "diretora_geral") {
      if (query.unitId) {
        await this.tenantScope.assertUnitAccess(user, query.unitId);
        filters.push(eq(calendarEvents.unitId, query.unitId));
      } else {
        const ids = await this.tenantScope.listUnitIdsForSchool(user.schoolId);
        if (ids.length > 0) {
          filters.push(
            sql`${calendarEvents.unitId} IN (${sql.join(
              ids.map((id: string) => sql`${id}`),
              sql`, `,
            )})`,
          );
        } else {
          filters.push(sql`1 = 0`);
        }
      }
    } else {
      const targetUnitId = user.unitId ?? query.unitId;
      if (!targetUnitId) {
        throw new ForbiddenException("Usuário sem unidade");
      }
      await this.tenantScope.assertUnitAccess(user, targetUnitId);
      filters.push(eq(calendarEvents.unitId, targetUnitId));
    }

    const period = this.getQueryPeriod(query);
    if (period) {
      const overlap = and(
        sql`${calendarEvents.startDate} <= ${period.endKey}`,
        sql`${calendarEvents.endDate} >= ${period.startKey}`,
      );
      filters.push(or(overlap, eq(calendarEvents.isRecurringAnnually, true)));
    }
    if (query.eventType) {
      filters.push(eq(calendarEvents.eventType, query.eventType));
    }

    const events = await db.query.calendarEvents.findMany({
      where: filters.length > 0 ? and(...filters) : undefined,
      orderBy: [asc(calendarEvents.startDate)],
    });

    return this.projectEventsForPeriod(events, period);
  }

  async getEventById(user: UserContext, id: string) {
    const db = getDb();
    const event = await db.query.calendarEvents.findFirst({
      where: eq(calendarEvents.id, id),
    });

    if (!event) {
      throw new NotFoundException("Evento não encontrado");
    }

    await this.tenantScope.assertUnitAccess(user, event.unitId);

    return event;
  }

  async createEvent(user: UserContext, data: CreateCalendarEventInput) {
    const db = getDb();

    await this.tenantScope.assertUnitAccess(user, data.unitId);

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
    const existing = await this.getEventById(user, id);

    const startDate = data.startDate ?? existing.startDate;
    const endDate = data.endDate ?? existing.endDate;
    if (
      this.formatDateKey(this.toLocalDate(endDate)) <
      this.formatDateKey(this.toLocalDate(startDate))
    ) {
      throw new BadRequestException(
        "Data final deve ser maior ou igual à data inicial",
      );
    }

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

  async getStats(
    user: UserContext,
    unitId?: string,
    year = new Date().getFullYear(),
  ) {
    const events = await this.getEvents(user, {
      ...(unitId ? { unitId } : {}),
      year,
    });

    const monthlyStats = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      schoolDays: 0,
      totalDays: new Date(year, i + 1, 0).getDate(),
      events: 0,
    }));

    const nonSchoolDays = new Set<string>();
    const sabadosLetivos = new Set<string>();
    const eventIdsByMonth = Array.from({ length: 12 }, () => new Set<string>());

    for (const event of events) {
      const start = this.toLocalDate(event.startDate);
      const end = this.toLocalDate(event.endDate);

      for (
        let date = new Date(start);
        date <= end;
        date.setDate(date.getDate() + 1)
      ) {
        const dateKey = this.formatDateKey(date);
        const month = date.getMonth();
        if (date.getFullYear() === year && month >= 0 && month < 12) {
          eventIdsByMonth[month]?.add(event.id);
        }
        if (!event.isSchoolDay) nonSchoolDays.add(dateKey);
        if (event.eventType === "SABADO_LETIVO") sabadosLetivos.add(dateKey);
      }
    }

    for (const [index, eventIds] of eventIdsByMonth.entries()) {
      monthlyStats[index]!.events = eventIds.size;
    }

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);
    for (
      let date = new Date(yearStart);
      date <= yearEnd;
      date.setDate(date.getDate() + 1)
    ) {
      const dateKey = this.formatDateKey(date);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0) continue;
      if (dayOfWeek === 6 && !sabadosLetivos.has(dateKey)) continue;
      if (nonSchoolDays.has(dateKey)) continue;
      monthlyStats[date.getMonth()]!.schoolDays++;
    }

    const totalSchoolDays = monthlyStats.reduce(
      (sum, m) => sum + m.schoolDays,
      0,
    );

    return {
      year,
      totalSchoolDays,
      totalEvents: new Set(events.map((event) => event.id)).size,
      monthlyStats,
    };
  }

  private getQueryPeriod(query: QueryCalendarEventsInput): {
    year: number;
    startKey: string;
    endKey: string;
  } | null {
    if (!query.year && !query.month) return null;

    const year = query.year ?? new Date().getFullYear();
    const month = query.month;
    const start = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
    const end = month ? new Date(year, month, 0) : new Date(year, 11, 31);

    return {
      year,
      startKey: this.formatDateKey(start),
      endKey: this.formatDateKey(end),
    };
  }

  private projectEventsForPeriod<
    T extends {
      id: string;
      title: string;
      startDate: string | Date;
      endDate: string | Date;
      isRecurringAnnually: boolean;
      isSchoolDay: boolean;
      eventType: string;
    },
  >(events: T[], period: ReturnType<CalendarService["getQueryPeriod"]>) {
    if (!period) return events;

    return events
      .flatMap((event) => {
        if (!event.isRecurringAnnually) return [event];

        const start = this.toLocalDate(event.startDate);
        const end = this.toLocalDate(event.endDate);
        const atravessaAno =
          end.getMonth() < start.getMonth() ||
          (end.getMonth() === start.getMonth() &&
            end.getDate() < start.getDate());
        const anos = atravessaAno
          ? [period.year - 1, period.year]
          : [period.year];

        return anos.map((ano) => ({
          ...event,
          startDate: this.criarDataCivil(
            ano,
            start.getMonth(),
            start.getDate(),
          ),
          endDate: this.criarDataCivil(
            atravessaAno ? ano + 1 : ano,
            end.getMonth(),
            end.getDate(),
          ),
        }));
      })
      .filter(
        (event) =>
          this.formatDateKey(this.toLocalDate(event.startDate)) <=
            period.endKey &&
          this.formatDateKey(this.toLocalDate(event.endDate)) >=
            period.startKey,
      );
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

  private criarDataCivil(year: number, month: number, day: number): Date {
    if (month === 1 && day === 29 && !this.isAnoBissexto(year)) {
      return new Date(year, month, 1);
    }
    return new Date(year, month, day);
  }

  private isAnoBissexto(year: number): boolean {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
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
    const period = {
      year: start.getFullYear(),
      startKey: this.formatDateKey(start),
      endKey: this.formatDateKey(end),
    };

    // Buscar TODOS os eventos do calendário para o período
    const events = await db.query.calendarEvents.findMany({
      where: and(
        eq(calendarEvents.unitId, unitId),
        or(
          and(
            sql`${calendarEvents.startDate} <= ${this.formatDateKey(end)}`,
            sql`${calendarEvents.endDate} >= ${this.formatDateKey(start)}`,
          ),
          eq(calendarEvents.isRecurringAnnually, true),
        ),
      ),
    });
    const eventosProjetados = this.projectEventsForPeriod(events, period);

    const nonSchoolDaysSet = new Set<string>(); // Dias bloqueados (feriados, férias, recessos)
    const sabadosLetivosSet = new Set<string>(); // Sábados que têm aula

    // Processar eventos
    for (const event of eventosProjetados) {
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
    const period = {
      year: start.getFullYear(),
      startKey: this.formatDateKey(start),
      endKey: this.formatDateKey(end),
    };

    // Buscar eventos de bloqueio (isSchoolDay = false)
    const blockingEvents = await db.query.calendarEvents.findMany({
      where: and(
        eq(calendarEvents.unitId, unitId),
        eq(calendarEvents.isSchoolDay, false),
        or(
          and(
            sql`${calendarEvents.startDate} <= ${this.formatDateKey(end)}`,
            sql`${calendarEvents.endDate} >= ${this.formatDateKey(start)}`,
          ),
          eq(calendarEvents.isRecurringAnnually, true),
        ),
      ),
    });
    const eventosBloqueadores = this.projectEventsForPeriod(
      blockingEvents,
      period,
    );

    // Buscar sábados letivos
    const sabadosLetivos = await db.query.calendarEvents.findMany({
      where: and(
        eq(calendarEvents.unitId, unitId),
        eq(calendarEvents.eventType, "SABADO_LETIVO"),
        or(
          and(
            sql`${calendarEvents.startDate} <= ${this.formatDateKey(end)}`,
            sql`${calendarEvents.endDate} >= ${this.formatDateKey(start)}`,
          ),
          eq(calendarEvents.isRecurringAnnually, true),
        ),
      ),
    });
    const eventosSabadosLetivos = this.projectEventsForPeriod(
      sabadosLetivos,
      period,
    );

    const sabadosLetivosSet = new Set<string>();
    for (const event of eventosSabadosLetivos) {
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
    for (const event of eventosBloqueadores) {
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
   * Retorna a data de início das férias de julho para um ano específico.
   * Usado para determinar a divisão entre 1º e 2º semestre.
   */
  async getFeriasJulhoStartDate(
    unitId: string,
    year: number,
  ): Promise<
    | { success: true; data: { startDate: string } }
    | { success: false; error: string }
  > {
    const db = getDb();

    // Buscar evento de férias que contenha "Julho" no título ou seja em julho
    const feriasEvents = await db.query.calendarEvents.findMany({
      where: and(
        eq(calendarEvents.unitId, unitId),
        eq(calendarEvents.eventType, "FERIAS_PROFESSORES"),
        sql`EXTRACT(YEAR FROM ${calendarEvents.startDate}) = ${year}`,
        sql`EXTRACT(MONTH FROM ${calendarEvents.startDate}) >= 6`, // Junho ou julho
        sql`EXTRACT(MONTH FROM ${calendarEvents.startDate}) <= 7`, // Junho ou julho
      ),
      orderBy: [asc(calendarEvents.startDate)],
    });

    // Procurar especificamente as férias de julho
    const feriasJulho = feriasEvents.find(
      (e: (typeof feriasEvents)[number]) =>
        e.title.toLowerCase().includes("julho") ||
        this.toLocalDate(e.startDate).getMonth() === 6,
    );

    if (feriasJulho) {
      return {
        success: true,
        data: {
          startDate: this.formatDateKey(
            this.toLocalDate(feriasJulho.startDate),
          ),
        },
      };
    }

    // Fallback: se não encontrou, usa 13 de julho como padrão
    return {
      success: true,
      data: {
        startDate: `${year}-07-13`,
      },
    };
  }

  /**
   * Valida uma quinzena usando as datas do período de planejamento e o calendário da unidade.
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
    const db = getDb();
    const periodo = await db.query.planoAulaPeriodo.findFirst({
      where: and(
        eq(planoAulaPeriodo.id, quinzenaId),
        eq(planoAulaPeriodo.unidadeId, unitId),
      ),
    });

    if (!periodo) {
      throw new NotFoundException("Período de planejamento não encontrado");
    }

    const start = this.toLocalDate(periodo.dataInicio);
    const end = this.toLocalDate(periodo.dataFim);
    const schoolDays = await this.getSchoolDaysInRange(unitId, start, end);
    const nonSchoolDays = await this.getNonSchoolDaysInRange(
      unitId,
      start,
      end,
    );
    const totalDays =
      Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;

    return {
      isValid: schoolDays.length > 0,
      totalDays,
      schoolDays: schoolDays.length,
      nonSchoolDays: nonSchoolDays.map((item) => ({
        date: this.formatDateKey(item.date),
        reason: item.reason,
      })),
      message:
        schoolDays.length > 0
          ? `${schoolDays.length} dias letivos disponíveis no período`
          : "Não há dias letivos disponíveis no período",
    };
  }
}
