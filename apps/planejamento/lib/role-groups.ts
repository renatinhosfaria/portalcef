/**
 * Role Groups for RBAC Routing
 * Defines which roles have access to which dashboards in the Planejamento module
 */

import type { RoleType } from "@essencia/shared/roles";

/**
 * GRUPO 1: Criadores de Planejamento
 * Roles that create and manage their own plannings
 * Dashboard: ProfessoraDashboard
 */
export const CREATOR_ROLES: RoleType[] = ["professora", "auxiliar_sala"];

/**
 * GRUPO 2: Revisores (Regência)
 * Roles that review and approve/reject plannings
 * Dashboard: Redirect to /regencia
 * NOTE: gerente_unidade e gerente_financeiro agora têm acesso total ao planejamento
 */
export const REVIEWER_ROLES: RoleType[] = [
  "coordenadora_bercario",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_medio",
  "coordenadora_geral",
  "analista_pedagogico",
  "gerente_unidade", // Movido de MANAGER_ROLES - acesso total ao planejamento
  "gerente_financeiro", // Movido de MANAGER_ROLES - acesso total ao planejamento
];

/**
 * GRUPO 3: Gestores (Painel de Gestão)
 * Roles with high-level management access to see KPIs and overview
 * Dashboard: GestaoPanel
 */
export const MANAGER_ROLES: RoleType[] = ["diretora_geral", "master"];

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

export function isReviewerRole(role: string): boolean {
  return REVIEWER_ROLES.includes(role as RoleType);
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
  | "regencia"
  | "gestao"
  | "no-access"
  | "unknown";

export function getDashboardForRole(role: string): DashboardType {
  if (isCreatorRole(role)) return "professora";
  if (isReviewerRole(role)) return "regencia";
  if (isManagerRole(role)) return "gestao";
  if (isNoAccessRole(role)) return "no-access";
  return "unknown";
}
