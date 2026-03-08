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

import { prova } from "./prova.js";
import { users } from "./users.js";

// Enum de ações próprio para histórico de provas (desacoplado do plano-aula)
export const provaHistoricoAcaoEnum = [
  "CRIADO",
  "SUBMETIDO_IMPRESSAO",
  "ENVIADO_RESPONDER",
  "SUBMETIDO_ANALISTA",
  "RESUBMETIDO_ANALISTA",
  "APROVADO_ANALISTA",
  "DEVOLVIDO_ANALISTA",
  "DOCUMENTO_IMPRESSO",
  "RECUPERADO",
  "COMENTARIO_ADICIONADO",
] as const;
export type ProvaHistoricoAcao = (typeof provaHistoricoAcaoEnum)[number];

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
    acao: text("acao", { enum: provaHistoricoAcaoEnum }).notNull(),
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
