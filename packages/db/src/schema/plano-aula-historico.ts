import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { planoAula } from "./plano-aula.js";
import { users } from "./users.js";

// ============================================
// Ação do Histórico Enum
// ============================================
export const planoAulaHistoricoAcaoEnum = [
  "CRIADO",
  "SUBMETIDO",
  "APROVADO_ANALISTA",
  "DEVOLVIDO_ANALISTA",
  "APROVADO_COORDENADORA",
  "DEVOLVIDO_COORDENADORA",
  "DOCUMENTO_IMPRESSO",
] as const;
export type PlanoAulaHistoricoAcao =
  (typeof planoAulaHistoricoAcaoEnum)[number];

// ============================================
// Table: plano_aula_historico
// ============================================
export const planoAulaHistorico = pgTable(
  "plano_aula_historico",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Relacionamentos
    planoId: uuid("plano_id")
      .notNull()
      .references(() => planoAula.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),

    // Dados do usuário (denormalizados para histórico)
    userName: text("user_name").notNull(),
    userRole: text("user_role").notNull(),

    // Ação e status
    acao: text("acao", { enum: planoAulaHistoricoAcaoEnum }).notNull(),
    statusAnterior: text("status_anterior"),
    statusNovo: text("status_novo").notNull(),

    // Detalhes adicionais (flexível)
    detalhes: jsonb("detalhes"),

    // Timestamp
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    planoIdIdx: index("idx_plano_historico_plano_id").on(table.planoId),
    createdAtIdx: index("idx_plano_historico_created_at").on(table.createdAt),
  }),
);

// TypeScript types for plano_aula_historico
export type PlanoAulaHistorico = typeof planoAulaHistorico.$inferSelect;
export type NewPlanoAulaHistorico = typeof planoAulaHistorico.$inferInsert;

// ============================================
// Drizzle Relations
// ============================================
export const planoAulaHistoricoRelations = relations(
  planoAulaHistorico,
  ({ one }) => ({
    plano: one(planoAula, {
      fields: [planoAulaHistorico.planoId],
      references: [planoAula.id],
    }),
    user: one(users, {
      fields: [planoAulaHistorico.userId],
      references: [users.id],
    }),
  }),
);

// ============================================
// Zod Schemas (drizzle-zod)
// ============================================
export const insertPlanoAulaHistoricoSchema =
  createInsertSchema(planoAulaHistorico);
export const selectPlanoAulaHistoricoSchema =
  createSelectSchema(planoAulaHistorico);
