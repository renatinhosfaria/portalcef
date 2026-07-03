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

import { schools } from "./schools.js";
import { units } from "./units.js";
import { users } from "./users.js";

export const workflowModeloStatusEnum = [
  "RASCUNHO",
  "PUBLICADO",
  "INATIVO",
] as const;
export type WorkflowModeloStatus = (typeof workflowModeloStatusEnum)[number];

export const workflowExecucaoStatusEnum = [
  "EM_ANDAMENTO",
  "CONCLUIDA",
  "CANCELADA",
] as const;
export type WorkflowExecucaoStatus =
  (typeof workflowExecucaoStatusEnum)[number];

export const workflowHistoricoTipoEnum = [
  "WORKFLOW_INICIADO",
  "ETAPA_CONCLUIDA",
  "ETAPA_PENDENTE",
  "OBSERVACAO_ETAPA_ALTERADA",
  "ANEXO_ENVIADO",
  "ANEXO_REMOVIDO",
  "TITULO_EXECUCAO_EDITADO",
  "MODELO_ATUALIZADO",
  "EXECUCAO_CONCLUIDA",
  "EXECUCAO_CANCELADA",
  "EXECUCAO_REABERTA",
  "EXECUCAO_DESCARTADA",
] as const;
export type WorkflowHistoricoTipo =
  (typeof workflowHistoricoTipoEnum)[number];

export const workflowCategorias = pgTable(
  "workflow_categorias",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    nome: varchar("nome", { length: 120 }).notNull(),
    ativo: boolean("ativo").notNull().default(true),
    ordem: integer("ordem").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    unidadeOrdemIdx: index("idx_workflow_categorias_unidade_ordem").on(
      table.unitId,
      table.ordem,
    ),
    nomeUnicoIdx: uniqueIndex("workflow_categorias_unit_nome_unique").on(
      table.unitId,
      table.nome,
    ),
  }),
);

export const workflowModelos = pgTable(
  "workflow_modelos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    categoriaId: uuid("categoria_id")
      .notNull()
      .references(() => workflowCategorias.id, { onDelete: "restrict" }),
    nome: varchar("nome", { length: 180 }).notNull(),
    descricaoCurta: varchar("descricao_curta", { length: 300 }).notNull(),
    status: text("status", { enum: workflowModeloStatusEnum })
      .notNull()
      .default("RASCUNHO"),
    criadoPor: uuid("criado_por")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    unidadeStatusIdx: index("idx_workflow_modelos_unidade_status").on(
      table.unitId,
      table.status,
    ),
    categoriaIdx: index("idx_workflow_modelos_categoria").on(table.categoriaId),
  }),
);

export const workflowOrientacoes = pgTable(
  "workflow_orientacoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modeloId: uuid("modelo_id")
      .notNull()
      .references(() => workflowModelos.id, { onDelete: "cascade" }),
    titulo: varchar("titulo", { length: 140 }).notNull(),
    conteudo: text("conteudo").notNull(),
    ordem: integer("ordem").notNull(),
  },
  (table) => ({
    modeloOrdemIdx: index("idx_workflow_orientacoes_modelo_ordem").on(
      table.modeloId,
      table.ordem,
    ),
  }),
);

export const workflowFases = pgTable(
  "workflow_fases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modeloId: uuid("modelo_id")
      .notNull()
      .references(() => workflowModelos.id, { onDelete: "cascade" }),
    nome: varchar("nome", { length: 140 }).notNull(),
    ordem: integer("ordem").notNull(),
  },
  (table) => ({
    modeloOrdemIdx: index("idx_workflow_fases_modelo_ordem").on(
      table.modeloId,
      table.ordem,
    ),
  }),
);

export const workflowEtapas = pgTable(
  "workflow_etapas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    faseId: uuid("fase_id")
      .notNull()
      .references(() => workflowFases.id, { onDelete: "cascade" }),
    titulo: varchar("titulo", { length: 180 }).notNull(),
    instrucao: text("instrucao"),
    ordem: integer("ordem").notNull(),
    versao: integer("versao").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    faseOrdemIdx: index("idx_workflow_etapas_fase_ordem").on(
      table.faseId,
      table.ordem,
    ),
  }),
);

