import { z } from "zod";

/**
 * DTOs para o módulo de tarefas
 *
 * Sistema de gerenciamento de tarefas com:
 * - Criação manual e automática (via eventos do workflow)
 * - Contextos estruturados (quinzena, etapa, turma, professora)
 * - Filtros avançados e paginação
 * - Estados: PENDENTE, CONCLUIDA, CANCELADA
 */

// ============================================
// Schemas de Validação (Zod)
// ============================================

/**
 * Schema para contexto de tarefa
 * Vincula tarefa a elementos do sistema
 */
export const tarefaContextoSchema = z.object({
  modulo: z.enum([
    "PLANEJAMENTO",
    "CALENDARIO",
    "TURMAS",
    "SHOP",
    "GERAL",
  ]),
  quinzenaId: z.string().optional(),
  etapaId: z.string().uuid().optional(),
  turmaId: z.string().uuid().optional(),
  professoraId: z.string().uuid().optional(),
});

export type TarefaContextoDto = z.infer<typeof tarefaContextoSchema>;

/**
 * Schema para criar nova tarefa
 */
export const criarTarefaSchema = z.object({
  titulo: z
    .string()
    .min(3, "Título deve ter no mínimo 3 caracteres")
    .max(200, "Título não pode exceder 200 caracteres"),
  descricao: z
    .string()
    .max(1000, "Descrição não pode exceder 1000 caracteres")
    .optional(),
  prioridade: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]),
  prazo: z.string().datetime("Prazo deve ser uma data/hora ISO válida"),
  responsavel: z
    .string()
    .uuid("Responsável deve ser um UUID válido"),
  tipoOrigem: z.enum(["MANUAL", "WORKFLOW", "SISTEMA"]),
  contextos: z.array(tarefaContextoSchema).optional(),
});

export type CriarTarefaDto = z.infer<typeof criarTarefaSchema>;

/**
 * Schema para atualizar tarefa existente
 */
export const atualizarTarefaSchema = z.object({
  titulo: z
    .string()
    .min(3, "Título deve ter no mínimo 3 caracteres")
    .max(200, "Título não pode exceder 200 caracteres")
    .optional(),
  descricao: z
    .string()
    .max(1000, "Descrição não pode exceder 1000 caracteres")
    .optional(),
  prioridade: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]).optional(),
  prazo: z.string().datetime("Prazo deve ser uma data/hora ISO válida").optional(),
  responsavel: z
    .string()
    .uuid("Responsável deve ser um UUID válido")
    .optional(),
  status: z.enum(["PENDENTE", "CONCLUIDA", "CANCELADA"]).optional(),
});

export type AtualizarTarefaDto = z.infer<typeof atualizarTarefaSchema>;

/**
 * Schema para listar tarefas com filtros
 */
export const listarTarefasSchema = z.object({
  // Filtros
  status: z.enum(["PENDENTE", "CONCLUIDA", "CANCELADA"]).optional(),
  prioridade: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]).optional(),
  responsavel: z.string().uuid().optional(),
  criadoPor: z.string().uuid().optional(),
  modulo: z
    .enum(["PLANEJAMENTO", "CALENDARIO", "TURMAS", "SHOP", "GERAL"])
    .optional(),
  quinzenaId: z.string().optional(),
  etapaId: z.string().uuid().optional(),
  turmaId: z.string().uuid().optional(),

  // Data range
  prazoInicio: z.string().datetime().optional(),
  prazoFim: z.string().datetime().optional(),

  // Paginação
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),

  // Ordenação
  orderBy: z
    .enum(["prazo", "prioridade", "createdAt", "updatedAt"])
    .optional()
    .default("prazo"),
  orderDir: z.enum(["asc", "desc"]).optional().default("asc"),
});

export type ListarTarefasDto = z.infer<typeof listarTarefasSchema>;

/**
 * Schema para marcar tarefa como concluída
 */
export const concluirTarefaSchema = z.object({
  observacoes: z
    .string()
    .max(500, "Observações não podem exceder 500 caracteres")
    .optional(),
});

export type ConcluirTarefaDto = z.infer<typeof concluirTarefaSchema>;

/**
 * Schema para cancelar tarefa
 */
export const cancelarTarefaSchema = z.object({
  motivo: z
    .string()
    .min(3, "Motivo deve ter no mínimo 3 caracteres")
    .max(500, "Motivo não pode exceder 500 caracteres"),
});

export type CancelarTarefaDto = z.infer<typeof cancelarTarefaSchema>;

// ============================================
// Tipos de Resposta
// ============================================

/**
 * Resposta paginada de tarefas
 */
export interface ListarTarefasResponse {
  data: unknown[]; // Será tipado com Tarefa no service
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
