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