export const workflowExecucoes = pgTable(
  "workflow_execucoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    modeloId: uuid("modelo_id")
      .notNull()
      .references(() => workflowModelos.id, { onDelete: "restrict" }),
    titulo: varchar("titulo", { length: 220 }).notNull(),
    status: text("status", { enum: workflowExecucaoStatusEnum })
      .notNull()
      .default("EM_ANDAMENTO"),
    teste: boolean("teste").notNull().default(false),
    modeloAtualizado: boolean("modelo_atualizado").notNull().default(false),
    iniciadoPor: uuid("iniciado_por")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    concluidoAt: timestamp("concluido_at", { withTimezone: true }),
    canceladoAt: timestamp("cancelado_at", { withTimezone: true }),
    motivoCancelamento: text("motivo_cancelamento"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    unidadeStatusIdx: index("idx_workflow_execucoes_unidade_status").on(
      table.unitId,
      table.status,
    ),
    iniciadoPorIdx: index("idx_workflow_execucoes_iniciado_por").on(
      table.iniciadoPor,
    ),
    modeloIdx: index("idx_workflow_execucoes_modelo").on(table.modeloId),
  }),
);

export const workflowEtapaProgresso = pgTable(
  "workflow_etapa_progresso",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    execucaoId: uuid("execucao_id")
      .notNull()
      .references(() => workflowExecucoes.id, { onDelete: "cascade" }),
    etapaId: uuid("etapa_id")
      .notNull()
      .references(() => workflowEtapas.id, { onDelete: "cascade" }),
    etapaVersao: integer("etapa_versao").notNull().default(1),
    concluida: boolean("concluida").notNull().default(false),
    observacao: text("observacao"),
    concluidaPor: uuid("concluida_por").references(() => users.id, {
      onDelete: "set null",
    }),
    concluidaAt: timestamp("concluida_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    execucaoEtapaIdx: uniqueIndex("workflow_progresso_execucao_etapa_unique").on(
      table.execucaoId,
      table.etapaId,
    ),
    execucaoIdx: index("idx_workflow_progresso_execucao").on(table.execucaoId),
  }),
);

export const workflowAnexos = pgTable(
  "workflow_anexos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    execucaoId: uuid("execucao_id")
      .notNull()
      .references(() => workflowExecucoes.id, { onDelete: "cascade" }),
    nomeOriginal: varchar("nome_original", { length: 255 }).notNull(),
    storageKey: varchar("storage_key", { length: 500 }).notNull(),
    url: varchar("url", { length: 1000 }).notNull(),
    mimeType: varchar("mime_type", { length: 160 }).notNull(),
    tamanhoBytes: integer("tamanho_bytes").notNull(),
    enviadoPor: uuid("enviado_por")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    execucaoIdx: index("idx_workflow_anexos_execucao").on(table.execucaoId),
  }),
);

export const workflowHistorico = pgTable(
  "workflow_historico",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    execucaoId: uuid("execucao_id")
      .notNull()
      .references(() => workflowExecucoes.id, { onDelete: "cascade" }),
    tipo: text("tipo", { enum: workflowHistoricoTipoEnum }).notNull(),
    descricao: text("descricao").notNull(),
    motivo: text("motivo"),
    metadata: text("metadata"),
    autorId: uuid("autor_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    execucaoIdx: index("idx_workflow_historico_execucao").on(table.execucaoId),
    tipoIdx: index("idx_workflow_historico_tipo").on(table.tipo),
  }),
);

export const workflowCategoriasRelations = relations(
  workflowCategorias,
  ({ one, many }) => ({
    school: one(schools, {
      fields: [workflowCategorias.schoolId],
      references: [schools.id],
    }),
    unit: one(units, {
      fields: [workflowCategorias.unitId],
      references: [units.id],
    }),
    modelos: many(workflowModelos),
  }),
);

export const workflowModelosRelations = relations(
  workflowModelos,
  ({ one, many }) => ({
    categoria: one(workflowCategorias, {
      fields: [workflowModelos.categoriaId],
      references: [workflowCategorias.id],
    }),
    criadoPorUser: one(users, {
      fields: [workflowModelos.criadoPor],
      references: [users.id],
    }),
    orientacoes: many(workflowOrientacoes),
    fases: many(workflowFases),
    execucoes: many(workflowExecucoes),
  }),
);

