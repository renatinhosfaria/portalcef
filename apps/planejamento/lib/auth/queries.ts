/**
 * RBAC Query Builders for Drizzle ORM
 *
 * Funções para construir cláusulas WHERE que filtram dados
 * baseado no role e permissões do usuário.
 *
 * @module lib/auth/queries
 */

import type { UserRole } from "@essencia/shared/types";

import {
  getUserSegment,
  isCoordenacao,
  isProfessor,
  SCHOOL_SEGMENT_PREFIXES,
} from "./permissions";

export interface UserContext {
  id: string;
  role: UserRole;
}

export function canAccessPlanning(
  user: UserContext,
  planning: { userId: string; turmaId: string },
): boolean {
  // Professora só acessa seus próprios planejamentos
  if (isProfessor(user.role)) {
    return planning.userId === user.id;
  }

  // Coordenação: verificar segmento
  if (isCoordenacao(user.role)) {
    const segment = getUserSegment(user.role);

    if (segment === "INFANTIL") {
      return planning.turmaId.startsWith(SCHOOL_SEGMENT_PREFIXES.INFANTIL);
    }

    if (segment === "FUNDAMENTAL") {
      return planning.turmaId.startsWith(SCHOOL_SEGMENT_PREFIXES.FUNDAMENTAL);
    }
  }

  // Direção: acesso total
  return true;
}

/**
 * Retorna claúsula WHERE abstrata ou objeto de filtro para query de planejamentos
 * NOTE: Retornando placeholder por enquanto para passar no lint/testes,
 * já que não temos Drizzle configurado neste arquivo ainda.
 */
export function getPlanningsWhereClause(user: UserContext) {
  if (isProfessor(user.role)) {
    return { userId: user.id };
  }

  if (isCoordenacao(user.role)) {
    const segment = getUserSegment(user.role);
    if (segment === "INFANTIL") {
      return { turmaId: { startsWith: SCHOOL_SEGMENT_PREFIXES.INFANTIL } };
    }
    if (segment === "FUNDAMENTAL") {
      return { turmaId: { startsWith: SCHOOL_SEGMENT_PREFIXES.FUNDAMENTAL } };
    }
  }

  // Direção: sem filtro (undefined)
  return undefined;
}

/**
 * Extrai o segmento de um turmaId
 *
 * @param turmaId - ID da turma (ex: "INF-2A-2024")
 * @returns Segmento ou null se formato inválido
 */
export function extractSegmentFromTurmaId(
  turmaId: string,
): "INFANTIL" | "FUNDAMENTAL" | null {
  if (turmaId.startsWith(SCHOOL_SEGMENT_PREFIXES.INFANTIL)) return "INFANTIL";
  if (turmaId.startsWith(SCHOOL_SEGMENT_PREFIXES.FUNDAMENTAL))
    return "FUNDAMENTAL";
  return null;
}
