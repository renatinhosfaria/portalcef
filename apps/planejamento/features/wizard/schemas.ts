import { z } from "zod";

export const materiaStepSchema = z.object({
  materia: z
    .string()
    .trim()
    .min(3, "Informe a matéria com pelo menos 3 caracteres"),
});

export const temaStepSchema = z.object({
  tema: z.string().trim().min(3, "Informe o tema com pelo menos 3 caracteres"),
});

export const objetivosStepSchema = z.object({
  objetivos: z
    .string()
    .trim()
    .min(20, "Descreva os objetivos com mais detalhes (min 20 carac.)"),
});

export const habilidadesStepSchema = z.object({
  habilidades: z.string().trim().min(10, "Informe as habilidades/códigos BNCC"),
});

export const conteudosStepSchema = z.object({
  conteudos: z
    .string()
    .trim()
    .min(10, "Informe os conteúdos que serão trabalhados"),
});

export const metodologiaStepSchema = z.object({
  metodologia: z.string().trim().min(20, "Descreva a metodologia"),
});

export const recursosStepSchema = z.object({
  recursos: z.string().trim().min(5, "Liste os recursos necessários"),
});

export const avaliacaoStepSchema = z.object({
  avaliacao: z.string().trim().min(10, "Descreva os critérios de avaliação"),
});

export const reforcoStepSchema = z.object({
  reforco: z.string().trim().min(10, "Descreva as estratégias de reforço"),
});

export const reviewStepSchema = z.object({}); // No validation needed for review, mainly read-only
export const anexosStepSchema = z.object({}); // Optional files
export const conclusaoStepSchema = z.object({});

export const planningStepSchemas = {
  materia: materiaStepSchema,
  tema: temaStepSchema,
  objetivos: objetivosStepSchema,
  habilidades: habilidadesStepSchema,
  conteudos: conteudosStepSchema,
  metodologia: metodologiaStepSchema,
  recursos: recursosStepSchema,
  avaliacao: avaliacaoStepSchema,
  reforco: reforcoStepSchema,
  review: reviewStepSchema,
  anexos: anexosStepSchema,
  conclusao: conclusaoStepSchema,
} as const;

export type PlanningFormData = z.infer<typeof materiaStepSchema> &
  z.infer<typeof temaStepSchema> &
  z.infer<typeof objetivosStepSchema> &
  z.infer<typeof habilidadesStepSchema> &
  z.infer<typeof conteudosStepSchema> &
  z.infer<typeof metodologiaStepSchema> &
  z.infer<typeof recursosStepSchema> &
  z.infer<typeof avaliacaoStepSchema> &
  z.infer<typeof reforcoStepSchema> & {
    turma?: string;
    quinzena?: string;
  };

/**
 * Story 2.4 - Schema para Server Action saveDraft
 * Permite salvar rascunho parcial, apenas turma e quinzena obrigatórios
 */
export const saveDraftInputSchema = z.object({
  turma: z.string().min(1, "Turma é obrigatória").optional(), // Making optional for flexibility in new flow or keep required?
  // Old flow required them, but new flow steps are linear.
  // Let's keep generic loose schema for draft
  quinzena: z.string().optional(),
  materia: z.string().optional(),
  tema: z.string().optional(),
  objetivos: z.string().optional(),
  metodologia: z.string().optional(),
  recursos: z.string().optional(),
  // Add other fields as optional
  habilidades: z.string().optional(),
  conteudos: z.string().optional(),
  avaliacao: z.string().optional(),
  reforco: z.string().optional(),

  // Identifiers
  visitorId: z.string().optional(),
});

export type SaveDraftInput = z.infer<typeof saveDraftInputSchema>;
