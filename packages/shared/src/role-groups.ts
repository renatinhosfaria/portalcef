import type { UserRole } from "./types/index.js";

/**
 * Role Group Codes
 * Define os grupos organizacionais para os roles do sistema
 */
export const roleGroupCodes = [
  "ADMIN",
  "CLIENTES",
  "ESCOLA_ADMINISTRATIVO",
  "ESCOLA_PEDAGOGICO",
] as const;
export type RoleGroupCode = (typeof roleGroupCodes)[number];

/**
 * Labels para os grupos de roles
 */
export const roleGroupLabels: Record<RoleGroupCode, string> = {
  ADMIN: "Administracao",
  CLIENTES: "Clientes",
  ESCOLA_ADMINISTRATIVO: "Setor Administrativo",
  ESCOLA_PEDAGOGICO: "Setor Pedagogico",
};

/**
 * Descricoes dos grupos de roles
 */
export const roleGroupDescriptions: Record<RoleGroupCode, string> = {
  ADMIN: "Acesso global ao sistema",
  CLIENTES: "Diretores e proprietarios",
  ESCOLA_ADMINISTRATIVO: "Gestao administrativa da unidade",
  ESCOLA_PEDAGOGICO: "Equipe pedagogica da unidade",
};

/**
 * Mapeamento role -> grupo (compile-time constant)
 * Sincronizado com a tabela role_group_mappings no banco
 */
export const ROLE_TO_GROUP: Record<UserRole, RoleGroupCode> = {
  master: "ADMIN",
  diretora_geral: "CLIENTES",
  gerente_unidade: "ESCOLA_ADMINISTRATIVO",
  gerente_financeiro: "ESCOLA_ADMINISTRATIVO",
  auxiliar_administrativo: "ESCOLA_ADMINISTRATIVO",
  coordenadora_geral: "ESCOLA_PEDAGOGICO",
  coordenadora_bercario: "ESCOLA_PEDAGOGICO",
  coordenadora_infantil: "ESCOLA_PEDAGOGICO",
  coordenadora_fundamental_i: "ESCOLA_PEDAGOGICO",
  coordenadora_fundamental_ii: "ESCOLA_PEDAGOGICO",
  coordenadora_medio: "ESCOLA_PEDAGOGICO",
  analista_pedagogico: "ESCOLA_PEDAGOGICO",
  professora: "ESCOLA_PEDAGOGICO",
  auxiliar_sala: "ESCOLA_PEDAGOGICO",
};

/**
 * Roles por grupo
 */
export const ROLES_BY_GROUP: Record<RoleGroupCode, UserRole[]> = {
  ADMIN: ["master"],
  CLIENTES: ["diretora_geral"],
  ESCOLA_ADMINISTRATIVO: [
    "gerente_unidade",
    "gerente_financeiro",
    "auxiliar_administrativo",
  ],
  ESCOLA_PEDAGOGICO: [
    "coordenadora_geral",
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_fundamental_i",
    "coordenadora_fundamental_ii",
    "coordenadora_medio",
    "analista_pedagogico",
    "professora",
    "auxiliar_sala",
  ],
};

/**
 * Roles com acesso total ao modulo de planejamento
 * Podem visualizar todos os planejamentos do seu escopo e aprovar/reprovar
 */
export const fullPlanejamentoAccessRoles: UserRole[] = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_geral",
  "coordenadora_bercario",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_medio",
  "analista_pedagogico",
];

/**
 * Roles com acesso total a todas as etapas da sua unidade
 * Nao sao restringidos por stageId
 */
export const fullUnitAccessRoles: UserRole[] = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_geral",
  "analista_pedagogico",
];

// ============================================
// Helper Functions
// ============================================

/**
 * Retorna o grupo do role
 */
export function getRoleGroup(role: UserRole): RoleGroupCode {
  return ROLE_TO_GROUP[role];
}

/**
 * Verifica se o role pertence ao grupo Admin
 */
export function isAdminGroup(role: UserRole): boolean {
  return getRoleGroup(role) === "ADMIN";
}

/**
 * Verifica se o role pertence ao grupo Clientes
 */
export function isClientesGroup(role: UserRole): boolean {
  return getRoleGroup(role) === "CLIENTES";
}

/**
 * Verifica se o role pertence ao Setor Administrativo
 */
export function isAdministrativoGroup(role: UserRole): boolean {
  return getRoleGroup(role) === "ESCOLA_ADMINISTRATIVO";
}

/**
 * Verifica se o role pertence ao Setor Pedagogico
 */
export function isPedagogicoGroup(role: UserRole): boolean {
  return getRoleGroup(role) === "ESCOLA_PEDAGOGICO";
}

/**
 * Verifica se o role tem acesso total ao modulo de planejamento
 */
export function hasFullPlanejamentoAccess(role: UserRole): boolean {
  return fullPlanejamentoAccessRoles.includes(role);
}

/**
 * Verifica se o role tem acesso total a todas as etapas da unidade
 */
export function hasFullUnitAccess(role: UserRole): boolean {
  return fullUnitAccessRoles.includes(role);
}

/**
 * Retorna todos os roles de um grupo
 */
export function getRolesByGroup(group: RoleGroupCode): UserRole[] {
  return ROLES_BY_GROUP[group];
}
