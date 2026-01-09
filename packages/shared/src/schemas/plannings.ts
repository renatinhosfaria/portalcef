/**
 * Zod Validation Schemas for Planning Module
 * Schemas compartilhados entre frontend e backend
 */

import { z } from "zod";

/**
 * Planning Status Enum
 */
export const planningStatusSchema = z.enum([
  "RASCUNHO",
  "PENDENTE",
  "EM_AJUSTE",
  "APROVADO",
]);

/**
 * Review Status Enum
 */
export const reviewStatusSchema = z.enum(["APROVADO", "EM_AJUSTE"]);

/**
 * Schema para Save Draft (POST /plannings/draft)
 * Permite salvar rascunho parcial, apenas turma e quinzena obrigatórios
 */
export const saveDraftSchema = z.object({
  turma: z.string().min(1, "Turma é obrigatória"),
  quinzena: z.string().min(1, "Quinzena é obrigatória"),
  objetivos: z.string().optional(),
  metodologia: z.string().optional(),
  recursos: z.string().optional(),
  atividades: z.string().optional(),
});

/**
 * Schema para Submit Planning (POST /plannings/submit)
 * Dados completos obrigatórios para submissão
 */
export const submitPlanningSchema = z.object({
  turma: z.string().min(1, "Turma é obrigatória"),
  quinzena: z.string().min(1, "Quinzena é obrigatória"),
  objetivos: z.string().min(20, "Objetivos devem ter pelo menos 20 caracteres"),
  metodologia: z
    .string()
    .min(30, "Metodologia deve ter pelo menos 30 caracteres"),
  recursos: z.string().min(1, "Recursos são obrigatórios"),
});

/**
 * Schema para Approve Planning (POST /plannings/:id/approve)
 */
export const approvePlanningSchema = z.object({
  planningId: z.string().uuid("ID de planejamento inválido"),
});

/**
 * Schema para Request Changes (POST /plannings/:id/request-changes)
 */
export const requestChangesSchema = z.object({
  planningId: z.string().uuid("ID de planejamento inválido"),
  comment: z
    .string()
    .min(10, "Comentário deve ter pelo menos 10 caracteres")
    .max(2000, "Comentário deve ter no máximo 2000 caracteres"),
});

/**
 * Schema para query de dashboard
 */
export const dashboardQuerySchema = z.object({
  stage: z
    .enum(["BERCARIO", "INFANTIL", "FUNDAMENTAL_I", "FUNDAMENTAL_II", "MEDIO"])
    .optional(),
  segment: z
    .enum(["BERCARIO", "INFANTIL", "FUNDAMENTAL_I", "FUNDAMENTAL_II", "MEDIO"])
    .optional(),
});

/**
 * Schema para Planning Response (GET /plannings/:id)
 */
export const planningSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  stageId: z.string().uuid().nullable(),
  turmaId: z.string(),
  quinzena: z.string(),
  status: planningStatusSchema,
  reviewCycles: z.number().int().min(0),
  firstPassYield: z.boolean().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  submittedAt: z.coerce.date().nullable(),
  approvedAt: z.coerce.date().nullable(),
});

/**
 * Schema para Planning Content
 */
export const planningContentSchema = z.object({
  id: z.string().uuid(),
  planningId: z.string().uuid(),
  objetivos: z.string().nullable(),
  metodologia: z.string().nullable(),
  recursos: z.string().nullable(),
  atividades: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/**
 * Schema para Planning Review
 */
export const planningReviewSchema = z.object({
  id: z.string().uuid(),
  planningId: z.string().uuid(),
  reviewerId: z.string().uuid(),
  status: reviewStatusSchema,
  comentario: z.string(),
  createdAt: z.coerce.date(),
});

/**
 * Schema para Planning com Content (joined)
 */
export const planningWithContentSchema = planningSchema.extend({
  content: planningContentSchema.nullable(),
});

/**
 * Schema para Planning com Reviews (joined)
 */
export const planningWithReviewsSchema = planningSchema.extend({
  reviews: z.array(planningReviewSchema),
});

/**
 * Schema para Planning completo (com content e reviews)
 */
export const planningFullSchema = planningSchema.extend({
  content: planningContentSchema.nullable(),
  reviews: z.array(planningReviewSchema),
});

/**
 * Schema para Turma (GET /plannings/turmas)
 */
export const turmaSchema = z.object({
  id: z.string().uuid(),
  unitId: z.string().uuid(),
  stageId: z.string().uuid(),
  professoraId: z.string().uuid().nullable(),
  name: z.string(),
  code: z.string(),
  year: z.number().int(),
  shift: z.string().nullable(),
  capacity: z.number().int().nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/**
 * Schema para Quinzena (GET /plannings/quinzenas)
 */
export const quinzenaSchema = z.object({
  id: z.string(), // Ex: "2025-Q01"
  label: z.string(), // Ex: "Quinzena 1 (01/01 - 15/01)"
  startDate: z.string(), // ISO date string
  endDate: z.string(), // ISO date string
});

/**
 * Export tipos TypeScript inferidos dos schemas
 */
export type PlanningStatus = z.infer<typeof planningStatusSchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;
export type SubmitPlanningInput = z.infer<typeof submitPlanningSchema>;
export type ApprovePlanningInput = z.infer<typeof approvePlanningSchema>;
export type RequestChangesInput = z.infer<typeof requestChangesSchema>;
export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;
export type Planning = z.infer<typeof planningSchema>;
export type PlanningContent = z.infer<typeof planningContentSchema>;
export type PlanningReview = z.infer<typeof planningReviewSchema>;
export type PlanningWithContent = z.infer<typeof planningWithContentSchema>;
export type PlanningWithReviews = z.infer<typeof planningWithReviewsSchema>;
export type PlanningFull = z.infer<typeof planningFullSchema>;
export type Turma = z.infer<typeof turmaSchema>;
export type Quinzena = z.infer<typeof quinzenaSchema>;
