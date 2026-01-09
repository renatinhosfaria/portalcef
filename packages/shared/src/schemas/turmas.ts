import { z } from "zod";

export const createTurmaSchema = z.object({
  unitId: z.string().uuid("ID da unidade deve ser um UUID válido"),
  stageId: z.string().uuid("ID da etapa deve ser um UUID válido"),
  name: z
    .string()
    .min(1, "Nome da turma é obrigatório")
    .max(100, "Nome não pode exceder 100 caracteres"),
  code: z
    .string()
    .min(1, "Código é obrigatório")
    .max(50, "Código não pode exceder 50 caracteres"),
  year: z
    .number()
    .int("Ano deve ser um número inteiro")
    .min(2020, "Ano não pode ser anterior a 2020")
    .max(2100, "Ano não pode ser posterior a 2100"),
  shift: z
    .enum(["matutino", "vespertino", "integral"], {
      errorMap: () => ({
        message: 'Turno deve ser "matutino", "vespertino" ou "integral"',
      }),
    })
    .optional(),
  capacity: z
    .number()
    .int("Capacidade deve ser um número inteiro")
    .positive("Capacidade deve ser maior que zero")
    .optional(),
});

export const updateTurmaSchema = createTurmaSchema
  .partial()
  .omit({ unitId: true, stageId: true });

export type CreateTurmaInput = z.infer<typeof createTurmaSchema>;
export type UpdateTurmaInput = z.infer<typeof updateTurmaSchema>;
