import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  type AnyPgColumn,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { schools } from "./schools.js";
import { users } from "./users.js";

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const eventoStatusEnum = [
  "RASCUNHO",
  "REVISAO",
  "PUBLICADO",
  "PAUSADO",
  "ENCERRADO",
  "CANCELADO",
  "ARQUIVADO",
] as const;
export type EventoStatus = (typeof eventoStatusEnum)[number];

export const eventoSessaoStatusEnum = [
  "RASCUNHO",
  "PUBLICADA",
  "ESGOTADA",
  "ENCERRADA",
  "CANCELADA",
] as const;
export type EventoSessaoStatus = (typeof eventoSessaoStatusEnum)[number];

export const eventoMapaStatusEnum = [
  "ENVIADO",
  "DETECTANDO",
  "EM_REVISAO",
  "CONFIRMADO",
  "ARQUIVADO",
] as const;
export type EventoMapaStatus = (typeof eventoMapaStatusEnum)[number];

export const eventoInventarioStatusEnum = [
  "DISPONIVEL",
  "RESERVADO",
  "VENDIDO",
  "BLOQUEADO",
  "LIBERADO",
] as const;
export type EventoInventarioStatus =
  (typeof eventoInventarioStatusEnum)[number];

export const eventoPedidoStatusEnum = [
  "INICIADO",
  "RESERVADO",
  "AGUARDANDO_PAGAMENTO",
  "CONFIRMADO",
  "USADO",
  "NO_SHOW",
  "CANCELADO",
  "REEMBOLSADO",
  "EXPIRADO",
] as const;
export type EventoPedidoStatus = (typeof eventoPedidoStatusEnum)[number];

export const eventoPagamentoMetodoEnum = ["card", "pix"] as const;
export type EventoPagamentoMetodo = (typeof eventoPagamentoMetodoEnum)[number];

export const eventoPagamentoStatusEnum = [
  "PENDENTE",
  "PROCESSANDO",
  "APROVADO",
  "RECUSADO",
  "EXPIRADO",
  "CANCELADO",
] as const;
export type EventoPagamentoStatus =
  (typeof eventoPagamentoStatusEnum)[number];

export const eventoParticipanteTipoEnum = ["ALUNO", "CONVIDADO"] as const;
export type EventoParticipanteTipo = (typeof eventoParticipanteTipoEnum)[number];

export const eventoOperacaoTipoEnum = [
  "BLOQUEIO",
  "CORTESIA",
  "RESERVA",
] as const;
export type EventoOperacaoTipo = (typeof eventoOperacaoTipoEnum)[number];

export const eventoOperacaoStatusEnum = [
  "ATIVA",
  "CANCELADA",
  "EXPIRADA",
] as const;
export type EventoOperacaoStatus = (typeof eventoOperacaoStatusEnum)[number];

export const eventoIngressoStatusEnum = [
  "EMITIDO",
  "USADO",
  "CANCELADO",
  "REEMITIDO",
  "REVOGADO",
] as const;
export type EventoIngressoStatus = (typeof eventoIngressoStatusEnum)[number];

export const eventoCheckinResultadoEnum = [
  "VALIDO",
  "JA_UTILIZADO",
  "CANCELADO",
  "SESSAO_INCORRETA",
  "FORA_DA_JANELA",
  "RECUSADO",
] as const;
export type EventoCheckinResultado =
  (typeof eventoCheckinResultadoEnum)[number];

export const eventoImportacaoStatusEnum = [
  "ENVIADA",
  "PROCESSANDO",
  "EM_REVISAO",
  "CONFIRMADA",
  "REJEITADA",
] as const;
export type EventoImportacaoStatus =
  (typeof eventoImportacaoStatusEnum)[number];

export const eventoDeteccaoStatusEnum = [
  "PENDENTE",
  "ACEITA",
  "CORRIGIDA",
  "REJEITADA",
] as const;
export type EventoDeteccaoStatus = (typeof eventoDeteccaoStatusEnum)[number];

export const eventoPoliticaTipoEnum = [
  "PRIVACIDADE",
  "COMPRA",
  "CANCELAMENTO_REEMBOLSO",
  "ACESSIBILIDADE",
  "CONTATO",
] as const;
export type EventoPoliticaTipo = (typeof eventoPoliticaTipoEnum)[number];

export const eventoAceiteTipoEnum = ["PRIVACIDADE", "COMPRA", "CANCELAMENTO_REEMBOLSO", "ACESSIBILIDADE", "CONTATO"] as const;
export type EventoAceiteTipo = (typeof eventoAceiteTipoEnum)[number];

export const eventoAuditoriaAcaoEnum = [
  "CRIADO",
  "ATUALIZADO",
  "PUBLICADO",
  "PAUSADO",
  "CANCELADO",
  "RESERVADO",
  "CONFIRMADO",
  "EXPIRADO",
  "REEMBOLSADO",
  "TRANSFERIDO",
  "CHECKIN",
  "BLOQUEADO",
] as const;
export type EventoAuditoriaAcao = (typeof eventoAuditoriaAcaoEnum)[number];

