import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { educationStages } from "./education-stages.js";
import { schools } from "./schools.js";
import { turmas } from "./turmas.js";
import { units } from "./units.js";
import { users } from "./users.js";

// ============================================
// Tarefa Status Enum
// ============================================
export const tarefaStatusEnum = ["PENDENTE", "CONCLUIDA", "CANCELADA"] as const;
export type TarefaStatus = (typeof tarefaStatusEnum)[number];

// ============================================
// Tarefa Prioridade Enum
// ============================================
export const tarefaPrioridadeEnum = ["ALTA", "MEDIA", "BAIXA"] as const;
export type TarefaPrioridade = (typeof tarefaPrioridadeEnum)[number];

// ============================================
// Tarefa Tipo Origem Enum
// ============================================
export const tarefaTipoOrigemEnum = ["AUTOMATICA", "MANUAL"] as const;
export type TarefaTipoOrigem = (typeof tarefaTipoOrigemEnum)[number];

// ============================================
// Tarefa Contexto Modulo Enum
// ============================================
export const tarefaContextoModuloEnum = [
  "PLANEJAMENTO",
  "CALENDARIO",
  "USUARIOS",
  "TURMAS",
  "LOJA",
] as const;
export type TarefaContextoModulo = (typeof tarefaContextoModuloEnum)[number];

// ============================================
// Table: tarefas
// ============================================
export const tarefas = pgTable(
  "tarefas",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Relacionamentos
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    unitId: uuid("unit_id").references(() => units.id),

    // Dados da tarefa
    titulo: text("titulo").notNull(),
    descricao: text("descricao"),

    // Status e prioridade
    status: text("status", { enum: tarefaStatusEnum })
      .notNull()
      .default("PENDENTE"),
    prioridade: text("prioridade", { enum: tarefaPrioridadeEnum }).notNull(),

    // Prazo
    prazo: timestamp("prazo", { withTimezone: true }).notNull(),

    // Usuários
    criadoPor: uuid("criado_por")
      .notNull()
      .references(() => users.id),
    responsavel: uuid("responsavel")
      .notNull()
      .references(() => users.id),

    // Origem
    tipoOrigem: text("tipo_origem", { enum: tarefaTipoOrigemEnum }).notNull(),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    concluidaEm: timestamp("concluida_em", { withTimezone: true }),
  },
  (table) => ({
    responsavelIdx: index("idx_tarefas_responsavel").on(table.responsavel),
    criadoPorIdx: index("idx_tarefas_criado_por").on(table.criadoPor),
    schoolIdIdx: index("idx_tarefas_school_id").on(table.schoolId),
    unitIdIdx: index("idx_tarefas_unit_id").on(table.unitId),
    statusIdx: index("idx_tarefas_status").on(table.status),
    prazoIdx: index("idx_tarefas_prazo").on(table.prazo),
    // Índices compostos
    responsavelStatusIdx: index("idx_tarefas_responsavel_status").on(
      table.responsavel,
      table.status,
    ),
    responsavelPrazoIdx: index("idx_tarefas_responsavel_prazo").on(
      table.responsavel,
      table.prazo,
    ),
  }),
);

// TypeScript types for tarefas
export type Tarefa = typeof tarefas.$inferSelect;
export type NewTarefa = typeof tarefas.$inferInsert;

// ============================================
// Table: tarefa_contextos
// ============================================
export const tarefaContextos = pgTable(
  "tarefa_contextos",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Relacionamento com tarefa
    tarefaId: uuid("tarefa_id")
      .notNull()
      .references(() => tarefas.id, { onDelete: "cascade" }),

    // Módulo
    modulo: text("modulo", { enum: tarefaContextoModuloEnum }).notNull(),

    // Contexto flexível (opcional)
    quinzenaId: varchar("quinzena_id", { length: 10 }),
    etapaId: uuid("etapa_id").references(() => educationStages.id),
    turmaId: uuid("turma_id").references(() => turmas.id),
    professoraId: uuid("professora_id").references(() => users.id),
  },
  (table) => ({
    tarefaIdIdx: index("idx_tarefa_contextos_tarefa_id").on(table.tarefaId),
    moduloIdx: index("idx_tarefa_contextos_modulo").on(table.modulo),
    quinzenaIdIdx: index("idx_tarefa_contextos_quinzena_id").on(
      table.quinzenaId,
    ),
    turmaIdIdx: index("idx_tarefa_contextos_turma_id").on(table.turmaId),
  }),
);

// TypeScript types for tarefa_contextos
export type TarefaContexto = typeof tarefaContextos.$inferSelect;
export type NewTarefaContexto = typeof tarefaContextos.$inferInsert;

// ============================================
// Drizzle Relations
// ============================================
export const tarefasRelations = relations(tarefas, ({ one, many }) => ({
  school: one(schools, {
    fields: [tarefas.schoolId],
    references: [schools.id],
  }),
  unit: one(units, {
    fields: [tarefas.unitId],
    references: [units.id],
  }),
  criadoPorUser: one(users, {
    fields: [tarefas.criadoPor],
    references: [users.id],
    relationName: "tarefasCriadasPorUsuario",
  }),
  responsavelUser: one(users, {
    fields: [tarefas.responsavel],
    references: [users.id],
    relationName: "tarefasResponsavelUsuario",
  }),
  contextos: many(tarefaContextos),
}));

export const tarefaContextosRelations = relations(
  tarefaContextos,
  ({ one }) => ({
    tarefa: one(tarefas, {
      fields: [tarefaContextos.tarefaId],
      references: [tarefas.id],
    }),
    etapa: one(educationStages, {
      fields: [tarefaContextos.etapaId],
      references: [educationStages.id],
    }),
    turma: one(turmas, {
      fields: [tarefaContextos.turmaId],
      references: [turmas.id],
    }),
    professora: one(users, {
      fields: [tarefaContextos.professoraId],
      references: [users.id],
    }),
  }),
);

// ============================================
// Zod Schemas (drizzle-zod)
// ============================================
export const insertTarefaSchema = createInsertSchema(tarefas);
export const selectTarefaSchema = createSelectSchema(tarefas);

export const insertTarefaContextoSchema = createInsertSchema(tarefaContextos);
export const selectTarefaContextoSchema = createSelectSchema(tarefaContextos);
