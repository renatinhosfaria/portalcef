/**
 * RBAC Permissions Helpers
 *
 * Constantes e funções para controle de acesso baseado em roles.
 * Usado para determinar permissões e visibilidade de dados.
 *
 * @module lib/auth/permissions
 */

import type { EducationStageCode, UserRole } from "@essencia/shared/types";

// ============================================================================
// Role Groups
// ============================================================================

/**
 * Roles que acessam apenas seus próprios planejamentos
 */
export const PROFESSOR_ROLES: readonly UserRole[] = [
  "professora",
  "auxiliar_sala",
] as const;

/**
 * Roles de coordenação que participam do fluxo de aprovação
 */
export const COORDENACAO_ROLES: readonly UserRole[] = [
  "coordenadora_bercario",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_medio",
] as const;

/**
 * Roles com visão global de todas as etapas
 */
export const DIRECAO_ROLES: readonly UserRole[] = [
  "master",
  "diretora_geral",
  "coordenadora_geral",
] as const;

/**
 * Roles com acesso de gestão ao planejamento da unidade
 * Podem visualizar todas as etapas e aprovar/rejeitar planejamentos
 */
export const GESTAO_ROLES: readonly UserRole[] = [
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_geral",
  ...COORDENACAO_ROLES,
] as const;

/**
 * Todos os roles que podem acessar o módulo de planejamento
 */
export const PLANEJAMENTO_ALLOWED_ROLES: readonly UserRole[] = [
  ...PROFESSOR_ROLES,
  ...COORDENACAO_ROLES,
  ...DIRECAO_ROLES,
  ...GESTAO_ROLES,
  "analista_pedagogico",
] as const;

// ============================================================================
// Stage Types
// ============================================================================

export type EducationalStage = EducationStageCode | "ALL";

// ============================================================================
// Constants
// ============================================================================

export const SCHOOL_STAGE_PREFIXES = {
  BERCARIO: "BERC-",
  INFANTIL: "INF-",
  FUNDAMENTAL_I: "FUND-I-",
  FUNDAMENTAL_II: "FUND-II-",
  MEDIO: "MED-",
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
 * Verifica se o role é de coordenação pedagógica
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
 * Verifica se o role tem acesso de gestão ao planejamento da unidade
 */
export function isGestao(role: UserRole): boolean {
  return GESTAO_ROLES.includes(role);
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
 * Determina a etapa educacional que o usuário pode acessar
 *
 * - Coordenadoras, assim como a gerente de unidade, acessam todas as etapas
 *   da unidade.
 * - Todos os outros roles com permissão → ALL
 *
 * @param _role - Role do usuário
 * @returns Etapa educacional ou ALL para acesso total
 */
export function getUserSegment(_role: UserRole): EducationalStage {
  return "ALL";
}

/**
 * Retorna o prefixo de turmaId para filtrar por etapa
 *
 * @param segment - Etapa educacional
 * @returns Prefixo SQL LIKE ou null para sem filtro
 */
export function getSegmentPrefix(segment: EducationalStage): string | null {
  switch (segment) {
    case "BERCARIO":
      return `${SCHOOL_STAGE_PREFIXES.BERCARIO}%`;
    case "INFANTIL":
      return `${SCHOOL_STAGE_PREFIXES.INFANTIL}%`;
    case "FUNDAMENTAL_I":
      return `${SCHOOL_STAGE_PREFIXES.FUNDAMENTAL_I}%`;
    case "FUNDAMENTAL_II":
      return `${SCHOOL_STAGE_PREFIXES.FUNDAMENTAL_II}%`;
    case "MEDIO":
      return `${SCHOOL_STAGE_PREFIXES.MEDIO}%`;
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
 * - Coordenação: planejamentos da unidade (read-only por padrão)
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
 * Inclui coordenação, direção e gestão administrativa
 */
export function canApprove(role: UserRole): boolean {
  return isCoordenacao(role) || isDirecao(role) || isGestao(role);
}

/**
 * Verifica se o usuário pode ver estatísticas globais
 */
export function canViewGlobalStats(role: UserRole): boolean {
  return isDirecao(role);
}