export const eventos = pgTable(
  "eventos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    slug: varchar("slug", { length: 160 }).notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    summary: varchar("summary", { length: 500 }),
    description: text("description"),
    imageUrl: varchar("image_url", { length: 500 }),
    category: varchar("category", { length: 120 }),
    defaultLocationId: uuid("default_location_id").references(
      (): AnyPgColumn => eventoLocais.id,
      { onDelete: "set null" },
    ),
    defaultMapId: uuid("default_map_id").references((): AnyPgColumn => eventoMapas.id, {
      onDelete: "set null",
    }),
    status: text("status", { enum: eventoStatusEnum })
      .notNull()
      .default("RASCUNHO"),
    plannedPublicationAt: timestamp("planned_publication_at", {
      withTimezone: true,
    }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    cancellationPolicy: text("cancellation_policy"),
    contactEmail: varchar("contact_email", { length: 320 }),
    contactPhone: varchar("contact_phone", { length: 30 }),
    ...timestamps(),
  },
  (table) => ({
    schoolSlugUnique: uniqueIndex("uq_eventos_school_slug").on(
      table.schoolId,
      table.slug,
    ),
    schoolStatusIdx: index("idx_eventos_school_status").on(
      table.schoolId,
      table.status,
    ),
    plannedPublicationIdx: index("idx_eventos_planned_publication").on(
      table.plannedPublicationAt,
    ),
  }),
);
export type Evento = typeof eventos.$inferSelect;
export type NewEvento = typeof eventos.$inferInsert;

export const eventoLocais = pgTable(
  "evento_locais",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 200 }).notNull(),
    address: text("address").notNull(),
    room: varchar("room", { length: 160 }),
    instructions: text("instructions"),
    accessibility: text("accessibility"),
    ...timestamps(),
  },
  (table) => ({
    schoolIdx: index("idx_evento_locais_school").on(table.schoolId),
  }),
);
export type EventoLocal = typeof eventoLocais.$inferSelect;
export type NewEventoLocal = typeof eventoLocais.$inferInsert;

export const eventoMapas = pgTable(
  "evento_mapas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references((): AnyPgColumn => eventos.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    originalFileKey: varchar("original_file_key", { length: 500 }).notNull(),
    originalFileName: varchar("original_file_name", { length: 255 }),
    originalMimeType: varchar("original_mime_type", { length: 120 }),
    previewFileKey: varchar("preview_file_key", { length: 500 }),
    status: text("status", { enum: eventoMapaStatusEnum })
      .notNull()
      .default("ENVIADO"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmedBy: uuid("confirmed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (table) => ({
    eventVersionUnique: uniqueIndex("uq_evento_mapas_event_version").on(
      table.eventId,
      table.version,
    ),
    eventStatusIdx: index("idx_evento_mapas_event_status").on(
      table.eventId,
      table.status,
    ),
  }),
);
export type EventoMapa = typeof eventoMapas.$inferSelect;
export type NewEventoMapa = typeof eventoMapas.$inferInsert;

export const eventoMapaAssentos = pgTable(
  "evento_mapa_assentos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mapId: uuid("map_id")
      .notNull()
      .references(() => eventoMapas.id, { onDelete: "cascade" }),
    rowLabel: varchar("row_label", { length: 30 }).notNull(),
    seatNumber: varchar("seat_number", { length: 30 }).notNull(),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    width: integer("width").notNull().default(1),
    height: integer("height").notNull().default(1),
    category: varchar("category", { length: 80 }),
    accessible: boolean("accessible").notNull().default(false),
    sellable: boolean("sellable").notNull().default(true),
    metadata: jsonb("metadata"),
    ...timestamps(),
  },
  (table) => ({
    mapSeatUnique: uniqueIndex("uq_evento_mapa_assentos_map_seat").on(
      table.mapId,
      table.rowLabel,
      table.seatNumber,
    ),
    mapIdx: index("idx_evento_mapa_assentos_map").on(table.mapId),
    positiveDimensions: check(
      "evento_mapa_assentos_positive_dimensions",
      sql`${table.width} > 0 AND ${table.height} > 0`,
    ),
  }),
);
export type EventoMapaAssento = typeof eventoMapaAssentos.$inferSelect;
export type NewEventoMapaAssento = typeof eventoMapaAssentos.$inferInsert;

export const eventoSessoes = pgTable(
  "evento_sessoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => eventos.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    locationId: uuid("location_id").references(() => eventoLocais.id, {
      onDelete: "restrict",
    }),
    mapId: uuid("map_id").references(() => eventoMapas.id, {
      onDelete: "restrict",
    }),
    salesStartsAt: timestamp("sales_starts_at", { withTimezone: true }),
    salesEndsAt: timestamp("sales_ends_at", { withTimezone: true }),
    capacity: integer("capacity").notNull(),
    status: text("status", { enum: eventoSessaoStatusEnum })
      .notNull()
      .default("RASCUNHO"),
    publishedVersion: integer("published_version"),
    ...timestamps(),
  },
  (table) => ({
    eventStartsIdx: index("idx_evento_sessoes_event_starts").on(
      table.eventId,
      table.startsAt,
    ),
    eventStatusIdx: index("idx_evento_sessoes_event_status").on(
      table.eventId,
      table.status,
    ),
    positiveCapacity: check(
      "evento_sessoes_positive_capacity",
      sql`${table.capacity} > 0`,
    ),
    validTimes: check(
      "evento_sessoes_valid_times",
      sql`${table.endsAt} > ${table.startsAt}`,
    ),
  }),
);
export type EventoSessao = typeof eventoSessoes.$inferSelect;
export type NewEventoSessao = typeof eventoSessoes.$inferInsert;

