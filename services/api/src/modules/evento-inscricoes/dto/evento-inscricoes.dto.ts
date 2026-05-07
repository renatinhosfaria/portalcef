import { z } from "zod";

// ============================================
// Lista de turmas aceitas (deve casar com o select da landing)
// ============================================
export const turmasEvento = [
  "Berçário",
  "Infantil 1",
  "Infantil 2",
  "Infantil 3",
  "Infantil 4",
  "Infantil 5",
  "1º Ano do Fundamental",
  "2º Ano do Fundamental",
  "3º Ano do Fundamental",
  "4º Ano do Fundamental",
  "5º Ano do Fundamental",
] as const;

// ============================================
// Sanitização e validação de CPF (formato 000.000.000-00)
// ============================================
const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;

// Telefone (00) 00000-0000 ou (00) 0000-0000
const telefoneRegex = /^\(\d{2}\)\s?\d{4,5}-\d{4}$/;

// ============================================
// POST /api/eventos/:slug/inscricoes — body
// ============================================
export const criarInscricaoSchema = z.object({
  nome: z.string().trim().min(3, "Nome muito curto").max(200),
  cpf: z
    .string()
    .trim()
    .regex(cpfRegex, "CPF inválido (formato 000.000.000-00)"),
  dataNascimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD)"),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(200),
  telefone: z
    .string()
    .trim()
    .regex(telefoneRegex, "Telefone inválido (formato (00) 00000-0000)"),
  filhos: z
    .array(
      z.object({
        nome: z.string().trim().min(2, "Nome do filho muito curto").max(200),
        turma: z.enum(turmasEvento, {
          errorMap: () => ({ message: "Turma inválida" }),
        }),
      }),
    )
    .min(1, "Informe pelo menos um filho")
    .max(10, "Limite de filhos por inscrição: 10"),
});

export type CriarInscricaoDto = z.infer<typeof criarInscricaoSchema>;

// ============================================
// GET /api/eventos/:slug/inscricoes — query
// ============================================
export const listarInscricoesSchema = z.object({
  turma: z.string().trim().optional(),
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type ListarInscricoesDto = z.infer<typeof listarInscricoesSchema>;
