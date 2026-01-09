import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { educationStages } from "./education-stages.js";
import { schools } from "./schools.js";
import { units } from "./units.js";

export const userRoleEnum = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_geral",
  "coordenadora_bercario",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_medio",
  "analista_pedagogico",
  "professora",
  "auxiliar_administrativo",
  "auxiliar_sala",
] as const;
export type UserRole = (typeof userRoleEnum)[number];

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: userRoleEnum })
    .notNull()
    .default("auxiliar_administrativo"),
  schoolId: uuid("school_id").references(() => schools.id, {
    onDelete: "cascade",
  }),
  unitId: uuid("unit_id").references(() => units.id, { onDelete: "cascade" }),
  stageId: uuid("stage_id").references(() => educationStages.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
