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

export const provaCiclo = pgTable(
  "prova_ciclo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unidadeId: uuid("unidade_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    etapa: text("etapa").notNull(),
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
    cicloNumeroEtapaUnidadeIdx: uniqueIndex(
      "prova_ciclo_unidade_etapa_numero_unique",
    ).on(table.unidadeId, table.etapa, table.numero),
    unidadeIdx: index("idx_prova_ciclo_unidade").on(table.unidadeId),
    etapaIdx: index("idx_prova_ciclo_etapa").on(table.etapa),
    datasIdx: index("idx_prova_ciclo_datas").on(
      table.dataInicio,
      table.dataFim,
    ),
  }),
);

export const provaCicloRelations = relations(provaCiclo, ({ one }) => ({
  unidade: one(units, {
    fields: [provaCiclo.unidadeId],
    references: [units.id],
  }),
  criador: one(users, {
    fields: [provaCiclo.criadoPor],
    references: [users.id],
  }),
}));

export type ProvaCiclo = typeof provaCiclo.$inferSelect;
export type NovoProvaCiclo = typeof provaCiclo.$inferInsert;

export const insertProvaCicloSchema = createInsertSchema(provaCiclo);
export const selectProvaCicloSchema = createSelectSchema(provaCiclo);
