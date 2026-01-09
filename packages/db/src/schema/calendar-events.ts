import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { units } from "./units";
import { users } from "./users";

// Enum de tipos de evento
export const calendarEventTypeEnum = [
  "INICIO_SEMESTRE",
  "TERMINO_SEMESTRE",
  "FERIADO",
  "RECESSO",
  "FERIAS_PROFESSORES",
  "SABADO_LETIVO",
  "SEMANA_PROVAS",
  "DIA_LETIVO",
  "REUNIAO_PEDAGOGICA",
  "EVENTO_ESPECIAL",
] as const;

export type CalendarEventType = (typeof calendarEventTypeEnum)[number];

// Tabela calendar_events
export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Multi-tenant: evento pertence a uma unidade
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),

    // Dados do evento
    title: text("title").notNull(),
    description: text("description"),
    eventType: text("event_type", { enum: calendarEventTypeEnum }).notNull(),

    // Range de datas (evento de um dia ou varios dias)
    startDate: date("start_date", { mode: "date" }).notNull(),
    endDate: date("end_date", { mode: "date" }).notNull(),

    // Flags
    isSchoolDay: boolean("is_school_day").notNull().default(true),
    isRecurringAnnually: boolean("is_recurring_annually")
      .notNull()
      .default(false),

    // Auditoria
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    unitDateIdx: index("calendar_events_unit_date_idx").on(
      table.unitId,
      table.startDate,
      table.endDate,
    ),
    eventTypeIdx: index("calendar_events_type_idx").on(table.eventType),
  }),
);

// Tipos inferidos
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type NewCalendarEvent = typeof calendarEvents.$inferInsert;

// Relations
export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  unit: one(units, {
    fields: [calendarEvents.unitId],
    references: [units.id],
  }),
  creator: one(users, {
    fields: [calendarEvents.createdBy],
    references: [users.id],
  }),
}));
