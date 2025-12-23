import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const schools = pgTable("schools", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type School = typeof schools.$inferSelect;
export type NewSchool = typeof schools.$inferInsert;
