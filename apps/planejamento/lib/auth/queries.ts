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
  SCHOOL_STAGE_PREFIXES,
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

    if (segment === "BERCARIO") {
      return planning.turmaId.startsWith(SCHOOL_STAGE_PREFIXES.BERCARIO);
    }

    if (segment === "INFANTIL") {
      return planning.turmaId.startsWith(SCHOOL_STAGE_PREFIXES.INFANTIL);
    }

    if (segment === "FUNDAMENTAL_I") {
      return planning.turmaId.startsWith(SCHOOL_STAGE_PREFIXES.FUNDAMENTAL_I);
    }

    if (segment === "FUNDAMENTAL_II") {
      return planning.turmaId.startsWith(SCHOOL_STAGE_PREFIXES.FUNDAMENTAL_II);
    }

    if (segment === "MEDIO") {
      return planning.turmaId.startsWith(SCHOOL_STAGE_PREFIXES.MEDIO);
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
    if (segment === "BERCARIO") {
      return { turmaId: { startsWith: SCHOOL_STAGE_PREFIXES.BERCARIO } };
    }
    if (segment === "INFANTIL") {
      return { turmaId: { startsWith: SCHOOL_STAGE_PREFIXES.INFANTIL } };
    }
    if (segment === "FUNDAMENTAL_I") {
      return { turmaId: { startsWith: SCHOOL_STAGE_PREFIXES.FUNDAMENTAL_I } };
    }
    if (segment === "FUNDAMENTAL_II") {
      return { turmaId: { startsWith: SCHOOL_STAGE_PREFIXES.FUNDAMENTAL_II } };
    }
    if (segment === "MEDIO") {
      return { turmaId: { startsWith: SCHOOL_STAGE_PREFIXES.MEDIO } };
    }
  }

  // Direção: sem filtro (undefined)
  return undefined;
}

/**
 * Extrai a etapa de um turmaId
 *
 * @param turmaId - ID da turma (ex: "INF-2A-2024")
 * @returns Etapa ou null se formato inválido
 */
export function extractSegmentFromTurmaId(
  turmaId: string,
):
  | "BERCARIO"
  | "INFANTIL"
  | "FUNDAMENTAL_I"
  | "FUNDAMENTAL_II"
  | "MEDIO"
  | null {
  if (turmaId.startsWith(SCHOOL_STAGE_PREFIXES.BERCARIO)) return "BERCARIO";
  if (turmaId.startsWith(SCHOOL_STAGE_PREFIXES.INFANTIL)) return "INFANTIL";
  if (turmaId.startsWith(SCHOOL_STAGE_PREFIXES.FUNDAMENTAL_I))
    return "FUNDAMENTAL_I";
  if (turmaId.startsWith(SCHOOL_STAGE_PREFIXES.FUNDAMENTAL_II))
    return "FUNDAMENTAL_II";
  if (turmaId.startsWith(SCHOOL_STAGE_PREFIXES.MEDIO)) return "MEDIO";
  return null;
}
