import { relations } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { units } from "./units.js";
import { users } from "./users.js";
import { relatorio } from "./relatorio.js";

// ============================================
// Table: semana_relatorio
// Configuração de semanas de relatório por unidade/etapa
// ============================================
export const semanaRelatorioEtapaEnum = ["BERCARIO", "INFANTIL"] as const;
export type SemanaRelatorioEtapa = (typeof semanaRelatorioEtapaEnum)[number];

export const semanaRelatorio = pgTable(
  "semana_relatorio",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unidadeId: uuid("unidade_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    etapa: text("etapa", { enum: semanaRelatorioEtapaEnum }).notNull(),
    numero: integer("numero").notNull(),
    descricao: text("descricao"),
    dataInicio: date("data_inicio").notNull(),
    dataFim: date("data_fim").notNull(),
    dataMaximaEntrega: date("data_maxima_entrega").notNull(),
    criadoPor: uuid("criado_por").references(() => users.id),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    semanaNumeroEtapaUnidadeIdx: uniqueIndex(
      "semana_relatorio_unidade_etapa_numero_unique",
    ).on(table.unidadeId, table.etapa, table.numero),
    unidadeIdx: index("idx_semana_relatorio_unidade").on(table.unidadeId),
    etapaIdx: index("idx_semana_relatorio_etapa").on(table.etapa),
    datasIdx: index("idx_semana_relatorio_datas").on(
      table.dataInicio,
      table.dataFim,
    ),
  }),
);

export const semanaRelatorioRelations = relations(
  semanaRelatorio,
  ({ one, many }) => ({
    unidade: one(units, {
      fields: [semanaRelatorio.unidadeId],
      references: [units.id],
    }),
    criadoPorUser: one(users, {
      fields: [semanaRelatorio.criadoPor],
      references: [users.id],
    }),
    relatorios: many(relatorio),
  }),
);

export type SemanaRelatorio = typeof semanaRelatorio.$inferSelect;
export type NovoSemanaRelatorio = typeof semanaRelatorio.$inferInsert;

// ============================================
// Zod Schemas (drizzle-zod)
// ============================================
export const insertSemanaRelatorioSchema =
  createInsertSchema(semanaRelatorio);
export const selectSemanaRelatorioSchema =
  createSelectSchema(semanaRelatorio);
