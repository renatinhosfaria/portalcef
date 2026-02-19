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
 * Role that reviews and approves plannings (aprovação final)
 * Dashboard: /analise
 */
export const ANALYST_ROLES: RoleType[] = ["analista_pedagogico"];

/**
 * GRUPO 3: Gestores (Painel de Gestão)
 * Roles with high-level management access to see KPIs and overview
 * Includes coordenadoras, diretora, master, e gerentes
 * Dashboard: /gestao
 */
export const MANAGER_ROLES: RoleType[] = [
  "diretora_geral",
  "master",
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_bercario",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_medio",
  "coordenadora_geral",
];

/**
 * GRUPO 4: Sem Acesso ao Módulo
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
  | "gestao"
  | "no-access"
  | "unknown";

export function getDashboardForRole(role: string): DashboardType {
  if (isCreatorRole(role)) return "professora";
  if (isAnalystRole(role)) return "analise";
  if (isManagerRole(role)) return "gestao";
  if (isNoAccessRole(role)) return "no-access";
  return "unknown";
}
