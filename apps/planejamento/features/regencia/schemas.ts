/**
 * Regência Feature - Schemas
 * Validação Zod para ações do painel de regência
 */

import { z } from "zod";

/**
 * Schema para solicitar ajustes com comentário
 */
export const requestChangesSchema = z.object({
  planningId: z.string().uuid("ID do planejamento inválido"),
  comment: z
    .string()
    .min(10, "O comentário deve ter pelo menos 10 caracteres")
    .max(2000, "O comentário deve ter no máximo 2000 caracteres"),
});

export type RequestChangesInput = z.infer<typeof requestChangesSchema>;

/**
 * Schema para aprovar planejamento
 */
export const approvePlanningSchema = z.object({
  planningId: z.string().uuid("ID do planejamento inválido"),
});

export type ApprovePlanningInput = z.infer<typeof approvePlanningSchema>;
