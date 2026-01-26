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

// ============================================
// Table: plano_aula_periodo
// Configuração de períodos de planejamento por unidade/etapa
// ============================================
export const planoAulaPeriodo = pgTable(
  "plano_aula_periodo",
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
    periodoNumeroEtapaUnidadeIdx: uniqueIndex(
      "plano_aula_periodo_unidade_etapa_numero_unique",
    ).on(table.unidadeId, table.etapa, table.numero),
    unidadeIdx: index("idx_plano_aula_periodo_unidade").on(table.unidadeId),
    etapaIdx: index("idx_plano_aula_periodo_etapa").on(table.etapa),
    datasIdx: index("idx_plano_aula_periodo_datas").on(
      table.dataInicio,
      table.dataFim,
    ),
  }),
);

export const planoAulaPeriodoRelations = relations(
  planoAulaPeriodo,
  ({ one }) => ({
    unidade: one(units, {
      fields: [planoAulaPeriodo.unidadeId],
      references: [units.id],
    }),
    criador: one(users, {
      fields: [planoAulaPeriodo.criadoPor],
      references: [users.id],
    }),
  }),
);

export type PlanoAulaPeriodo = typeof planoAulaPeriodo.$inferSelect;
export type NovoPlanoAulaPeriodo = typeof planoAulaPeriodo.$inferInsert;

// ============================================
// Zod Schemas (drizzle-zod)
// ============================================
export const insertPlanoAulaPeriodoSchema = createInsertSchema(planoAulaPeriodo);
export const selectPlanoAulaPeriodoSchema = createSelectSchema(planoAulaPeriodo);
