import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { educationStages } from "./education-stages";
import { units } from "./units";
import { users } from "./users";

export const turmas = pgTable(
  "turmas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => educationStages.id, { onDelete: "cascade" }),
    professoraId: uuid("professora_id").references(() => users.id, {
      onDelete: "set null",
    }), // Professora titular da turma (opcional)
    name: text("name").notNull(), // Ex: "3A", "1º Ano A"
    code: text("code").notNull(), // Ex: "INF-3A", "FUND-I-1A"
    year: integer("year").notNull(), // 2025, 2026
    shift: text("shift"), // "matutino", "vespertino", "integral"
    capacity: integer("capacity"), // Capacidade máxima
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueTurmaCode: uniqueIndex("turmas_unit_code_year_unique").on(
      table.unitId,
      table.code,
      table.year,
    ),
  }),
);

export type Turma = typeof turmas.$inferSelect;
export type NewTurma = typeof turmas.$inferInsert;
