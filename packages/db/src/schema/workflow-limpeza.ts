import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const workflowLimpeza = pgTable(
  "workflow_limpeza",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storageKey: varchar("storage_key", { length: 500 }).notNull(),
    tentativas: integer("tentativas").notNull().default(0),
    ultimoErro: text("ultimo_erro"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    storageKeyUniqueIdx: uniqueIndex("workflow_limpeza_storage_key_unique").on(
      table.storageKey,
    ),
  }),
);

export type WorkflowLimpeza = typeof workflowLimpeza.$inferSelect;
export type NewWorkflowLimpeza = typeof workflowLimpeza.$inferInsert;

export const insertWorkflowLimpezaSchema = createInsertSchema(workflowLimpeza);
export const selectWorkflowLimpezaSchema = createSelectSchema(workflowLimpeza);
