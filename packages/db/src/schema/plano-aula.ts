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

// ============================================
// Plano Aula Status Enum
// ============================================
export const planoAulaStatusEnum = [
  "RASCUNHO", // Salvo localmente, não enviado
  "AGUARDANDO_ANALISTA", // Enviado para análise pedagógica
  "AGUARDANDO_COORDENADORA", // Enviado para coordenação após análise
  "DEVOLVIDO_ANALISTA", // Analista solicitou ajustes
  "DEVOLVIDO_COORDENADORA", // Coordenadora solicitou ajustes
  "REVISAO_ANALISTA", // Em revisão pelo analista após correções
  "APROVADO", // Aprovado pela coordenação
] as const;
export type PlanoAulaStatus = (typeof planoAulaStatusEnum)[number];

// ============================================
// Documento Tipo Enum
// ============================================
export const documentoTipoEnum = ["ARQUIVO", "LINK_YOUTUBE"] as const;
export type DocumentoTipo = (typeof documentoTipoEnum)[number];

// ============================================
// Table: plano_aula (Mestre)
// ============================================
export const planoAula = pgTable(
  "plano_aula",
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

    // Identificador da quinzena
    quinzenaId: varchar("quinzena_id", { length: 10 }).notNull(), // Ex: "2026-Q01"

    // Status e fluxo
    status: text("status", { enum: planoAulaStatusEnum })
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
    statusIdx: index("plano_aula_status_idx").on(table.status),
    quinzenaIdIdx: index("plano_aula_quinzena_id_idx").on(table.quinzenaId),
    unitIdIdx: index("plano_aula_unit_id_idx").on(table.unitId),
    // Constraint: um professor não pode ter 2 planos para mesma turma/quinzena
    uniquePlanoIdx: uniqueIndex("plano_aula_user_turma_quinzena_unique").on(
      table.userId,
      table.turmaId,
      table.quinzenaId,
    ),
  }),
);

// TypeScript types for plano_aula
export type PlanoAula = typeof planoAula.$inferSelect;
export type NewPlanoAula = typeof planoAula.$inferInsert;

// ============================================
// Table: plano_documento (N:1 para plano_aula)
// ============================================
export const planoDocumento = pgTable(
  "plano_documento",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Relacionamento N:1 com plano_aula
    planoId: uuid("plano_id")
      .notNull()
      .references(() => planoAula.id, { onDelete: "cascade" }),

    // Tipo do documento
    tipo: varchar("tipo", { length: 20 }).notNull(), // 'ARQUIVO' ou 'LINK_YOUTUBE'

    // Dados do arquivo/link
    storageKey: varchar("storage_key", { length: 500 }), // Key no storage (para ARQUIVO)
    url: varchar("url", { length: 1000 }), // URL completa (para LINK_YOUTUBE ou URL pública do arquivo)
    fileName: varchar("file_name", { length: 255 }), // Nome original do arquivo
    fileSize: integer("file_size"), // Tamanho em bytes
    mimeType: varchar("mime_type", { length: 100 }), // Tipo MIME do arquivo

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    planoIdIdx: index("plano_documento_plano_id_idx").on(table.planoId),
  }),
);

// TypeScript types for plano_documento
export type PlanoDocumento = typeof planoDocumento.$inferSelect;
export type NewPlanoDocumento = typeof planoDocumento.$inferInsert;

// ============================================
// Table: documento_comentario (N:1 para plano_documento)
// ============================================
export const documentoComentario = pgTable(
  "documento_comentario",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Relacionamento N:1 com plano_documento
    documentoId: uuid("documento_id")
      .notNull()
      .references(() => planoDocumento.id, { onDelete: "cascade" }),

    // Autor do comentário
    autorId: uuid("autor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Conteúdo do comentário
    comentario: text("comentario").notNull(),

    // Status de resolução
    resolved: boolean("resolved").notNull().default(false),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    documentoIdIdx: index("documento_comentario_documento_id_idx").on(
      table.documentoId,
    ),
  }),
);

// TypeScript types for documento_comentario
export type DocumentoComentario = typeof documentoComentario.$inferSelect;
export type NewDocumentoComentario = typeof documentoComentario.$inferInsert;

// ============================================
// Table: quinzena_config (configuração de deadline por unidade/quinzena)
// ============================================
export const quinzenaConfig = pgTable(
  "quinzena_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Relacionamentos
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),

    // Identificador da quinzena
    quinzenaId: varchar("quinzena_id", { length: 10 }).notNull(), // Ex: "2026-Q01"

    // Deadline para entrega
    deadline: timestamp("deadline", { withTimezone: true }).notNull(),

    // Quem criou a configuração
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Constraint: apenas uma config por unidade/quinzena
    uniqueUnitQuinzenaIdx: uniqueIndex("quinzena_config_unit_quinzena_unique").on(
      table.unitId,
      table.quinzenaId,
    ),
  }),
);

// TypeScript types for quinzena_config
export type QuinzenaConfig = typeof quinzenaConfig.$inferSelect;
export type NewQuinzenaConfig = typeof quinzenaConfig.$inferInsert;

// ============================================
// Drizzle Relations (for relational queries)
// ============================================

export const planoAulaRelations = relations(planoAula, ({ one, many }) => ({
  user: one(users, {
    fields: [planoAula.userId],
    references: [users.id],
  }),
  turma: one(turmas, {
    fields: [planoAula.turmaId],
    references: [turmas.id],
  }),
  unit: one(units, {
    fields: [planoAula.unitId],
    references: [units.id],
  }),
  documentos: many(planoDocumento),
}));

export const planoDocumentoRelations = relations(
  planoDocumento,
  ({ one, many }) => ({
    plano: one(planoAula, {
      fields: [planoDocumento.planoId],
      references: [planoAula.id],
    }),
    comentarios: many(documentoComentario),
  }),
);

export const documentoComentarioRelations = relations(
  documentoComentario,
  ({ one }) => ({
    documento: one(planoDocumento, {
      fields: [documentoComentario.documentoId],
      references: [planoDocumento.id],
    }),
    autor: one(users, {
      fields: [documentoComentario.autorId],
      references: [users.id],
    }),
  }),
);

export const quinzenaConfigRelations = relations(quinzenaConfig, ({ one }) => ({
  unit: one(units, {
    fields: [quinzenaConfig.unitId],
    references: [units.id],
  }),
  createdByUser: one(users, {
    fields: [quinzenaConfig.createdBy],
    references: [users.id],
  }),
}));

// ============================================
// Zod Schemas (drizzle-zod)
// ============================================

// Plano Aula schemas
export const insertPlanoAulaSchema = createInsertSchema(planoAula);
export const selectPlanoAulaSchema = createSelectSchema(planoAula);

// Plano Documento schemas
export const insertPlanoDocumentoSchema = createInsertSchema(planoDocumento);
export const selectPlanoDocumentoSchema = createSelectSchema(planoDocumento);

// Documento Comentario schemas
export const insertDocumentoComentarioSchema =
  createInsertSchema(documentoComentario);
export const selectDocumentoComentarioSchema =
  createSelectSchema(documentoComentario);

// Quinzena Config schemas
export const insertQuinzenaConfigSchema = createInsertSchema(quinzenaConfig);
export const selectQuinzenaConfigSchema = createSelectSchema(quinzenaConfig);
