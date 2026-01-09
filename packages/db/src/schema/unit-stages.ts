import {
  boolean,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { educationStages } from "./education-stages.js";
import { units } from "./units.js";

/**
 * Tabela de junção entre unidades e etapas de ensino
 * Permite que cada unidade tenha um conjunto diferente de etapas
 *
 * Exemplo:
 * - Unidade A: Berçário, Infantil, Fundamental I
 * - Unidade B: Infantil, Fundamental I, Fundamental II, Médio
 */
export const unitStages = pgTable(
  "unit_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => educationStages.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Cada etapa só pode ser atribuída uma vez por unidade
    uniqueUnitStage: uniqueIndex("unit_stages_unit_stage_unique").on(
      table.unitId,
      table.stageId,
    ),
    // Índices para performance
    unitIdIdx: index("unit_stages_unit_id_idx").on(table.unitId),
    stageIdIdx: index("unit_stages_stage_id_idx").on(table.stageId),
  }),
);

export type UnitStage = typeof unitStages.$inferSelect;
export type NewUnitStage = typeof unitStages.$inferInsert;
