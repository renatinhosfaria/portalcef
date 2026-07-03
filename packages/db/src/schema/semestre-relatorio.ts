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
// Table: semestre_relatorio
// Configuração de semestres de relatório por unidade/etapa
// ============================================
export const semestreRelatorioEtapaEnum = ["BERCARIO", "INFANTIL"] as const;
export type SemestreRelatorioEtapa = (typeof semestreRelatorioEtapaEnum)[number];

export const semestreRelatorio = pgTable(
  "semestre_relatorio",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unidadeId: uuid("unidade_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    etapa: text("etapa", { enum: semestreRelatorioEtapaEnum }).notNull(),
    anoLetivo: integer("ano_letivo").notNull(),
    semestre: integer("semestre").notNull(),
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
    semestreAnoEtapaUnidadeIdx: uniqueIndex(
      "semestre_relatorio_unidade_etapa_ano_semestre_unique",
    ).on(table.unidadeId, table.etapa, table.anoLetivo, table.semestre),
    unidadeIdx: index("idx_semestre_relatorio_unidade").on(table.unidadeId),
    etapaIdx: index("idx_semestre_relatorio_etapa").on(table.etapa),
    datasIdx: index("idx_semestre_relatorio_datas").on(
      table.dataInicio,
      table.dataFim,
    ),
  }),
);

export const semestreRelatorioRelations = relations(
  semestreRelatorio,
  ({ one, many }) => ({
    unidade: one(units, {
      fields: [semestreRelatorio.unidadeId],
      references: [units.id],
    }),
    criadoPorUser: one(users, {
      fields: [semestreRelatorio.criadoPor],
      references: [users.id],
    }),
    relatorios: many(relatorio),
  }),
);

export type SemestreRelatorio = typeof semestreRelatorio.$inferSelect;
export type NovoSemestreRelatorio = typeof semestreRelatorio.$inferInsert;

// ============================================
// Zod Schemas (drizzle-zod)
// ============================================
export const insertSemestreRelatorioSchema =
  createInsertSchema(semestreRelatorio);
export const selectSemestreRelatorioSchema =
  createSelectSchema(semestreRelatorio);
