import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const educationStageEnum = [
  "BERCARIO",
  "INFANTIL",
  "FUNDAMENTAL_I",
  "FUNDAMENTAL_II",
  "MEDIO",
] as const;
export type EducationStageCode = (typeof educationStageEnum)[number];

export const educationStages = pgTable("education_stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code", { enum: educationStageEnum }).notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type EducationStage = typeof educationStages.$inferSelect;
export type NewEducationStage = typeof educationStages.$inferInsert;
