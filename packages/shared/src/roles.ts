// Role hierarchy: lower number = higher permission level
export const ROLE_HIERARCHY: Record<string, number> = {
  master: 0,
  diretora_geral: 1,
  gerente_unidade: 2,
  gerente_financeiro: 3,
  coordenadora_geral: 4,
  coordenadora_bercario: 5,
  coordenadora_infantil: 6,
  coordenadora_fundamental_i: 7,
  coordenadora_fundamental_ii: 8,
  coordenadora_medio: 9,
  analista_pedagogico: 10,
  professora: 11,
  auxiliar_administrativo: 12,
  auxiliar_sala: 13,
};

export type RoleType = keyof typeof ROLE_HIERARCHY;

/**
 * Verifica se currentRole pode gerenciar targetRole
 * (currentRole tem privilégio maior = número menor)
 * @returns true se currentRole tem maior privilégio que targetRole
 */
export function canManageRole(currentRole: string, targetRole: string): boolean {
  const currentLevel = ROLE_HIERARCHY[currentRole] ?? 999;
  const targetLevel = ROLE_HIERARCHY[targetRole] ?? 999;
  return currentLevel < targetLevel; // Apenas MENOR privilégio
}

/**
 * Verifica se currentRole pode visualizar targetRole
 * (pode ver usuários de igual ou menor privilégio)
 * @returns true se currentRole pode visualizar targetRole
 */
export function canViewRole(currentRole: string, targetRole: string): boolean {
  const currentLevel = ROLE_HIERARCHY[currentRole] ?? 999;
  const targetLevel = ROLE_HIERARCHY[targetRole] ?? 999;
  return currentLevel <= targetLevel; // Igual ou menor privilégio
}

/**
 * Retorna lista de roles que currentRole pode gerenciar
 * (roles com menor privilégio = número maior)
 * @returns array de roles gerenciáveis
 */
export function getManageableRoles(currentRole: string): string[] {
  const currentLevel = ROLE_HIERARCHY[currentRole] ?? 999;
  return Object.entries(ROLE_HIERARCHY)
    .filter(([_, level]) => level > currentLevel)
    .map(([role]) => role);
}