export const eventoInventarioAssentos = pgTable(
  "evento_inventario_assentos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => eventoSessoes.id, { onDelete: "cascade" }),
    seatId: uuid("seat_id")
      .notNull()
      .references(() => eventoMapaAssentos.id, { onDelete: "restrict" }),
    status: text("status", { enum: eventoInventarioStatusEnum })
      .notNull()
      .default("DISPONIVEL"),
    reservationExpiresAt: timestamp("reservation_expires_at", {
      withTimezone: true,
    }),
    reservedByOrderId: uuid("reserved_by_order_id").references(
      (): AnyPgColumn => eventoPedidos.id,
      { onDelete: "set null" },
    ),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    blockedReason: text("blocked_reason"),
    ...timestamps(),
  },
  (table) => ({
    sessionSeatUnique: uniqueIndex("uq_evento_inventario_session_seat").on(
      table.sessionId,
      table.seatId,
    ),
    sessionStatusIdx: index("idx_evento_inventario_session_status").on(
      table.sessionId,
      table.status,
    ),
    reservationExpiryIdx: index("idx_evento_inventario_reservation_expiry").on(
      table.reservationExpiresAt,
    ),
  }),
);
export type EventoInventarioAssento =
  typeof eventoInventarioAssentos.$inferSelect;
export type NewEventoInventarioAssento =
  typeof eventoInventarioAssentos.$inferInsert;

export const eventoTiposIngresso = pgTable(
  "evento_tipos_ingresso",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => eventos.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    eligibility: text("eligibility"),
    maxPerOrder: integer("max_per_order"),
    salesLot: varchar("sales_lot", { length: 100 }),
    rules: jsonb("rules"),
    version: integer("version").notNull().default(1),
    active: boolean("active").notNull().default(true),
    ...timestamps(),
  },
  (table) => ({
    eventIdx: index("idx_evento_tipos_ingresso_event").on(table.eventId),
    positivePrice: check(
      "evento_tipos_ingresso_non_negative_price",
      sql`${table.priceCents} >= 0`,
    ),
    positiveLimit: check(
      "evento_tipos_ingresso_positive_limit",
      sql`${table.maxPerOrder} IS NULL OR ${table.maxPerOrder} > 0`,
    ),
  }),
);
export type EventoTipoIngresso = typeof eventoTiposIngresso.$inferSelect;
export type NewEventoTipoIngresso = typeof eventoTiposIngresso.$inferInsert;

export const eventoOfertas = pgTable(
  "evento_ofertas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => eventos.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    minQuantity: integer("min_quantity").notNull(),
    maxQuantity: integer("max_quantity").notNull(),
    priceCents: integer("price_cents").notNull(),
    compatibleTicketTypeIds: jsonb("compatible_ticket_type_ids"),
    version: integer("version").notNull().default(1),
    active: boolean("active").notNull().default(true),
    ...timestamps(),
  },
  (table) => ({
    eventIdx: index("idx_evento_ofertas_event").on(table.eventId),
    positiveQuantity: check(
      "evento_ofertas_positive_quantity",
      sql`${table.minQuantity} > 0 AND ${table.maxQuantity} >= ${table.minQuantity}`,
    ),
    nonNegativePrice: check(
      "evento_ofertas_non_negative_price",
      sql`${table.priceCents} >= 0`,
    ),
  }),
);
export type EventoOferta = typeof eventoOfertas.$inferSelect;
export type NewEventoOferta = typeof eventoOfertas.$inferInsert;

export const eventoPedidos = pgTable(
  "evento_pedidos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => eventos.id, { onDelete: "restrict" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => eventoSessoes.id, { onDelete: "restrict" }),
    orderNumber: varchar("order_number", { length: 32 }).notNull(),
    buyerName: varchar("buyer_name", { length: 200 }).notNull(),
    buyerEmail: varchar("buyer_email", { length: 320 }).notNull(),
    buyerPhone: varchar("buyer_phone", { length: 30 }).notNull(),
    status: text("status", { enum: eventoPedidoStatusEnum })
      .notNull()
      .default("INICIADO"),
    totalCents: integer("total_cents").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 180 }).notNull(),
    finalizationIdempotencyKey: varchar("finalization_idempotency_key", { length: 180 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    ...timestamps(),
  },
  (table) => ({
    orderNumberUnique: uniqueIndex("uq_evento_pedidos_order_number").on(
      table.orderNumber,
    ),
    idempotencyUnique: uniqueIndex("uq_evento_pedidos_idempotency_key").on(
      table.idempotencyKey,
    ),
    finalizationIdempotencyUnique: uniqueIndex("uq_evento_pedidos_finalization_idempotency_key").on(table.finalizationIdempotencyKey),
    eventStatusIdx: index("idx_evento_pedidos_event_status").on(
      table.eventId,
      table.status,
    ),
    buyerEmailIdx: index("idx_evento_pedidos_buyer_email").on(
      table.buyerEmail,
    ),
    nonNegativeTotal: check(
      "evento_pedidos_non_negative_total",
      sql`${table.totalCents} >= 0`,
    ),
  }),
);
export type EventoPedido = typeof eventoPedidos.$inferSelect;
export type NewEventoPedido = typeof eventoPedidos.$inferInsert;

export const eventoItensPedido = pgTable(
  "evento_itens_pedido",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => eventoPedidos.id, { onDelete: "cascade" }),
    inventorySeatId: uuid("inventory_seat_id")
      .notNull()
      .references(() => eventoInventarioAssentos.id, { onDelete: "restrict" }),
    ticketTypeId: uuid("ticket_type_id")
      .notNull()
      .references(() => eventoTiposIngresso.id, { onDelete: "restrict" }),
    participantId: uuid("participant_id").references(
      (): AnyPgColumn => eventoParticipantes.id,
      { onDelete: "set null" },
    ),
    quantity: integer("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull(),
    totalPriceCents: integer("total_price_cents").notNull(),
    pricingEvidence: jsonb("pricing_evidence"),
    ...timestamps(),
  },
  (table) => ({
    orderIdx: index("idx_evento_itens_pedido_order").on(table.orderId),
    seatIdx: index("idx_evento_itens_pedido_inventory_seat").on(
      table.inventorySeatId,
    ),
    positiveQuantity: check(
      "evento_itens_pedido_positive_quantity",
      sql`${table.quantity} > 0`,
    ),
    nonNegativePrices: check(
      "evento_itens_pedido_non_negative_prices",
      sql`${table.unitPriceCents} >= 0 AND ${table.totalPriceCents} >= 0`,
    ),
  }),
);
export type EventoItemPedido = typeof eventoItensPedido.$inferSelect;
export type NewEventoItemPedido = typeof eventoItensPedido.$inferInsert;

