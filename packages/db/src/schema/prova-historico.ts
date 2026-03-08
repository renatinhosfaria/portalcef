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

import { planoAulaHistoricoAcaoEnum } from "./plano-aula-historico.js";
import { prova } from "./prova.js";
import { users } from "./users.js";

// Re-exportar enum para conveniência
export { planoAulaHistoricoAcaoEnum as provaHistoricoAcaoEnum } from "./plano-aula-historico.js";

// ============================================
// Table: prova_historico
// ============================================
export const provaHistorico = pgTable(
  "prova_historico",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Relacionamentos
    provaId: uuid("prova_id")
      .notNull()
      .references(() => prova.id, { onDelete: "cascade" }),
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
    provaIdIdx: index("idx_prova_historico_prova_id").on(table.provaId),
    createdAtIdx: index("idx_prova_historico_created_at").on(table.createdAt),
  }),
);

// TypeScript types for prova_historico
export type ProvaHistorico = typeof provaHistorico.$inferSelect;
export type NewProvaHistorico = typeof provaHistorico.$inferInsert;

// ============================================
// Drizzle Relations
// ============================================
export const provaHistoricoRelations = relations(
  provaHistorico,
  ({ one }) => ({
    prova: one(prova, {
      fields: [provaHistorico.provaId],
      references: [prova.id],
    }),
    user: one(users, {
      fields: [provaHistorico.userId],
      references: [users.id],
    }),
  }),
);

// ============================================
// Zod Schemas (drizzle-zod)
// ============================================
export const insertProvaHistoricoSchema = createInsertSchema(provaHistorico);
export const selectProvaHistoricoSchema = createSelectSchema(provaHistorico);
