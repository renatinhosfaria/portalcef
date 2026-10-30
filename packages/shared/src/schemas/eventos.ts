import { z } from "zod";

export const eventoStatusSchema = z.enum(["RASCUNHO","REVISAO","PUBLICADO","PAUSADO","ENCERRADO","CANCELADO","ARQUIVADO"]);
export const eventoSessaoStatusSchema = z.enum(["RASCUNHO","PUBLICADA","ESGOTADA","ENCERRADA","CANCELADA"]);
export const eventoParticipanteTipoSchema = z.enum(["ALUNO","CONVIDADO"]);
export const politicaPublicaTipoSchema = z.enum(["PRIVACIDADE","COMPRA","CANCELAMENTO_REEMBOLSO","ACESSIBILIDADE","CONTATO"]);
export const reservaPublicaSchema = z.object({ sessionId: z.string().uuid(), seats: z.array(z.object({ seatId: z.string().uuid(), ticketTypeId: z.string().uuid(), participantIndex: z.number().int().nonnegative() })).min(1).max(20), buyer: z.object({ name: z.string().trim().min(2).max(200), email: z.string().trim().email().max(320), phone: z.string().trim().min(8).max(30) }), idempotencyKey: z.string().trim().min(8).max(180) }).strict();
export const finalizarPedidoSchema = z.object({ participants: z.array(z.object({ participantIndex: z.number().int().nonnegative(), fullName: z.string().trim().min(2).max(200), type: eventoParticipanteTipoSchema, email: z.string().email().optional(), phone: z.string().max(30).optional() })).min(1).max(20), acceptances: z.array(z.object({ type: politicaPublicaTipoSchema, version: z.number().int().positive() })).length(5), idempotencyKey: z.string().trim().min(8).max(180) }).strict();
export const checkoutPublicoSchema = z.object({ successUrl: z.string().url().refine((v) => v.startsWith("https://")), cancelUrl: z.string().url().refine((v) => v.startsWith("https://")), idempotencyKey: z.string().trim().min(8).max(180) }).strict();

const date = z.coerce.date();
export const criarEventoSchema = z.object({
  schoolId: z.string().uuid(), slug: z.string().min(2).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(240), summary: z.string().max(500).optional(), description: z.string().min(1),
  imageUrl: z.string().url().optional().nullable(), category: z.string().max(120).optional(),
  plannedPublicationAt: date.optional().nullable(), publishImmediately: z.boolean().default(false),
  defaultLocationId: z.string().uuid().optional().nullable(), defaultMapId: z.string().uuid().optional().nullable(),
  cancellationPolicy: z.string().min(1), contactEmail: z.string().email(), contactPhone: z.string().max(30).optional().nullable(),
  ticketTypes: z.array(z.object({ name: z.string().min(1).max(160), description: z.string().optional().nullable(), priceCents: z.number().int().nonnegative(), eligibility: z.string().optional().nullable(), maxPerOrder: z.number().int().positive().optional().nullable(), salesLot: z.string().max(100).optional().nullable(), rules: z.record(z.string(), z.unknown()).optional().nullable() })).default([]),
  policies: z.array(z.object({ type: z.enum(["PRIVACIDADE","COMPRA","CANCELAMENTO_REEMBOLSO","ACESSIBILIDADE","CONTATO"]), content: z.string().min(1), version: z.number().int().positive().optional() })).default([]),
  sessions: z.array(z.object({ startsAt: date, endsAt: date, capacity: z.number().int().positive(), locationId: z.string().uuid().optional().nullable(), mapId: z.string().uuid().optional().nullable(), salesStartsAt: date.optional().nullable(), salesEndsAt: date.optional().nullable(), status: eventoSessaoStatusSchema.optional() })).default([]),
});
export const atualizarEventoSchema = criarEventoSchema.partial().omit({schoolId: true, publishImmediately: true}).extend({ publishImmediately: z.boolean().optional(), updatedAt: date.optional(), expectedUpdatedAt: date.optional() }).strict();
export const criarRascunhoSchema = z.object({ title: z.string().trim().min(1).max(240) }).strict();
export const atualizarRascunhoSchema = atualizarEventoSchema;
export const atualizarMapaPadraoSchema = z.object({ mapId: z.string().uuid() }).strict();
export const localEventoSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1),
  room: z.string().trim().max(160).nullable().optional(),
  instructions: z.string().trim().nullable().optional(),
  accessibility: z.string().trim().nullable().optional(),
}).strict();
export const atualizarLocalEventoSchema = localEventoSchema.partial().extend({ expectedUpdatedAt: date.optional() }).strict();
export const atualizarLocalPadraoEventoSchema = z.object({ defaultLocationId: z.string().uuid().nullable(), expectedUpdatedAt: date.optional() }).strict();
export const criarSessaoSchema = z.object({ startsAt: date, endsAt: date, capacity: z.number().int().positive(), locationId: z.string().uuid().optional().nullable(), mapId: z.string().uuid().optional().nullable(), salesStartsAt: date.optional().nullable(), salesEndsAt: date.optional().nullable(), status: eventoSessaoStatusSchema.optional() }).strict();
export const politicaSchema = z.object({ type: z.enum(["PRIVACIDADE","COMPRA","CANCELAMENTO_REEMBOLSO","ACESSIBILIDADE","CONTATO"]), content: z.string().min(1), version: z.number().int().positive().optional() });
export const eventoListQuerySchema = z.object({ status: eventoStatusSchema.optional(), search: z.string().max(120).optional() });
export const criarEventoInputSchema = criarEventoSchema;
export type CriarEventoInput = z.infer<typeof criarEventoSchema>;
export type AtualizarEventoInput = z.infer<typeof atualizarEventoSchema>;
export type CriarRascunhoInput = z.infer<typeof criarRascunhoSchema>;
export type AtualizarRascunhoInput = z.infer<typeof atualizarRascunhoSchema>;
export type AtualizarMapaPadraoInput = z.infer<typeof atualizarMapaPadraoSchema>;
export type LocalEventoInput = z.infer<typeof localEventoSchema>;
export type AtualizarLocalEventoInput = z.infer<typeof atualizarLocalEventoSchema>;
export type AtualizarLocalPadraoEventoInput = z.infer<typeof atualizarLocalPadraoEventoSchema>;
export type CriarSessaoInput = z.infer<typeof criarSessaoSchema>;
export type EventoListQuery = z.infer<typeof eventoListQuerySchema>;
export type ReservaPublicaInput = z.infer<typeof reservaPublicaSchema>;
export type FinalizarPedidoInput = z.infer<typeof finalizarPedidoSchema>;
export type CheckoutPublicoInput = z.infer<typeof checkoutPublicoSchema>;
