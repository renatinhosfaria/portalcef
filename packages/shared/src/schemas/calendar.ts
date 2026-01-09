import { z } from "zod";

// Enum de tipos de evento
export const calendarEventTypeSchema = z.enum([
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
]);

// Schema completo do evento
export const calendarEventSchema = z.object({
  id: z.string().uuid(),
  unitId: z.string().uuid(),
  title: z.string().min(2).max(200),
  description: z.string().max(1000).nullable(),
  eventType: calendarEventTypeSchema,
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isSchoolDay: z.boolean(),
  isRecurringAnnually: z.boolean(),
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Schema base para criacao (sem validacao)
const baseCreateCalendarEventSchema = z.object({
  unitId: z.string().uuid("Unidade inválida"),
  title: z
    .string()
    .min(2, "Título deve ter pelo menos 2 caracteres")
    .max(200, "Título deve ter no máximo 200 caracteres"),
  description: z.string().max(1000).optional(),
  eventType: calendarEventTypeSchema,
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isSchoolDay: z.boolean().default(true),
  isRecurringAnnually: z.boolean().default(false),
});

// Schema para criacao (com validacao de data)
export const createCalendarEventSchema = baseCreateCalendarEventSchema.refine(
  (data) => data.endDate >= data.startDate,
  {
    message: "Data final deve ser maior ou igual a data inicial",
    path: ["endDate"],
  },
);

// Schema para atualizacao
export const updateCalendarEventSchema = baseCreateCalendarEventSchema
  .omit({ unitId: true })
  .partial()
  .refine(
    (data) =>
      !data.startDate || !data.endDate || data.endDate >= data.startDate,
    {
      message: "Data final deve ser maior ou igual a data inicial",
      path: ["endDate"],
    },
  );

// Schema para query params
export const queryCalendarEventsSchema = z.object({
  unitId: z.string().uuid().optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  eventType: calendarEventTypeSchema.optional(),
});

// Tipos exportados
export type CalendarEventType = z.infer<typeof calendarEventTypeSchema>;
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type CreateCalendarEventInput = z.infer<
  typeof createCalendarEventSchema
>;
export type UpdateCalendarEventInput = z.infer<
  typeof updateCalendarEventSchema
>;
export type QueryCalendarEventsInput = z.infer<
  typeof queryCalendarEventsSchema
>;