export const eventoParticipantes = pgTable(
  "evento_participantes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => eventos.id, { onDelete: "restrict" }),
    orderId: uuid("order_id").references((): AnyPgColumn => eventoPedidos.id, {
      onDelete: "cascade",
    }),
    type: text("type", { enum: eventoParticipanteTipoEnum }).notNull(),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    className: varchar("class_name", { length: 120 }),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 30 }),
    ...timestamps(),
  },
  (table) => ({
    eventIdx: index("idx_evento_participantes_event").on(table.eventId),
    orderIdx: index("idx_evento_participantes_order").on(table.orderId),
    emailIdx: index("idx_evento_participantes_email").on(table.email),
  }),
);
export type EventoParticipante = typeof eventoParticipantes.$inferSelect;
export type NewEventoParticipante = typeof eventoParticipantes.$inferInsert;

export const eventoReservas = pgTable(
  "evento_reservas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => eventoPedidos.id, { onDelete: "cascade" }),
    inventorySeatId: uuid("inventory_seat_id")
      .notNull()
      .references(() => eventoInventarioAssentos.id, { onDelete: "restrict" }),
    idempotencyKey: varchar("idempotency_key", { length: 180 }).notNull(),
    status: text("status", { enum: ["ATIVA", "LIBERADA", "CONVERTIDA"] as const })
      .notNull()
      .default("ATIVA"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => ({
    idempotencyUnique: uniqueIndex("uq_evento_reservas_idempotency").on(
      table.idempotencyKey,
    ),
    orderIdx: index("idx_evento_reservas_order").on(table.orderId),
    expiryIdx: index("idx_evento_reservas_expiry").on(table.expiresAt),
    seatIdx: index("idx_evento_reservas_seat").on(table.inventorySeatId),
  }),
);
export type EventoReserva = typeof eventoReservas.$inferSelect;
export type NewEventoReserva = typeof eventoReservas.$inferInsert;

export const eventoOperacoesAdministrativas = pgTable(
  "evento_operacoes_administrativas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => eventos.id, { onDelete: "restrict" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => eventoSessoes.id, { onDelete: "restrict" }),
    inventorySeatId: uuid("inventory_seat_id")
      .notNull()
      .references(() => eventoInventarioAssentos.id, { onDelete: "restrict" }),
    type: text("type", { enum: eventoOperacaoTipoEnum }).notNull(),
    status: text("status", { enum: eventoOperacaoStatusEnum })
      .notNull()
      .default("ATIVA"),
    participantId: uuid("participant_id").references(
      () => eventoParticipantes.id,
      { onDelete: "set null" },
    ),
    orderId: uuid("order_id").references(() => eventoPedidos.id, {
      onDelete: "set null",
    }),
    reason: text("reason").notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => ({
    sessionStatusIdx: index("idx_evento_operacoes_session_status").on(
      table.sessionId,
      table.status,
    ),
    eventIdx: index("idx_evento_operacoes_event").on(table.eventId),
  }),
);
export type EventoOperacaoAdministrativa =
  typeof eventoOperacoesAdministrativas.$inferSelect;
export type NewEventoOperacaoAdministrativa =
  typeof eventoOperacoesAdministrativas.$inferInsert;

export const eventoPagamentos = pgTable(
  "evento_pagamentos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => eventoPedidos.id, { onDelete: "cascade" }),
    stripeCheckoutSessionId: varchar("stripe_checkout_session_id", {
      length: 255,
    }),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", {
      length: 255,
    }),
    method: text("method", { enum: eventoPagamentoMetodoEnum }).notNull(),
    expectedAmountCents: integer("expected_amount_cents").notNull(),
    receivedAmountCents: integer("received_amount_cents"),
    currency: varchar("currency", { length: 3 }).notNull().default("BRL"),
    status: text("status", { enum: eventoPagamentoStatusEnum })
      .notNull()
      .default("PENDENTE"),
    lastWebhookEventId: varchar("last_webhook_event_id", { length: 255 }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => ({
    orderIdx: index("idx_evento_pagamentos_order").on(table.orderId),
    stripeCheckoutUnique: uniqueIndex(
      "uq_evento_pagamentos_stripe_checkout",
    ).on(table.stripeCheckoutSessionId),
    stripeIntentUnique: uniqueIndex("uq_evento_pagamentos_stripe_intent").on(
      table.stripePaymentIntentId,
    ),
    nonNegativeAmounts: check(
      "evento_pagamentos_non_negative_amounts",
      sql`${table.expectedAmountCents} >= 0 AND (${table.receivedAmountCents} IS NULL OR ${table.receivedAmountCents} >= 0)`,
    ),
  }),
);
export type EventoPagamento = typeof eventoPagamentos.$inferSelect;
export type NewEventoPagamento = typeof eventoPagamentos.$inferInsert;

