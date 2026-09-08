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

import { relatorio } from "./relatorio.js";
import { users } from "./users.js";

// ============================================
// Ação do Histórico Enum
// ============================================
export const relatorioHistoricoAcaoEnum = [
  "CRIADO",
  "SUBMETIDO",
  "APROVADO_ANALISTA",
  "DEVOLVIDO_ANALISTA",
  "APROVADO_COORDENADORA",
  "DEVOLVIDO_COORDENADORA",
  "DOCUMENTO_IMPRESSO",
  "DOCUMENTO_EXCLUIDO",
  "RECUPERADO",
  "COMENTARIO_ADICIONADO",
] as const;
export type RelatorioHistoricoAcao =
  (typeof relatorioHistoricoAcaoEnum)[number];

// ============================================
// Table: relatorio_historico
// ============================================
export const relatorioHistorico = pgTable(
  "relatorio_historico",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Relacionamentos
    relatorioId: uuid("relatorio_id")
      .notNull()
      .references(() => relatorio.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),

    // Dados do usuário (denormalizados para histórico)
    userName: text("user_name").notNull(),
    userRole: text("user_role").notNull(),

    // Ação e status
    acao: text("acao", { enum: relatorioHistoricoAcaoEnum }).notNull(),
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
    relatorioIdIdx: index("idx_relatorio_historico_relatorio_id").on(
      table.relatorioId,
    ),
    createdAtIdx: index("idx_relatorio_historico_created_at").on(
      table.createdAt,
    ),
  }),
);

// TypeScript types for relatorio_historico
export type RelatorioHistorico = typeof relatorioHistorico.$inferSelect;
export type NewRelatorioHistorico = typeof relatorioHistorico.$inferInsert;

// ============================================
// Drizzle Relations
// ============================================
export const relatorioHistoricoRelations = relations(
  relatorioHistorico,
  ({ one }) => ({
    relatorio: one(relatorio, {
      fields: [relatorioHistorico.relatorioId],
      references: [relatorio.id],
    }),
    user: one(users, {
      fields: [relatorioHistorico.userId],
      references: [users.id],
    }),
  }),
);

// ============================================
// Zod Schemas (drizzle-zod)
// ============================================
export const insertRelatorioHistoricoSchema =
  createInsertSchema(relatorioHistorico);
export const selectRelatorioHistoricoSchema =
  createSelectSchema(relatorioHistorico);
