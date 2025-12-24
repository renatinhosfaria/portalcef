/**
 * Zod Validation Schemas for Wizard Forms
 * Story 2.2 - Formulário de Conteúdo do Planejamento
 */

import { z } from "zod";

/**
 * Schema para Passo 1: Dados do Planejamento
 * Valida seleção de turma e quinzena
 */
export const dadosStepSchema = z.object({
  turma: z.string().min(1, "Selecione uma turma"),
  quinzena: z.string().min(1, "Selecione uma quinzena"),
});

/**
 * Schema para Passo 2: Objetivos de Aprendizagem
 * Valida descrição dos objetivos com mínimo de 20 caracteres
 */
export const objetivosStepSchema = z.object({
  objetivos: z
    .string()
    .trim()
    .min(20, "Os objetivos devem ter pelo menos 20 caracteres. Seja mais descritiva!"),
});

/**
 * Schema para Passo 3: Metodologia
 * Valida descrição da metodologia com mínimo de 30 caracteres
 */
export const metodologiaStepSchema = z.object({
  metodologia: z
    .string()
    .trim()
    .min(
      30,
      "A metodologia deve ter pelo menos 30 caracteres. Descreva como você trabalhará os objetivos!"
    ),
});

/**
 * Schema para Passo 4: Recursos e Atividades
 * Valida lista de recursos com mínimo de 1 item
 */
export const recursosStepSchema = z.object({
  recursos: z
    .array(z.string().trim().min(1, "O recurso não pode estar vazio"))
    .min(1, "Adicione pelo menos um recurso ou atividade"),
});

/**
 * Objeto consolidado com todos os schemas por passo
 */
export const planningStepSchemas = {
  dados: dadosStepSchema,
  objetivos: objetivosStepSchema,
  metodologia: metodologiaStepSchema,
  recursos: recursosStepSchema,
} as const;

/**
 * Tipos TypeScript inferidos dos schemas
 */
export type DadosStepData = z.infer<typeof dadosStepSchema>;
export type ObjetivosStepData = z.infer<typeof objetivosStepSchema>;
export type MetodologiaStepData = z.infer<typeof metodologiaStepSchema>;
export type RecursosStepData = z.infer<typeof recursosStepSchema>;

/**
 * Tipo consolidado de todos os dados do planejamento
 */
export type PlanningFormData = DadosStepData &
  ObjetivosStepData &
  MetodologiaStepData &
  RecursosStepData;
