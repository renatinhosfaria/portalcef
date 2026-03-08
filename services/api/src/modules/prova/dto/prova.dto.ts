import { z } from "zod";

/**
 * DTOs para o módulo prova (workflow de aprovação de provas)
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
// Re-exports de constantes de roles (compartilhados com plano-aula)
// ============================================
export {
  ANALISTA_ROLES,
  COORDENADORA_ROLES,
  GESTAO_ROLES,
  PROFESSORA_ROLES,
  isAnalista,
  isCoordenadora,
  isGestao,
  isProfessora,
  COORDENADORA_STAGE_MAP,
  getSegmentosPermitidos,
} from "../../plano-aula/dto/plano-aula.dto";

// ============================================
// Schemas de Validação (Zod)
// ============================================

/**
 * Schema para criar/buscar prova
 * Professora cria prova para uma turma/ciclo
 */
export const createProvaSchema = z.object({
  turmaId: z.string().uuid("turmaId deve ser um UUID válido"),
  cicloId: z.string().uuid("cicloId deve ser um UUID válido"),
});

export type CreateProvaDto = z.infer<typeof createProvaSchema>;

/**
 * Schema para devolver prova para ajustes
 * Coordenadora pode devolver para PROFESSORA ou ANALISTA
 */
export const devolverProvaSchema = z.object({
  motivo: z.string().optional(),
  destino: z.enum(["PROFESSORA", "ANALISTA"]).optional(),
});

export type DevolverProvaDto = z.infer<typeof devolverProvaSchema>;

/**
 * Schema para listagem de provas pendentes (query params)
 */
export const listProvasQuerySchema = z.object({
  cicloId: z.string().uuid().optional(),
  status: z
    .enum([
      "RASCUNHO",
      "AGUARDANDO_ANALISTA",
      "AGUARDANDO_COORDENADORA",
      "DEVOLVIDO_ANALISTA",
      "DEVOLVIDO_COORDENADORA",
      "REVISAO_ANALISTA",
      "APROVADO",
      "RECUPERADO",
    ])
    .optional(),
});

export type ListProvasQueryDto = z.infer<typeof listProvasQuerySchema>;

/**
 * Schema para filtro do dashboard de provas
 */
export const dashboardProvasQuerySchema = z.object({
  unitId: z.string().uuid().optional(),
  cicloId: z.string().uuid().optional(),
});

export type DashboardProvasQueryDto = z.infer<typeof dashboardProvasQuerySchema>;

// ============================================
// Listagem de Provas para Gestão
// ============================================

/**
 * Schema para listagem de provas da gestão (com paginação)
 * GET /prova/gestao/listar
 */
export const listarProvasGestaoSchema = z.object({
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
  cicloId: z.string().uuid().optional(),
  segmentoId: z.string().optional(),
  professora: z.string().optional(),
  dataInicio: z.string().datetime().optional(),
  dataFim: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type ListarProvasGestaoDto = z.infer<typeof listarProvasGestaoSchema>;

/**
 * Mapeamento de status da URL para status do banco
 */
export const PROVA_STATUS_URL_MAP: Record<string, string[]> = {
  todos: [],
  rascunho: ["RASCUNHO", "RECUPERADO"],
  "aguardando-analise": ["AGUARDANDO_ANALISTA", "REVISAO_ANALISTA"],
  "aguardando-aprovacao": ["AGUARDANDO_COORDENADORA"],
  devolvidos: ["DEVOLVIDO_ANALISTA", "DEVOLVIDO_COORDENADORA"],
  aprovados: ["APROVADO"],
};
