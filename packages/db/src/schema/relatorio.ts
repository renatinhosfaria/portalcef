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

import { turmas } from "./turmas.js";
import { units } from "./units.js";
import { users } from "./users.js";
import {
  documentoTipoEnum,
  pdfStatusEnum,
} from "./plano-aula.js";
import { semanaRelatorio } from "./semana-relatorio.js";

// ============================================
// Relatório Status Enum
// ============================================
export const relatorioStatusEnum = [
  "RASCUNHO", // Salvo localmente, não enviado
  "AGUARDANDO_ANALISTA", // Enviado para análise pedagógica
  "AGUARDANDO_COORDENADORA", // Enviado para coordenação após análise
  "DEVOLVIDO_ANALISTA", // Analista solicitou ajustes
  "DEVOLVIDO_COORDENADORA", // Coordenadora solicitou ajustes
  "REVISAO_ANALISTA", // Em revisão pelo analista após correções
  "APROVADO", // Aprovado pela coordenação
  "RECUPERADO", // Recuperado pela professora antes da análise
] as const;
export type RelatorioStatus = (typeof relatorioStatusEnum)[number];

// ============================================
// Table: relatorio (Mestre)
// ============================================
export const relatorio = pgTable(
  "relatorio",
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
    semanaRelatorioId: uuid("semana_relatorio_id").references(
      () => semanaRelatorio.id,
      { onDelete: "restrict" },
    ),

    // Identificador da semana
    semanaId: uuid("semana_id").notNull(),

    // Status e fluxo
    status: text("status", { enum: relatorioStatusEnum })
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
    statusIdx: index("relatorio_status_idx").on(table.status),
    semanaIdIdx: index("relatorio_semana_id_idx").on(table.semanaId),
    unitIdIdx: index("relatorio_unit_id_idx").on(table.unitId),
    userIdx: index("relatorio_user_idx").on(table.userId),
    semanaRelatorioIdx: index("relatorio_semana_relatorio_id_idx").on(
      table.semanaRelatorioId,
    ),
    // Constraint: uma professora não pode ter 2 relatórios para mesma turma/semana
    uniqueRelatorioIdx: uniqueIndex("relatorio_user_turma_semana_unique").on(
      table.userId,
      table.turmaId,
      table.semanaId,
    ),
  }),
);

// TypeScript types for relatorio
export type Relatorio = typeof relatorio.$inferSelect;
export type NewRelatorio = typeof relatorio.$inferInsert;

// ============================================
// Table: relatorio_documento (N:1 para relatorio)
// ============================================
export const relatorioDocumento = pgTable(
  "relatorio_documento",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Relacionamento N:1 com relatorio
    relatorioId: uuid("relatorio_id")
      .notNull()
      .references(() => relatorio.id, { onDelete: "cascade" }),

    // Tipo do documento
    tipo: text("tipo", { enum: documentoTipoEnum }).notNull(),

    // Dados do arquivo/link
    storageKey: varchar("storage_key", { length: 500 }), // Key no storage (para ARQUIVO)
    url: varchar("url", { length: 1000 }), // URL completa (para LINK_YOUTUBE ou URL pública do arquivo)
    fileName: varchar("file_name", { length: 255 }), // Nome original do arquivo
    fileSize: integer("file_size"), // Tamanho em bytes
    mimeType: varchar("mime_type", { length: 100 }), // Tipo MIME do arquivo

    // Edição via SharePoint (campos temporários — preenchidos durante edição, limpos após sincronização)
    sharepointItemId: text("sharepoint_item_id"), // ID do arquivo no SharePoint
    sharepointEditUrl: text("sharepoint_edit_url"), // URL de edição gerada
    editandoDesde: timestamp("editando_desde", { withTimezone: true }), // Quando a edição foi iniciada

    // PDF derivado para impressão (gerado no momento da aprovação)
    pdfStorageKey: varchar("pdf_storage_key", { length: 500 }),
    pdfUrl: varchar("pdf_url", { length: 1000 }),
    pdfStatus: text("pdf_status", { enum: pdfStatusEnum })
      .notNull()
      .default("NAO_APLICAVEL"),
    pdfError: text("pdf_error"),
    pdfRequestedAt: timestamp("pdf_requested_at", { withTimezone: true }),
    pdfGeneratedAt: timestamp("pdf_generated_at", { withTimezone: true }),

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

    // Indicador de comentários (OnlyOffice)
    temComentarios: boolean("tem_comentarios").notNull().default(false),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    relatorioIdIdx: index("relatorio_documento_relatorio_id_idx").on(
      table.relatorioId,
    ),
  }),
);

// TypeScript types for relatorio_documento
export type RelatorioDocumento = typeof relatorioDocumento.$inferSelect;
export type NewRelatorioDocumento = typeof relatorioDocumento.$inferInsert;

// ============================================
// Drizzle Relations (for relational queries)
// ============================================

export const relatorioRelations = relations(relatorio, ({ one, many }) => ({
  user: one(users, {
    fields: [relatorio.userId],
    references: [users.id],
  }),
  turma: one(turmas, {
    fields: [relatorio.turmaId],
    references: [turmas.id],
  }),
  unit: one(units, {
    fields: [relatorio.unitId],
    references: [units.id],
  }),
  semana: one(semanaRelatorio, {
    fields: [relatorio.semanaRelatorioId],
    references: [semanaRelatorio.id],
  }),
  documentos: many(relatorioDocumento),
}));

export const relatorioDocumentoRelations = relations(
  relatorioDocumento,
  ({ one }) => ({
    relatorio: one(relatorio, {
      fields: [relatorioDocumento.relatorioId],
      references: [relatorio.id],
    }),
    approvedByUser: one(users, {
      fields: [relatorioDocumento.approvedBy],
      references: [users.id],
    }),
    printedByUser: one(users, {
      fields: [relatorioDocumento.printedBy],
      references: [users.id],
    }),
  }),
);

// ============================================
// Zod Schemas (drizzle-zod)
// ============================================

// Relatório schemas
export const insertRelatorioSchema = createInsertSchema(relatorio);
export const selectRelatorioSchema = createSelectSchema(relatorio);

// Relatório Documento schemas
export const insertRelatorioDocumentoSchema =
  createInsertSchema(relatorioDocumento);
export const selectRelatorioDocumentoSchema =
  createSelectSchema(relatorioDocumento);
