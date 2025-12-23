// User role type
export type UserRole =
  | "master"
  | "diretora_geral"
  | "gerente_unidade"
  | "gerente_financeiro"
  | "coordenadora_geral"
  | "coordenadora_infantil"
  | "coordenadora_fundamental"
  | "analista_pedagogico"
  | "professora"
  | "auxiliar_administrativo"
  | "auxiliar_sala";

// Role labels for display
export const userRoleLabels: Record<UserRole, string> = {
  master: "Master",
  diretora_geral: "Diretora Geral",
  gerente_unidade: "Gerente de Unidade",
  gerente_financeiro: "Gerente Financeiro",
  coordenadora_geral: "Coordenadora Geral",
  coordenadora_infantil: "Coordenadora Infantil",
  coordenadora_fundamental: "Coordenadora Fundamental",
  analista_pedagogico: "Analista Pedagogico",
  professora: "Professora",
  auxiliar_administrativo: "Auxiliar Administrativo",
  auxiliar_sala: "Auxiliar de Sala",
};

// Role hierarchy (lower number = higher permission level)
export const userRoleHierarchy: Record<UserRole, number> = {
  master: 0,
  diretora_geral: 1,
  gerente_unidade: 2,
  gerente_financeiro: 3,
  coordenadora_geral: 4,
  coordenadora_infantil: 5,
  coordenadora_fundamental: 6,
  analista_pedagogico: 7,
  professora: 8,
  auxiliar_administrativo: 9,
  auxiliar_sala: 10,
};

// Roles that require a unit (all except master and diretora_geral)
export const unitRequiredRoles: UserRole[] = [
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_geral",
  "coordenadora_infantil",
  "coordenadora_fundamental",
  "analista_pedagogico",
  "professora",
  "auxiliar_administrativo",
  "auxiliar_sala",
];

// Roles that require a school (all except master)
export const schoolRequiredRoles: UserRole[] = [
  "diretora_geral",
  ...unitRequiredRoles,
];

// School types
export interface School {
  id: string;
  name: string;
  code: string;
  createdAt: Date;
  updatedAt: Date;
}

// Unit types
export interface Unit {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  address?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  schoolId: string | null; // null for master
  unitId: string | null; // null for master and diretora_geral
  createdAt: Date;
  updatedAt: Date;
}

// User with tenant info
export interface UserWithTenant extends User {
  school: School | null;
  unit: Unit | null;
}

// Session types
export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

// Tenant context for authenticated user
export interface TenantContext {
  schoolId: string | null; // null for master
  unitId: string | null; // null for master and diretora_geral
  role: UserRole;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Pagination types
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
