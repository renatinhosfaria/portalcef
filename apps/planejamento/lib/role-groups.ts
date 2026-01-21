/**
 * Role Groups for RBAC Routing
 * Defines which roles have access to which dashboards in the Planejamento module
 */

import type { RoleType } from "@essencia/shared/roles";

/**
 * GRUPO 1: Criadores de Planejamento
 * Roles that create and manage their own plannings
 * Dashboard: /planejamentos -> /plano-aula/[quinzenaId]
 */
export const CREATOR_ROLES: RoleType[] = ["professora", "auxiliar_sala"];

/**
 * GRUPO 2: Analista Pedagogica
 * Role that reviews plannings before coordinators
 * Dashboard: /analise
 */
export const ANALYST_ROLES: RoleType[] = ["analista_pedagogico"];

/**
 * GRUPO 3: Coordenadoras
 * Roles that approve/reject plannings after analyst review
 * Dashboard: /coordenacao
 */
export const COORDINATOR_ROLES: RoleType[] = [
  "coordenadora_bercario",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_medio",
  "coordenadora_geral",
];

/**
 * GRUPO 4: Gestores (Painel de Gestão)
 * Roles with high-level management access to see KPIs and overview
 * Dashboard: /gestao
 */
export const MANAGER_ROLES: RoleType[] = [
  "diretora_geral",
  "master",
  "gerente_unidade",
  "gerente_financeiro",
];

/**
 * GRUPO 5: Sem Acesso ao Módulo
 * Roles that should be redirected to home
 */
export const NO_ACCESS_ROLES: RoleType[] = ["auxiliar_administrativo"];

/**
 * Helper functions to check role membership
 */
export function isCreatorRole(role: string): boolean {
  return CREATOR_ROLES.includes(role as RoleType);
}

export function isAnalystRole(role: string): boolean {
  return ANALYST_ROLES.includes(role as RoleType);
}

export function isCoordinatorRole(role: string): boolean {
  return COORDINATOR_ROLES.includes(role as RoleType);
}

export function isManagerRole(role: string): boolean {
  return MANAGER_ROLES.includes(role as RoleType);
}

export function isNoAccessRole(role: string): boolean {
  return NO_ACCESS_ROLES.includes(role as RoleType);
}

/**
 * Determines which dashboard a role should see
 */
export type DashboardType =
  | "professora"
  | "analise"
  | "coordenacao"
  | "gestao"
  | "no-access"
  | "unknown";

export function getDashboardForRole(role: string): DashboardType {
  if (isCreatorRole(role)) return "professora";
  if (isAnalystRole(role)) return "analise";
  if (isCoordinatorRole(role)) return "coordenacao";
  if (isManagerRole(role)) return "gestao";
  if (isNoAccessRole(role)) return "no-access";
  return "unknown";
}
