import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { schools } from "./schools.js";
import { units } from "./units.js";
import { users } from "./users.js";

// ============================================
// Ordem Servico Categoria Enum
// ============================================
export const ordemServicoCategoriaEnum = [
  "ERRO_SISTEMA",
  "DUVIDA_USO",
  "SUGESTAO_MELHORIA",
  "PROBLEMA_ACESSO",
] as const;
export type OrdemServicoCategoria =
  (typeof ordemServicoCategoriaEnum)[number];

// ============================================
// Ordem Servico Status Enum
// ============================================
export const ordemServicoStatusEnum = [
  "ABERTA",
  "EM_ANDAMENTO",
  "RESOLVIDA",
  "FECHADA",
] as const;
export type OrdemServicoStatus = (typeof ordemServicoStatusEnum)[number];

// ============================================
// Mensagem Tipo Enum
// ============================================
export const mensagemTipoEnum = [
  "TEXTO",
  "IMAGEM",
  "VIDEO",
  "AUDIO",
] as const;
export type MensagemTipo = (typeof mensagemTipoEnum)[number];

// ============================================
// Table: ordem_servico
// ============================================
export const ordemServico = pgTable(
  "ordem_servico",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Número sequencial da OS
    numero: serial("numero").notNull(),

    // Dados da OS
    titulo: varchar("titulo", { length: 200 }).notNull(),
    descricao: text("descricao").notNull(),

    // Categoria e status
    categoria: text("categoria", { enum: ordemServicoCategoriaEnum }).notNull(),
    status: text("status", { enum: ordemServicoStatusEnum })
      .notNull()
      .default("ABERTA"),

    // Usuário que criou
    criadoPor: uuid("criado_por")
      .notNull()
      .references(() => users.id),

    // Relacionamentos de tenant
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    unitId: uuid("unit_id").references(() => units.id),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    criadoPorIdx: index("idx_os_criado_por").on(table.criadoPor),
    schoolIdIdx: index("idx_os_school_id").on(table.schoolId),
    statusIdx: index("idx_os_status").on(table.status),
    categoriaIdx: index("idx_os_categoria").on(table.categoria),
    // Índice composto
    criadoPorStatusIdx: index("idx_os_criado_por_status").on(
      table.criadoPor,
      table.status,
    ),
  }),
);

// TypeScript types for ordem_servico
export type OrdemServico = typeof ordemServico.$inferSelect;
export type NewOrdemServico = typeof ordemServico.$inferInsert;

// ============================================
// Table: ordem_servico_mensagem
// ============================================
export const ordemServicoMensagem = pgTable(
  "ordem_servico_mensagem",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Relacionamento com ordem_servico
    ordemServicoId: uuid("ordem_servico_id")
      .notNull()
      .references(() => ordemServico.id, { onDelete: "cascade" }),

    // Conteúdo da mensagem
    conteudo: text("conteudo"),
    tipo: text("tipo", { enum: mensagemTipoEnum }).notNull().default("TEXTO"),

    // Arquivo anexo (opcional)
    arquivoUrl: varchar("arquivo_url", { length: 500 }),
    arquivoNome: varchar("arquivo_nome", { length: 300 }),

    // Usuário que enviou
    criadoPor: uuid("criado_por")
      .notNull()
      .references(() => users.id),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    ordemServicoIdIdx: index("idx_os_msg_ordem_servico_id").on(
      table.ordemServicoId,
    ),
    criadoPorIdx: index("idx_os_msg_criado_por").on(table.criadoPor),
  }),
);

// TypeScript types for ordem_servico_mensagem
export type OrdemServicoMensagem = typeof ordemServicoMensagem.$inferSelect;
export type NewOrdemServicoMensagem = typeof ordemServicoMensagem.$inferInsert;

// ============================================
// Drizzle Relations
// ============================================
export const ordemServicoRelations = relations(
  ordemServico,
  ({ one, many }) => ({
    criadoPorUser: one(users, {
      fields: [ordemServico.criadoPor],
      references: [users.id],
    }),
    school: one(schools, {
      fields: [ordemServico.schoolId],
      references: [schools.id],
    }),
    unit: one(units, {
      fields: [ordemServico.unitId],
      references: [units.id],
    }),
    mensagens: many(ordemServicoMensagem),
  }),
);

export const ordemServicoMensagemRelations = relations(
  ordemServicoMensagem,
  ({ one }) => ({
    ordemServico: one(ordemServico, {
      fields: [ordemServicoMensagem.ordemServicoId],
      references: [ordemServico.id],
    }),
    criadoPorUser: one(users, {
      fields: [ordemServicoMensagem.criadoPor],
      references: [users.id],
    }),
  }),
);

// ============================================
// Zod Schemas (drizzle-zod)
// ============================================
export const insertOrdemServicoSchema = createInsertSchema(ordemServico);
export const selectOrdemServicoSchema = createSelectSchema(ordemServico);

export const insertOrdemServicoMensagemSchema =
  createInsertSchema(ordemServicoMensagem);
export const selectOrdemServicoMensagemSchema =
  createSelectSchema(ordemServicoMensagem);
