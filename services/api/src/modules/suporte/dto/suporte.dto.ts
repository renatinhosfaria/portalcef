import { z } from "zod";

/**
 * DTOs para o modulo de suporte (Ordens de Servico)
 *
 * Sistema de ordens de servico com:
 * - Abertura de OS por qualquer usuario autenticado
 * - Categorias: ERRO_SISTEMA, DUVIDA_USO, SUGESTAO_MELHORIA, PROBLEMA_ACESSO
 * - Mensagens de acompanhamento entre usuario e suporte
 * - Estados: ABERTA, EM_ANDAMENTO, RESOLVIDA, FECHADA
 */

// ============================================
// Schemas de Validacao (Zod)
// ============================================

/**
 * Schema para criar nova ordem de servico
 */
export const criarOrdemServicoSchema = z.object({
  titulo: z
    .string()
    .min(3, "Titulo deve ter pelo menos 3 caracteres")
    .max(200, "Titulo nao pode exceder 200 caracteres"),
  descricao: z
    .string()
    .min(10, "Descricao deve ter pelo menos 10 caracteres")
    .max(5000, "Descricao nao pode exceder 5000 caracteres"),
  categoria: z.enum([
    "ERRO_SISTEMA",
    "DUVIDA_USO",
    "SUGESTAO_MELHORIA",
    "PROBLEMA_ACESSO",
  ]),
});

export type CriarOrdemServicoDto = z.infer<typeof criarOrdemServicoSchema>;

/**
 * Schema para enviar mensagem em uma OS
 */
export const enviarMensagemSchema = z.object({
  conteudo: z
    .string()
    .max(5000, "Conteudo nao pode exceder 5000 caracteres")
    .optional(),
});

export type EnviarMensagemDto = z.infer<typeof enviarMensagemSchema>;

/**
 * Schema para alterar status de uma OS
 */
export const alterarStatusSchema = z.object({
  status: z.enum(["EM_ANDAMENTO", "RESOLVIDA", "FECHADA"]),
});

export type AlterarStatusDto = z.infer<typeof alterarStatusSchema>;

/**
 * Schema para listar ordens de servico com filtros
 */
export const listarOrdemServicoSchema = z.object({
  // Filtros
  status: z
    .enum(["ABERTA", "EM_ANDAMENTO", "RESOLVIDA", "FECHADA"])
    .optional(),
  categoria: z
    .enum([
      "ERRO_SISTEMA",
      "DUVIDA_USO",
      "SUGESTAO_MELHORIA",
      "PROBLEMA_ACESSO",
    ])
    .optional(),

  // Paginacao
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
});

export type ListarOrdemServicoDto = z.infer<typeof listarOrdemServicoSchema>;

// ============================================
// Tipos de Resposta
// ============================================

/**
 * Resposta paginada de ordens de servico
 */
export interface ListarOrdemServicoResponse {
  data: unknown[]; // Sera tipado com OrdemServico no service
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
