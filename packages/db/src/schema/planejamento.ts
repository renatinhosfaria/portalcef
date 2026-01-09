import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { educationStages } from "./education-stages.js";
import { users } from "./users.js";

// ============================================
// Planning Status Enum
// ============================================
export const planningStatusEnum = [
  "RASCUNHO", // Salvo localmente ou no servidor, não enviado
  "PENDENTE", // Enviado para coordenação, aguardando review
  "EM_AJUSTE", // Coordenação solicitou ajustes
  "APROVADO", // Coordenação aprovou
] as const;
export type PlanningStatus = (typeof planningStatusEnum)[number];

// ============================================
// Review Status Enum
// ============================================
export const reviewStatusEnum = ["APROVADO", "EM_AJUSTE"] as const;
export type ReviewStatus = (typeof reviewStatusEnum)[number];

// ============================================
// Table: plannings (Mestre)
// ============================================
export const plannings = pgTable(
  "plannings",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Relacionamentos
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stageId: uuid("stage_id").references(() => educationStages.id, {
      onDelete: "set null",
    }),

    // Dados do planejamento
    turmaId: text("turma_id").notNull(), // ID da turma (ex: "INF-1A", "FUND-3B")
    quinzena: text("quinzena").notNull(), // Ex: "2025-Q01" (Quinzena 1 de 2025)

    // Status e fluxo
    status: text("status", { enum: planningStatusEnum })
      .notNull()
      .default("RASCUNHO"),

    // Métricas de entrega (para First Pass Yield)
    reviewCycles: integer("review_cycles").notNull().default(0),
    firstPassYield: boolean("first_pass_yield"), // null até ser aprovado, true se aprovado sem ajustes

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }), // Nullable, preenchido ao enviar
    approvedAt: timestamp("approved_at", { withTimezone: true }), // Nullable, preenchido ao aprovar
  },
  (table) => ({
    // Índice para queries de dashboard por status
    statusIdx: index("plannings_status_idx").on(table.status),
    // Constraint: um professor não pode ter 2 planejamentos para mesma turma/quinzena
    uniquePlanningIdx: uniqueIndex("plannings_user_turma_quinzena_unique").on(
      table.userId,
      table.turmaId,
      table.quinzena,
    ),
  }),
);

// TypeScript types for plannings
export type Planning = typeof plannings.$inferSelect;
export type NewPlanning = typeof plannings.$inferInsert;

// ============================================
// Table: planning_contents (Detalhe 1:1)
// ============================================
export const planningContents = pgTable("planning_contents", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Relacionamento 1:1 com plannings
  planningId: uuid("planning_id")
    .notNull()
    .unique() // Garante relação 1:1
    .references(() => plannings.id, { onDelete: "cascade" }),

  // Campos de conteúdo pedagógico
  objetivos: text("objetivos"), // Nullable para permitir rascunho incompleto
  metodologia: text("metodologia"),
  recursos: text("recursos"),
  atividades: text("atividades"),

  // Novos campos (Refactor 12 passos)
  materia: text("materia"),
  tema: text("tema"),
  habilidades: text("habilidades"),
  conteudos: text("conteudos"),
  avaliacao: text("avaliacao"),
  reforco: text("reforco"),
  anexos: jsonb("anexos"), // Array de objetos { url, name, size }

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// TypeScript types for planning_contents
export type PlanningContent = typeof planningContents.$inferSelect;
export type NewPlanningContent = typeof planningContents.$inferInsert;

// ============================================
// Table: planning_reviews (Histórico de Reviews N:1)
// ============================================
export const planningReviews = pgTable("planning_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Relacionamentos
  planningId: uuid("planning_id")
    .notNull()
    .references(() => plannings.id, { onDelete: "cascade" }),
  reviewerId: uuid("reviewer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Dados do review
  status: text("status", { enum: reviewStatusEnum }).notNull(),
  comentario: text("comentario").notNull(), // Obrigatório conforme RF11

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// TypeScript types for planning_reviews
export type PlanningReview = typeof planningReviews.$inferSelect;
export type NewPlanningReview = typeof planningReviews.$inferInsert;

// ============================================
// Drizzle Relations (for relational queries)
// ============================================

export const planningsRelations = relations(plannings, ({ one, many }) => ({
  user: one(users, {
    fields: [plannings.userId],
    references: [users.id],
  }),
  stage: one(educationStages, {
    fields: [plannings.stageId],
    references: [educationStages.id],
  }),
  content: one(planningContents, {
    fields: [plannings.id],
    references: [planningContents.planningId],
  }),
  reviews: many(planningReviews),
}));

export const planningContentsRelations = relations(
  planningContents,
  ({ one }) => ({
    planning: one(plannings, {
      fields: [planningContents.planningId],
      references: [plannings.id],
    }),
  }),
);

export const planningReviewsRelations = relations(
  planningReviews,
  ({ one }) => ({
    planning: one(plannings, {
      fields: [planningReviews.planningId],
      references: [plannings.id],
    }),
    reviewer: one(users, {
      fields: [planningReviews.reviewerId],
      references: [users.id],
    }),
  }),
);

// ============================================
// Zod Schemas (drizzle-zod)
// ============================================

// Planning schemas
export const insertPlanningSchema = createInsertSchema(plannings);
export const selectPlanningSchema = createSelectSchema(plannings);

// Planning Content schemas
export const insertPlanningContentSchema = createInsertSchema(planningContents);
export const selectPlanningContentSchema = createSelectSchema(planningContents);

// Planning Review schemas
export const insertPlanningReviewSchema = createInsertSchema(planningReviews);
export const selectPlanningReviewSchema = createSelectSchema(planningReviews);