export const workflowOrientacoesRelations = relations(
  workflowOrientacoes,
  ({ one }) => ({
    modelo: one(workflowModelos, {
      fields: [workflowOrientacoes.modeloId],
      references: [workflowModelos.id],
    }),
  }),
);

export const workflowFasesRelations = relations(
  workflowFases,
  ({ one, many }) => ({
    modelo: one(workflowModelos, {
      fields: [workflowFases.modeloId],
      references: [workflowModelos.id],
    }),
    etapas: many(workflowEtapas),
  }),
);

export const workflowEtapasRelations = relations(
  workflowEtapas,
  ({ one, many }) => ({
    fase: one(workflowFases, {
      fields: [workflowEtapas.faseId],
      references: [workflowFases.id],
    }),
    progresso: many(workflowEtapaProgresso),
  }),
);

export const workflowExecucoesRelations = relations(
  workflowExecucoes,
  ({ one, many }) => ({
    modelo: one(workflowModelos, {
      fields: [workflowExecucoes.modeloId],
      references: [workflowModelos.id],
    }),
    iniciadoPorUser: one(users, {
      fields: [workflowExecucoes.iniciadoPor],
      references: [users.id],
    }),
    progresso: many(workflowEtapaProgresso),
    anexos: many(workflowAnexos),
    historico: many(workflowHistorico),
  }),
);

export const workflowEtapaProgressoRelations = relations(
  workflowEtapaProgresso,
  ({ one }) => ({
    execucao: one(workflowExecucoes, {
      fields: [workflowEtapaProgresso.execucaoId],
      references: [workflowExecucoes.id],
    }),
    etapa: one(workflowEtapas, {
      fields: [workflowEtapaProgresso.etapaId],
      references: [workflowEtapas.id],
    }),
    concluidaPorUser: one(users, {
      fields: [workflowEtapaProgresso.concluidaPor],
      references: [users.id],
    }),
  }),
);

export const workflowAnexosRelations = relations(
  workflowAnexos,
  ({ one }) => ({
    execucao: one(workflowExecucoes, {
      fields: [workflowAnexos.execucaoId],
      references: [workflowExecucoes.id],
    }),
    enviadoPorUser: one(users, {
      fields: [workflowAnexos.enviadoPor],
      references: [users.id],
    }),
  }),
);

export const workflowHistoricoRelations = relations(
  workflowHistorico,
  ({ one }) => ({
    execucao: one(workflowExecucoes, {
      fields: [workflowHistorico.execucaoId],
      references: [workflowExecucoes.id],
    }),
    autor: one(users, {
      fields: [workflowHistorico.autorId],
      references: [users.id],
    }),
  }),
);

export type WorkflowCategoria = typeof workflowCategorias.$inferSelect;
export type NewWorkflowCategoria = typeof workflowCategorias.$inferInsert;
export type WorkflowModelo = typeof workflowModelos.$inferSelect;
export type NewWorkflowModelo = typeof workflowModelos.$inferInsert;
export type WorkflowOrientacao = typeof workflowOrientacoes.$inferSelect;
export type WorkflowFase = typeof workflowFases.$inferSelect;
export type WorkflowEtapa = typeof workflowEtapas.$inferSelect;
export type WorkflowExecucao = typeof workflowExecucoes.$inferSelect;
export type WorkflowEtapaProgresso =
  typeof workflowEtapaProgresso.$inferSelect;
export type WorkflowAnexo = typeof workflowAnexos.$inferSelect;
export type WorkflowHistorico = typeof workflowHistorico.$inferSelect;

export const insertWorkflowCategoriaSchema =
  createInsertSchema(workflowCategorias);
export const selectWorkflowCategoriaSchema =
  createSelectSchema(workflowCategorias);
export const insertWorkflowModeloSchema = createInsertSchema(workflowModelos);
export const selectWorkflowModeloSchema = createSelectSchema(workflowModelos);
export const insertWorkflowExecucaoSchema =
  createInsertSchema(workflowExecucoes);
export const selectWorkflowExecucaoSchema =
  createSelectSchema(workflowExecucoes);