export const eventoReembolsos = pgTable(
  "evento_reembolsos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => eventoPagamentos.id, { onDelete: "restrict" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => eventoPedidos.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    reason: text("reason").notNull(),
    status: text("status", { enum: ["PENDENTE", "PROCESSANDO", "CONCLUIDO", "ERRO"] as const })
      .notNull()
      .default("PENDENTE"),
    stripeRefundId: varchar("stripe_refund_id", { length: 255 }),
    requestedBy: uuid("requested_by").notNull().references(() => users.id, {
      onDelete: "restrict",
    }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    result: text("result"),
    ...timestamps(),
  },
  (table) => ({
    orderIdx: index("idx_evento_reembolsos_order").on(table.orderId),
    stripeRefundUnique: uniqueIndex("uq_evento_reembolsos_stripe_refund").on(
      table.stripeRefundId,
    ),
    positiveAmount: check(
      "evento_reembolsos_positive_amount",
      sql`${table.amountCents} > 0`,
    ),
  }),
);
export type EventoReembolso = typeof eventoReembolsos.$inferSelect;
export type NewEventoReembolso = typeof eventoReembolsos.$inferInsert;

export const eventoIngressos = pgTable(
  "evento_ingressos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => eventoPedidos.id, { onDelete: "restrict" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => eventoItensPedido.id, { onDelete: "restrict" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => eventoSessoes.id, { onDelete: "restrict" }),
    inventorySeatId: uuid("inventory_seat_id")
      .notNull()
      .references(() => eventoInventarioAssentos.id, { onDelete: "restrict" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => eventoParticipantes.id, { onDelete: "restrict" }),
    status: text("status", { enum: eventoIngressoStatusEnum })
      .notNull()
      .default("EMITIDO"),
    signedToken: text("signed_token").notNull(),
    qrPayload: text("qr_payload").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    reissuedFromId: uuid("reissued_from_id").references(
      (): AnyPgColumn => eventoIngressos.id,
      { onDelete: "set null" },
    ),
    ...timestamps(),
  },
  (table) => ({
    tokenUnique: uniqueIndex("uq_evento_ingressos_signed_token").on(
      table.signedToken,
    ),
    orderIdx: index("idx_evento_ingressos_order").on(table.orderId),
    sessionIdx: index("idx_evento_ingressos_session").on(table.sessionId),
    participantIdx: index("idx_evento_ingressos_participant").on(
      table.participantId,
    ),
  }),
);
export type EventoIngresso = typeof eventoIngressos.$inferSelect;
export type NewEventoIngresso = typeof eventoIngressos.$inferInsert;

export const eventoCheckins = pgTable(
  "evento_checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => eventoIngressos.id, { onDelete: "restrict" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => eventoSessoes.id, { onDelete: "restrict" }),
    result: text("result", { enum: eventoCheckinResultadoEnum }).notNull(),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    checkedInBy: uuid("checked_in_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reason: text("reason"),
    ...timestamps(),
  },
  (table) => ({
    ticketIdx: index("idx_evento_checkins_ticket").on(table.ticketId),
    sessionResultIdx: index("idx_evento_checkins_session_result").on(
      table.sessionId,
      table.result,
    ),
  }),
);
export type EventoCheckin = typeof eventoCheckins.$inferSelect;
export type NewEventoCheckin = typeof eventoCheckins.$inferInsert;

export const eventoTransferencias = pgTable(
  "evento_transferencias",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => eventoIngressos.id, { onDelete: "restrict" }),
    fromParticipantId: uuid("from_participant_id")
      .notNull()
      .references(() => eventoParticipantes.id, { onDelete: "restrict" }),
    toParticipantId: uuid("to_participant_id")
      .notNull()
      .references(() => eventoParticipantes.id, { onDelete: "restrict" }),
    fromSeatId: uuid("from_seat_id")
      .notNull()
      .references(() => eventoInventarioAssentos.id, { onDelete: "restrict" }),
    toSeatId: uuid("to_seat_id")
      .notNull()
      .references(() => eventoInventarioAssentos.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    performedBy: uuid("performed_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    performedAt: timestamp("performed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps(),
  },
  (table) => ({
    ticketIdx: index("idx_evento_transferencias_ticket").on(table.ticketId),
  }),
);
export type EventoTransferencia = typeof eventoTransferencias.$inferSelect;
export type NewEventoTransferencia = typeof eventoTransferencias.$inferInsert;

export const eventoImportacoesMapa = pgTable(
  "evento_importacoes_mapa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => eventos.id, { onDelete: "cascade" }),
    mapId: uuid("map_id").references(() => eventoMapas.id, {
      onDelete: "set null",
    }),
    fileKey: varchar("file_key", { length: 500 }).notNull(),
    detector: varchar("detector", { length: 100 }).notNull(),
    detectorVersion: varchar("detector_version", { length: 80 }),
    status: text("status", { enum: eventoImportacaoStatusEnum })
      .notNull()
      .default("ENVIADA"),
    proposalCount: integer("proposal_count").notNull().default(0),
    conflictCount: integer("conflict_count").notNull().default(0),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => ({
    eventStatusIdx: index("idx_evento_importacoes_event_status").on(
      table.eventId,
      table.status,
    ),
    nonNegativeCounts: check(
      "evento_importacoes_non_negative_counts",
      sql`${table.proposalCount} >= 0 AND ${table.conflictCount} >= 0`,
    ),
  }),
);
export type EventoImportacaoMapa = typeof eventoImportacoesMapa.$inferSelect;
export type NewEventoImportacaoMapa =
  typeof eventoImportacoesMapa.$inferInsert;

