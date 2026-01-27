import { z } from "zod";

/**
 * DTOs para o módulo plano-aula (novo workflow de planejamento)
 *
 * Status Flow:
 * RASCUNHO -> AGUARDANDO_ANALISTA -> AGUARDANDO_COORDENADORA -> APROVADO
 *                    |                        |
 *                    v                        v
 *           DEVOLVIDO_ANALISTA    DEVOLVIDO_COORDENADORA
 *                    |                        |
 *                    v                        v
 *            REVISAO_ANALISTA         (volta para PROFESSORA ou ANALISTA)
 */

// ============================================
// Schemas de Validação (Zod)
// ============================================

/**
 * Schema para criar/buscar plano de aula
 * Professora cria plano para uma turma/quinzena
 */
export const createPlanoSchema = z.object({
  turmaId: z.string().uuid("turmaId deve ser um UUID válido"),
  quinzenaId: z
    .string()
    .regex(
      /^\d{4}-Q\d{2}$/,
      "quinzenaId deve seguir o formato YYYY-QNN (ex: 2026-Q01)",
    ),
});

export type CreatePlanoDto = z.infer<typeof createPlanoSchema>;

/**
 * Schema para adicionar comentário a um documento
 * Analista ou Coordenadora adiciona feedback
 */
export const addComentarioSchema = z.object({
  documentoId: z.string().uuid("documentoId deve ser um UUID válido"),
  comentario: z
    .string()
    .min(1, "Comentário não pode estar vazio")
    .max(2000, "Comentário não pode exceder 2000 caracteres"),
});

export type AddComentarioDto = z.infer<typeof addComentarioSchema>;

/**
 * Schema para devolver plano para ajustes
 * Coordenadora pode devolver para PROFESSORA ou ANALISTA
 */
export const devolverPlanoSchema = z.object({
  destino: z.enum(["PROFESSORA", "ANALISTA"]).optional(),
  comentarios: z
    .array(
      z.object({
        documentoId: z.string().uuid("documentoId deve ser um UUID válido"),
        comentario: z.string().min(1, "Comentário não pode estar vazio"),
      }),
    )
    .optional(),
});

export type DevolverPlanoDto = z.infer<typeof devolverPlanoSchema>;

/**
 * Schema para definir deadline de quinzena
 * Gestão define deadline para entrega de planos
 */
export const setDeadlineSchema = z.object({
  quinzenaId: z
    .string()
    .regex(
      /^\d{4}-Q\d{2}$/,
      "quinzenaId deve seguir o formato YYYY-QNN (ex: 2026-Q01)",
    ),
  deadline: z.string().datetime("deadline deve ser uma data/hora ISO válida"),
});

export type SetDeadlineDto = z.infer<typeof setDeadlineSchema>;

/**
 * Schema para listagem de planos pendentes (query params)
 */
export const listPlanosQuerySchema = z.object({
  quinzenaId: z
    .string()
    .regex(/^\d{4}-Q\d{2}$/)
    .optional(),
  status: z
    .enum([
      "RASCUNHO",
      "AGUARDANDO_ANALISTA",
      "AGUARDANDO_COORDENADORA",
      "DEVOLVIDO_ANALISTA",
      "DEVOLVIDO_COORDENADORA",
      "REVISAO_ANALISTA",
      "APROVADO",
    ])
    .optional(),
  turmaId: z.string().uuid().optional(),
});

export type ListPlanosQueryDto = z.infer<typeof listPlanosQuerySchema>;

/**
 * Schema para filtro do dashboard
 */
export const dashboardQuerySchema = z.object({
  unitId: z.string().uuid().optional(),
  quinzenaId: z.string().optional(),
});

export type DashboardQueryDto = z.infer<typeof dashboardQuerySchema>;

// ============================================
// Role Constants
// ============================================

/**
 * Roles que atuam como analista pedagógico
 */
export const ANALISTA_ROLES = ["analista_pedagogico"] as const;

/**
 * Roles que atuam como coordenadora (por segmento)
 */
export const COORDENADORA_ROLES = [
  "coordenadora_bercario",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_medio",
] as const;

/**
 * Roles de gestão (acesso total ao dashboard)
 */
export const GESTAO_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "coordenadora_geral",
] as const;

/**
 * Roles que podem criar planos (professoras)
 */
export const PROFESSORA_ROLES = ["professora", "auxiliar_sala"] as const;

// ============================================
// Type Guards
// ============================================

export const isAnalista = (role: string): boolean =>
  (ANALISTA_ROLES as readonly string[]).includes(role);

export const isCoordenadora = (role: string): boolean =>
  (COORDENADORA_ROLES as readonly string[]).includes(role);

export const isGestao = (role: string): boolean =>
  (GESTAO_ROLES as readonly string[]).includes(role);

export const isProfessora = (role: string): boolean =>
  (PROFESSORA_ROLES as readonly string[]).includes(role);

// ============================================
// Mapeamento Coordenadora -> Segmento
// ============================================

/**
 * Mapeia role de coordenadora para código de etapa educacional
 */
export const COORDENADORA_STAGE_MAP: Record<string, string> = {
  coordenadora_bercario: "BERCARIO",
  coordenadora_infantil: "INFANTIL",
  coordenadora_fundamental_i: "FUNDAMENTAL_I",
  coordenadora_fundamental_ii: "FUNDAMENTAL_II",
  coordenadora_medio: "MEDIO",
};

/**
 * Retorna os segmentos que uma coordenadora pode aprovar
 * Coordenadora geral pode aprovar todos os segmentos
 */
export const getSegmentosPermitidos = (role: string): string[] | null => {
  if (isGestao(role)) {
    return null; // null = todos os segmentos
  }
  if (isCoordenadora(role)) {
    const segmento = COORDENADORA_STAGE_MAP[role];
    return segmento ? [segmento] : null;
  }
  return []; // Sem permissão
};

// ============================================
// Listagem de Planos para Gestão
// ============================================

/**
 * Schema para listagem de planos da gestão (com paginação)
 * GET /plano-aula/gestao/listar
 */
export const listarPlanosGestaoSchema = z.object({
  status: z
    .enum([
      "todos",
      "rascunho",
      "aguardando-analise",
      "aguardando-aprovacao",
      "devolvidos",
      "aprovados",
    ])
    .optional()
    .default("todos"),
  quinzenaId: z
    .string()
    .regex(/^\d{4}-Q\d{2}$/)
    .optional(),
  segmentoId: z.string().optional(),
  professora: z.string().optional(),
  dataInicio: z.string().datetime().optional(),
  dataFim: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type ListarPlanosGestaoDto = z.infer<typeof listarPlanosGestaoSchema>;

/**
 * Mapeamento de status da URL para status do banco
 */
export const STATUS_URL_MAP: Record<string, string[]> = {
  todos: [],
  rascunho: ["RASCUNHO"],
  "aguardando-analise": ["AGUARDANDO_ANALISTA", "REVISAO_ANALISTA"],
  "aguardando-aprovacao": ["AGUARDANDO_COORDENADORA"],
  devolvidos: ["DEVOLVIDO_ANALISTA", "DEVOLVIDO_COORDENADORA"],
  aprovados: ["APROVADO"],
};
