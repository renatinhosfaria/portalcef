import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import {
  documentoTipoEnum,
  documentoPreviewStatusEnum,
} from "./plano-aula.js";
import { provaCiclo } from "./prova-ciclo.js";
import { turmas } from "./turmas.js";
import { units } from "./units.js";
import { users } from "./users.js";

// Enum de status próprio para provas (desacoplado do plano-aula)
export const provaStatusEnum = [
  "RASCUNHO",
  "AGUARDANDO_IMPRESSAO",
  "AGUARDANDO_RESPOSTA",
  "AGUARDANDO_ANALISTA",
  "DEVOLVIDO_ANALISTA",
  "APROVADO",
  "RECUPERADO",
] as const;
export type ProvaStatus = (typeof provaStatusEnum)[number];

// Re-exportar enums de documento para conveniência
export { documentoTipoEnum, documentoPreviewStatusEnum } from "./plano-aula.js";

// ============================================
// Table: prova (Mestre)
// ============================================
export const prova = pgTable(
  "prova",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Relacionamentos
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    turmaId: uuid("turma_id")
      .notNull()
      .references(() => turmas.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    provaCicloId: uuid("prova_ciclo_id")
      .notNull()
      .references(() => provaCiclo.id, { onDelete: "cascade" }),

    // Status e fluxo
    status: text("status", { enum: provaStatusEnum })
      .notNull()
      .default("RASCUNHO"),

    // Timestamps de fluxo
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),

    // Timestamps padrão
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Índices para queries de dashboard
    statusIdx: index("prova_status_idx").on(table.status),
    unitIdIdx: index("prova_unit_id_idx").on(table.unitId),
    userIdx: index("prova_user_idx").on(table.userId),
    provaCicloIdx: index("prova_prova_ciclo_id_idx").on(table.provaCicloId),
    // Constraint: um professor não pode ter 2 provas para mesma turma/ciclo
    uniqueProvaIdx: uniqueIndex("prova_user_turma_ciclo_unique").on(
      table.userId,
      table.turmaId,
      table.provaCicloId,
    ),
  }),
);

// TypeScript types for prova
export type Prova = typeof prova.$inferSelect;
export type NewProva = typeof prova.$inferInsert;

// ============================================
// Table: prova_documento (N:1 para prova)
// ============================================
export const provaDocumento = pgTable(
  "prova_documento",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Relacionamento N:1 com prova
    provaId: uuid("prova_id")
      .notNull()
      .references(() => prova.id, { onDelete: "cascade" }),

    // Tipo do documento
    tipo: text("tipo", { enum: documentoTipoEnum }).notNull(),

    // Dados do arquivo/link
    storageKey: varchar("storage_key", { length: 500 }), // Key no storage (para ARQUIVO)
    url: varchar("url", { length: 1000 }), // URL completa (para LINK_YOUTUBE ou URL pública do arquivo)
    fileName: varchar("file_name", { length: 255 }), // Nome original do arquivo
    fileSize: integer("file_size"), // Tamanho em bytes
    mimeType: varchar("mime_type", { length: 100 }), // Tipo MIME do arquivo

    // Preview (conversão assíncrona)
    previewKey: varchar("preview_key", { length: 500 }), // Key do preview no storage (PDF)
    previewUrl: varchar("preview_url", { length: 1000 }), // URL pública do preview
    previewMimeType: varchar("preview_mime_type", { length: 100 }), // Tipo MIME do preview
    previewStatus: text("preview_status", {
      enum: documentoPreviewStatusEnum,
    }), // Status da conversão
    previewError: text("preview_error"), // Mensagem de erro (se houver)

    // Aprovação pelo Analista Pedagógico
    approvedBy: uuid("approved_by").references(() => users.id, {
      onDelete: "set null",
    }), // ID do analista que aprovou
    approvedAt: timestamp("approved_at", { withTimezone: true }), // Data/hora da aprovação

    // Registro de impressão
    printedBy: uuid("printed_by").references(() => users.id, {
      onDelete: "set null",
    }), // ID de quem imprimiu
    printedAt: timestamp("printed_at", { withTimezone: true }), // Data/hora da impressão

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Indicador de comentários (OnlyOffice)
    temComentarios: boolean("tem_comentarios").notNull().default(false),
  },
  (table) => ({
    provaIdIdx: index("prova_documento_prova_id_idx").on(table.provaId),
  }),
);

// TypeScript types for prova_documento
export type ProvaDocumento = typeof provaDocumento.$inferSelect;
export type NewProvaDocumento = typeof provaDocumento.$inferInsert;

// ============================================
// Drizzle Relations (for relational queries)
// ============================================

export const provaRelations = relations(prova, ({ one, many }) => ({
  user: one(users, {
    fields: [prova.userId],
    references: [users.id],
  }),
  turma: one(turmas, {
    fields: [prova.turmaId],
    references: [turmas.id],
  }),
  unit: one(units, {
    fields: [prova.unitId],
    references: [units.id],
  }),
  provaCiclo: one(provaCiclo, {
    fields: [prova.provaCicloId],
    references: [provaCiclo.id],
  }),
  documentos: many(provaDocumento),
}));

export const provaDocumentoRelations = relations(
  provaDocumento,
  ({ one }) => ({
    prova: one(prova, {
      fields: [provaDocumento.provaId],
      references: [prova.id],
    }),
  }),
);

// ============================================
// Zod Schemas (drizzle-zod)
// ============================================

// Prova schemas
export const insertProvaSchema = createInsertSchema(prova);
export const selectProvaSchema = createSelectSchema(prova);

// Prova Documento schemas
export const insertProvaDocumentoSchema = createInsertSchema(provaDocumento);
export const selectProvaDocumentoSchema = createSelectSchema(provaDocumento);