export const eventoDeteccoesMapa = pgTable(
  "evento_deteccoes_mapa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    importId: uuid("import_id")
      .notNull()
      .references(() => eventoImportacoesMapa.id, { onDelete: "cascade" }),
    detector: varchar("detector", { length: 100 }).notNull(),
    confidence: integer("confidence").notNull(),
    proposedRowLabel: varchar("proposed_row_label", { length: 30 }),
    proposedSeatNumber: varchar("proposed_seat_number", { length: 30 }),
    proposedX: integer("proposed_x"),
    proposedY: integer("proposed_y"),
    proposedCategory: varchar("proposed_category", { length: 80 }),
    status: text("status", { enum: eventoDeteccaoStatusEnum })
      .notNull()
      .default("PENDENTE"),
    conflictReason: text("conflict_reason"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => ({
    importIdx: index("idx_evento_deteccoes_import").on(table.importId),
    validConfidence: check(
      "evento_deteccoes_confidence_range",
      sql`${table.confidence} >= 0 AND ${table.confidence} <= 100`,
    ),
  }),
);
export type EventoDeteccaoMapa = typeof eventoDeteccoesMapa.$inferSelect;
export type NewEventoDeteccaoMapa = typeof eventoDeteccoesMapa.$inferInsert;

export const eventoPoliticas = pgTable(
  "evento_politicas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => eventos.id, { onDelete: "cascade" }),
    type: text("type", { enum: eventoPoliticaTipoEnum }).notNull(),
    version: integer("version").notNull(),
    content: text("content").notNull(),
    active: boolean("active").notNull().default(true),
    effectiveAt: timestamp("effective_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps(),
  },
  (table) => ({
    eventTypeVersionUnique: uniqueIndex(
      "uq_evento_politicas_event_type_version",
    ).on(table.eventId, table.type, table.version),
    eventTypeIdx: index("idx_evento_politicas_event_type").on(
      table.eventId,
      table.type,
    ),
  }),
);
export type EventoPolitica = typeof eventoPoliticas.$inferSelect;
export type NewEventoPolitica = typeof eventoPoliticas.$inferInsert;

export const eventoAceites = pgTable(
  "evento_aceites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => eventoPedidos.id, { onDelete: "cascade" }),
    type: text("type", { enum: eventoAceiteTipoEnum }).notNull(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => eventoPoliticas.id, { onDelete: "restrict" }),
    policyVersion: integer("policy_version").notNull(),
    acceptedByName: varchar("accepted_by_name", { length: 200 }).notNull(),
    acceptedByEmail: varchar("accepted_by_email", { length: 320 }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps(),
  },
  (table) => ({
    orderTypeUnique: uniqueIndex("uq_evento_aceites_order_type").on(
      table.orderId,
      table.type,
    ),
    orderIdx: index("idx_evento_aceites_order").on(table.orderId),
  }),
);
export type EventoAceite = typeof eventoAceites.$inferSelect;
export type NewEventoAceite = typeof eventoAceites.$inferInsert;

export const eventoTokensConsulta = pgTable(
  "evento_tokens_consulta",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => eventoPedidos.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    usedAt: timestamp("used_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("uq_evento_tokens_consulta_hash").on(
      table.tokenHash,
    ),
    orderIdx: index("idx_evento_tokens_consulta_order").on(table.orderId),
    emailIdx: index("idx_evento_tokens_consulta_email").on(table.email),
  }),
);
export type EventoTokenConsulta = typeof eventoTokensConsulta.$inferSelect;
export type NewEventoTokenConsulta = typeof eventoTokensConsulta.$inferInsert;

export const eventoAuditorias = pgTable(
  "evento_auditorias",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => eventos.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => eventoSessoes.id, {
      onDelete: "set null",
    }),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorRole: varchar("actor_role", { length: 100 }),
    action: text("action", { enum: eventoAuditoriaAcaoEnum }).notNull(),
    resourceType: varchar("resource_type", { length: 100 }).notNull(),
    resourceId: uuid("resource_id"),
    version: integer("version"),
    reason: text("reason"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    eventCreatedIdx: index("idx_evento_auditorias_event_created").on(
      table.eventId,
      table.createdAt,
    ),
    resourceIdx: index("idx_evento_auditorias_resource").on(
      table.resourceType,
      table.resourceId,
    ),
  }),
);
export type EventoAuditoria = typeof eventoAuditorias.$inferSelect;
export type NewEventoAuditoria = typeof eventoAuditorias.$inferInsert;

// Drizzle relations. Foreign keys above intentionally keep operational data
// linked to the event/session while allowing independent inventory per session.
export const eventosRelations = relations(eventos, ({ one, many }) => ({
  school: one(schools, {
    fields: [eventos.schoolId],
    references: [schools.id],
  }),
  defaultLocation: one(eventoLocais, {
    relationName: "event-default-location",
    fields: [eventos.defaultLocationId],
    references: [eventoLocais.id],
  }),
  defaultMap: one(eventoMapas, {
    relationName: "event-default-map",
    fields: [eventos.defaultMapId],
    references: [eventoMapas.id],
  }),
  locations: many(eventoLocais, { relationName: "event-default-location" }),
  maps: many(eventoMapas, { relationName: "event-maps" }),
  defaultMaps: many(eventoMapas, { relationName: "event-default-map" }),
  sessions: many(eventoSessoes),
  ticketTypes: many(eventoTiposIngresso),
  offers: many(eventoOfertas),
  orders: many(eventoPedidos),
  participants: many(eventoParticipantes),
  adminOperations: many(eventoOperacoesAdministrativas),
  mapImports: many(eventoImportacoesMapa),
  policies: many(eventoPoliticas),
  audits: many(eventoAuditorias),
}));

export const eventoLocaisRelations = relations(eventoLocais, ({ one, many }) => ({
  school: one(schools, { fields: [eventoLocais.schoolId], references: [schools.id] }),
  eventsAsDefault: many(eventos, { relationName: "event-default-location" }),
  sessions: many(eventoSessoes),
}));

