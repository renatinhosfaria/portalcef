import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { schools } from "./schools.js";

export const units = pgTable(
  "units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    address: text("address"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    idSchoolUnique: uniqueIndex("units_id_school_id_unique").on(
      table.id,
      table.schoolId,
    ),
  }),
);

export type Unit = typeof units.$inferSelect;
export type NewUnit = typeof units.$inferInsert;
