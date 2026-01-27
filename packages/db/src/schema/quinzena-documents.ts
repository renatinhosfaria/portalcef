import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { units } from "./units.js";
import { users } from "./users.js";

// ============================================
// Table: quinzena_documents
// Armazena documentos (PDF, Word) enviados pelas professoras
// ============================================
export const quinzenaDocuments = pgTable(
  "quinzena_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Identificação da quinzena
    quinzenaId: text("quinzena_id").notNull(), // Ex: "2026-Q01"

    // Relacionamentos
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),

    // Metadados do arquivo
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileKey: varchar("file_key", { length: 255 }).notNull(), // Key no MinIO
    fileUrl: varchar("file_url", { length: 500 }).notNull(),
    fileSize: integer("file_size"), // Em bytes
    fileType: varchar("file_type", { length: 100 }), // MIME type

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    quinzenaIdIdx: index("quinzena_documents_quinzena_id_idx").on(
      table.quinzenaId,
    ),
    userIdIdx: index("quinzena_documents_user_id_idx").on(table.userId),
    unitIdIdx: index("quinzena_documents_unit_id_idx").on(table.unitId),
    createdAtIdx: index("quinzena_documents_created_at_idx").on(
      table.createdAt,
    ),
  }),
);

// TypeScript types
export type QuinzenaDocument = typeof quinzenaDocuments.$inferSelect;
export type NewQuinzenaDocument = typeof quinzenaDocuments.$inferInsert;

// ============================================
// Drizzle Relations
// ============================================
export const quinzenaDocumentsRelations = relations(
  quinzenaDocuments,
  ({ one }) => ({
    user: one(users, {
      fields: [quinzenaDocuments.userId],
      references: [users.id],
    }),
    unit: one(units, {
      fields: [quinzenaDocuments.unitId],
      references: [units.id],
    }),
  }),
);

// ============================================
// Zod Schemas
// ============================================
export const insertQuinzenaDocumentSchema =
  createInsertSchema(quinzenaDocuments);
export const selectQuinzenaDocumentSchema =
  createSelectSchema(quinzenaDocuments);