export const eventoMapasRelations = relations(eventoMapas, ({ one, many }) => ({
  event: one(eventos, { relationName: "event-maps", fields: [eventoMapas.eventId], references: [eventos.id] }),
  confirmedByUser: one(users, { fields: [eventoMapas.confirmedBy], references: [users.id] }),
  seats: many(eventoMapaAssentos),
  sessions: many(eventoSessoes),
  imports: many(eventoImportacoesMapa),
  defaultEvents: many(eventos, { relationName: "event-default-map" }),
}));

export const eventoMapaAssentosRelations = relations(eventoMapaAssentos, ({ one, many }) => ({
  map: one(eventoMapas, { fields: [eventoMapaAssentos.mapId], references: [eventoMapas.id] }),
  inventories: many(eventoInventarioAssentos),
}));

export const eventoSessoesRelations = relations(eventoSessoes, ({ one, many }) => ({
  event: one(eventos, { fields: [eventoSessoes.eventId], references: [eventos.id] }),
  location: one(eventoLocais, { fields: [eventoSessoes.locationId], references: [eventoLocais.id] }),
  map: one(eventoMapas, { fields: [eventoSessoes.mapId], references: [eventoMapas.id] }),
  inventories: many(eventoInventarioAssentos),
  orders: many(eventoPedidos),
  adminOperations: many(eventoOperacoesAdministrativas),
  tickets: many(eventoIngressos),
  checkins: many(eventoCheckins),
  audits: many(eventoAuditorias),
}));

export const eventoInventarioAssentosRelations = relations(eventoInventarioAssentos, ({ one, many }) => ({
  session: one(eventoSessoes, { fields: [eventoInventarioAssentos.sessionId], references: [eventoSessoes.id] }),
  seat: one(eventoMapaAssentos, { fields: [eventoInventarioAssentos.seatId], references: [eventoMapaAssentos.id] }),
  reservations: many(eventoReservas),
  orderItems: many(eventoItensPedido),
  tickets: many(eventoIngressos),
  operations: many(eventoOperacoesAdministrativas),
}));

export const eventoTiposIngressoRelations = relations(eventoTiposIngresso, ({ one, many }) => ({
  event: one(eventos, { fields: [eventoTiposIngresso.eventId], references: [eventos.id] }),
  orderItems: many(eventoItensPedido),
}));

export const eventoOfertasRelations = relations(eventoOfertas, ({ one }) => ({
  event: one(eventos, { fields: [eventoOfertas.eventId], references: [eventos.id] }),
}));

export const eventoPedidosRelations = relations(eventoPedidos, ({ one, many }) => ({
  event: one(eventos, { fields: [eventoPedidos.eventId], references: [eventos.id] }),
  session: one(eventoSessoes, { fields: [eventoPedidos.sessionId], references: [eventoSessoes.id] }),
  items: many(eventoItensPedido),
  reservations: many(eventoReservas),
  participants: many(eventoParticipantes),
  payments: many(eventoPagamentos),
  refunds: many(eventoReembolsos),
  tickets: many(eventoIngressos),
  acceptances: many(eventoAceites),
  lookupTokens: many(eventoTokensConsulta),
}));

export const eventoItensPedidoRelations = relations(eventoItensPedido, ({ one, many }) => ({
  order: one(eventoPedidos, { fields: [eventoItensPedido.orderId], references: [eventoPedidos.id] }),
  inventorySeat: one(eventoInventarioAssentos, { fields: [eventoItensPedido.inventorySeatId], references: [eventoInventarioAssentos.id] }),
  ticketType: one(eventoTiposIngresso, { fields: [eventoItensPedido.ticketTypeId], references: [eventoTiposIngresso.id] }),
  participant: one(eventoParticipantes, { fields: [eventoItensPedido.participantId], references: [eventoParticipantes.id] }),
  tickets: many(eventoIngressos),
}));

export const eventoParticipantesRelations = relations(eventoParticipantes, ({ one, many }) => ({
  event: one(eventos, { fields: [eventoParticipantes.eventId], references: [eventos.id] }),
  order: one(eventoPedidos, { fields: [eventoParticipantes.orderId], references: [eventoPedidos.id] }),
  orderItems: many(eventoItensPedido),
  tickets: many(eventoIngressos),
  operations: many(eventoOperacoesAdministrativas),
  transfersFrom: many(eventoTransferencias, { relationName: "fromParticipant" }),
  transfersTo: many(eventoTransferencias, { relationName: "toParticipant" }),
}));

export const eventoReservasRelations = relations(eventoReservas, ({ one }) => ({
  order: one(eventoPedidos, { fields: [eventoReservas.orderId], references: [eventoPedidos.id] }),
  inventorySeat: one(eventoInventarioAssentos, { fields: [eventoReservas.inventorySeatId], references: [eventoInventarioAssentos.id] }),
}));

export const eventoOperacoesAdministrativasRelations = relations(eventoOperacoesAdministrativas, ({ one }) => ({
  event: one(eventos, { fields: [eventoOperacoesAdministrativas.eventId], references: [eventos.id] }),
  session: one(eventoSessoes, { fields: [eventoOperacoesAdministrativas.sessionId], references: [eventoSessoes.id] }),
  inventorySeat: one(eventoInventarioAssentos, { fields: [eventoOperacoesAdministrativas.inventorySeatId], references: [eventoInventarioAssentos.id] }),
  participant: one(eventoParticipantes, { fields: [eventoOperacoesAdministrativas.participantId], references: [eventoParticipantes.id] }),
  order: one(eventoPedidos, { fields: [eventoOperacoesAdministrativas.orderId], references: [eventoPedidos.id] }),
  creator: one(users, { fields: [eventoOperacoesAdministrativas.createdBy], references: [users.id] }),
}));

