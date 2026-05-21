/**
 * Schemas compartilhados do controller legado de plannings.
 */

import { z } from "zod";

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

export type Turma = z.infer<typeof turmaSchema>;
