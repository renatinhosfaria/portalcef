/**
 * RBAC Permissions Helpers
 *
 * Constantes e funções para controle de acesso baseado em roles.
 * Usado para determinar permissões e visibilidade de dados.
 *
 * @module lib/auth/permissions
 */

import type { UserRole } from "@essencia/shared/types";

// ============================================================================
// Role Groups
// ============================================================================

/**
 * Roles que acessam apenas seus próprios planejamentos
 */
export const PROFESSOR_ROLES: readonly UserRole[] = ["professora"] as const;

/**
 * Roles de coordenação com visão por segmento educacional
 */
export const COORDENACAO_ROLES: readonly UserRole[] = [
  "coordenadora_infantil",
  "coordenadora_fundamental",
] as const;

/**
 * Roles com visão global de todos os segmentos
 */
export const DIRECAO_ROLES: readonly UserRole[] = [
  "master",
  "diretora_geral",
  "coordenadora_geral",
] as const;

/**
 * Todos os roles que podem acessar o módulo de planejamento
 */
export const PLANEJAMENTO_ALLOWED_ROLES: readonly UserRole[] = [
  ...PROFESSOR_ROLES,
  ...COORDENACAO_ROLES,
  ...DIRECAO_ROLES,
  "analista_pedagogico",
] as const;

// ============================================================================
// Segment Types
// ============================================================================

export type EducationalSegment = "INFANTIL" | "FUNDAMENTAL" | "ALL";

// ============================================================================
// Constants
// ============================================================================

export const SCHOOL_SEGMENT_PREFIXES = {
  INFANTIL: "INF-",
  FUNDAMENTAL: "FUND-",
} as const;

// ============================================================================
// Role Check Functions
// ============================================================================

/**
 * Verifica se o role é de professor (acesso individual)
 */
export function isProfessor(role: UserRole): boolean {
  return PROFESSOR_ROLES.includes(role);
}

/**
 * Verifica se o role é de coordenação (acesso por segmento)
 */
export function isCoordenacao(role: UserRole): boolean {
  return COORDENACAO_ROLES.includes(role);
}

/**
 * Verifica se o role é de direção (acesso global)
 */
export function isDirecao(role: UserRole): boolean {
  return DIRECAO_ROLES.includes(role);
}

/**
 * Verifica se o role pode acessar o módulo de planejamento
 */
export function canAccessPlanejamento(role: UserRole): boolean {
  return PLANEJAMENTO_ALLOWED_ROLES.includes(role);
}

// ============================================================================
// Segment Functions
// ============================================================================

/**
 * Determina o segmento educacional que o usuário pode acessar
 *
 * - coordenadora_infantil → INFANTIL (turmas INF-*)
 * - coordenadora_fundamental → FUNDAMENTAL (turmas FUND-*)
 * - Todos os outros roles com permissão → ALL
 *
 * @param role - Role do usuário
 * @returns Segmento educacional ou ALL para acesso total
 */
export function getUserSegment(role: UserRole): EducationalSegment {
  switch (role) {
    case "coordenadora_infantil":
      return "INFANTIL";
    case "coordenadora_fundamental":
      return "FUNDAMENTAL";
    default:
      return "ALL";
  }
}

/**
 * Retorna o prefixo de turmaId para filtrar por segmento
 *
 * @param segment - Segmento educacional
 * @returns Prefixo SQL LIKE ou null para sem filtro
 */
export function getSegmentPrefix(segment: EducationalSegment): string | null {
  switch (segment) {
    case "INFANTIL":
      return `${SCHOOL_SEGMENT_PREFIXES.INFANTIL}%`;
    case "FUNDAMENTAL":
      return `${SCHOOL_SEGMENT_PREFIXES.FUNDAMENTAL}%`;
    case "ALL":
      return null;
  }
}

// ============================================================================
// Permission Check Functions
// ============================================================================

/**
 * Verifica se o usuário pode editar um planejamento específico
 *
 * - Professora: apenas seus próprios planejamentos
 * - Coordenação: planejamentos do seu segmento (read-only por padrão)
 * - Direção: todos os planejamentos (read-only por padrão)
 *
 * @param userRole - Role do usuário
 * @param userId - ID do usuário
 * @param planningOwnerId - ID do dono do planejamento
 * @returns true se pode editar
 */
export function canEditPlanning(
  userRole: UserRole,
  userId: string,
  planningOwnerId: string,
): boolean {
  // Professora só pode editar seus próprios planejamentos
  if (isProfessor(userRole)) {
    return userId === planningOwnerId;
  }

  // Coordenação e Direção não editam planejamentos (apenas visualizam e aprovam)
  // Para aprovar/rejeitar, use permissões específicas
  return false;
}

/**
 * Verifica se o usuário pode aprovar/rejeitar planejamentos
 */
export function canApprove(role: UserRole): boolean {
  return isCoordenacao(role) || isDirecao(role);
}

/**
 * Verifica se o usuário pode ver estatísticas globais
 */
export function canViewGlobalStats(role: UserRole): boolean {
  return isDirecao(role);
}