export const eventoPagamentosRelations = relations(eventoPagamentos, ({ one, many }) => ({
  order: one(eventoPedidos, { fields: [eventoPagamentos.orderId], references: [eventoPedidos.id] }),
  refunds: many(eventoReembolsos),
}));

export const eventoReembolsosRelations = relations(eventoReembolsos, ({ one }) => ({
  payment: one(eventoPagamentos, { fields: [eventoReembolsos.paymentId], references: [eventoPagamentos.id] }),
  order: one(eventoPedidos, { fields: [eventoReembolsos.orderId], references: [eventoPedidos.id] }),
  requester: one(users, { fields: [eventoReembolsos.requestedBy], references: [users.id] }),
}));

export const eventoIngressosRelations = relations(eventoIngressos, ({ one, many }) => ({
  order: one(eventoPedidos, { fields: [eventoIngressos.orderId], references: [eventoPedidos.id] }),
  item: one(eventoItensPedido, { fields: [eventoIngressos.itemId], references: [eventoItensPedido.id] }),
  session: one(eventoSessoes, { fields: [eventoIngressos.sessionId], references: [eventoSessoes.id] }),
  inventorySeat: one(eventoInventarioAssentos, { fields: [eventoIngressos.inventorySeatId], references: [eventoInventarioAssentos.id] }),
  participant: one(eventoParticipantes, { fields: [eventoIngressos.participantId], references: [eventoParticipantes.id] }),
  checkins: many(eventoCheckins),
  transfers: many(eventoTransferencias),
}));

export const eventoCheckinsRelations = relations(eventoCheckins, ({ one }) => ({
  ticket: one(eventoIngressos, { fields: [eventoCheckins.ticketId], references: [eventoIngressos.id] }),
  session: one(eventoSessoes, { fields: [eventoCheckins.sessionId], references: [eventoSessoes.id] }),
  operator: one(users, { fields: [eventoCheckins.checkedInBy], references: [users.id] }),
}));

export const eventoTransferenciasRelations = relations(eventoTransferencias, ({ one }) => ({
  ticket: one(eventoIngressos, { fields: [eventoTransferencias.ticketId], references: [eventoIngressos.id] }),
  fromParticipant: one(eventoParticipantes, { fields: [eventoTransferencias.fromParticipantId], references: [eventoParticipantes.id], relationName: "fromParticipant" }),
  toParticipant: one(eventoParticipantes, { fields: [eventoTransferencias.toParticipantId], references: [eventoParticipantes.id], relationName: "toParticipant" }),
  fromSeat: one(eventoInventarioAssentos, { fields: [eventoTransferencias.fromSeatId], references: [eventoInventarioAssentos.id], relationName: "fromSeat" }),
  toSeat: one(eventoInventarioAssentos, { fields: [eventoTransferencias.toSeatId], references: [eventoInventarioAssentos.id], relationName: "toSeat" }),
  operator: one(users, { fields: [eventoTransferencias.performedBy], references: [users.id] }),
}));

export const eventoImportacoesMapaRelations = relations(eventoImportacoesMapa, ({ one, many }) => ({
  event: one(eventos, { fields: [eventoImportacoesMapa.eventId], references: [eventos.id] }),
  map: one(eventoMapas, { fields: [eventoImportacoesMapa.mapId], references: [eventoMapas.id] }),
  reviewer: one(users, { fields: [eventoImportacoesMapa.reviewedBy], references: [users.id] }),
  detections: many(eventoDeteccoesMapa),
}));

export const eventoDeteccoesMapaRelations = relations(eventoDeteccoesMapa, ({ one }) => ({
  import: one(eventoImportacoesMapa, { fields: [eventoDeteccoesMapa.importId], references: [eventoImportacoesMapa.id] }),
  reviewer: one(users, { fields: [eventoDeteccoesMapa.reviewedBy], references: [users.id] }),
}));

export const eventoPoliticasRelations = relations(eventoPoliticas, ({ one, many }) => ({
  event: one(eventos, { fields: [eventoPoliticas.eventId], references: [eventos.id] }),
  creator: one(users, { fields: [eventoPoliticas.createdBy], references: [users.id] }),
  acceptances: many(eventoAceites),
}));

export const eventoAceitesRelations = relations(eventoAceites, ({ one }) => ({
  order: one(eventoPedidos, { fields: [eventoAceites.orderId], references: [eventoPedidos.id] }),
  policy: one(eventoPoliticas, { fields: [eventoAceites.policyId], references: [eventoPoliticas.id] }),
}));

export const eventoTokensConsultaRelations = relations(eventoTokensConsulta, ({ one }) => ({
  order: one(eventoPedidos, { fields: [eventoTokensConsulta.orderId], references: [eventoPedidos.id] }),
}));

export const eventoAuditoriasRelations = relations(eventoAuditorias, ({ one }) => ({
  event: one(eventos, { fields: [eventoAuditorias.eventId], references: [eventos.id] }),
  session: one(eventoSessoes, { fields: [eventoAuditorias.sessionId], references: [eventoSessoes.id] }),
  actor: one(users, { fields: [eventoAuditorias.actorId], references: [users.id] }),
}));

// Useful drizzle-zod schemas for API input/output validation.
export const insertEventoSchema = createInsertSchema(eventos);
export const selectEventoSchema = createSelectSchema(eventos);
export const insertEventoSessaoSchema = createInsertSchema(eventoSessoes);
export const selectEventoSessaoSchema = createSelectSchema(eventoSessoes);
export const insertEventoPedidoSchema = createInsertSchema(eventoPedidos);
export const selectEventoPedidoSchema = createSelectSchema(eventoPedidos);
export const insertEventoIngressoSchema = createInsertSchema(eventoIngressos);
export const selectEventoIngressoSchema = createSelectSchema(eventoIngressos);
