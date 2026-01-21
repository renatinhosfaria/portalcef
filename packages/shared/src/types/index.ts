// User role type
export type UserRole =
  | "master"
  | "diretora_geral"
  | "gerente_unidade"
  | "gerente_financeiro"
  | "coordenadora_geral"
  | "coordenadora_bercario"
  | "coordenadora_infantil"
  | "coordenadora_fundamental_i"
  | "coordenadora_fundamental_ii"
  | "coordenadora_medio"
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
  coordenadora_bercario: "Coordenadora Bercario",
  coordenadora_infantil: "Coordenadora Infantil",
  coordenadora_fundamental_i: "Coordenadora Fundamental I",
  coordenadora_fundamental_ii: "Coordenadora Fundamental II",
  coordenadora_medio: "Coordenadora Medio",
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

// Roles that require a unit (all except master and diretora_geral)
export const unitRequiredRoles: UserRole[] = [
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_geral",
  "coordenadora_bercario",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_medio",
  "analista_pedagogico",
  "professora",
  "auxiliar_administrativo",
  "auxiliar_sala",
];

// Roles that require a stage (pedagogical stage-scoped roles)
export const stageRequiredRoles: UserRole[] = [
  "coordenadora_bercario",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_medio",
  "professora",
  "auxiliar_sala",
];

// Roles that require a school (all except master)
export const schoolRequiredRoles: UserRole[] = [
  "diretora_geral",
  ...unitRequiredRoles,
];

// Education stage codes
export type EducationStageCode =
  | "BERCARIO"
  | "INFANTIL"
  | "FUNDAMENTAL_I"
  | "FUNDAMENTAL_II"
  | "MEDIO";

export const educationStageLabels: Record<EducationStageCode, string> = {
  BERCARIO: "Bercario",
  INFANTIL: "Infantil",
  FUNDAMENTAL_I: "Fundamental I",
  FUNDAMENTAL_II: "Fundamental II",
  MEDIO: "Medio",
};

export interface EducationStage {
  id: string;
  code: EducationStageCode;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

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

// Unit Stage junction table (etapas por unidade)
export interface UnitStage {
  id: string;
  unitId: string;
  stageId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Unit with stages relationship
export interface UnitWithStages extends Unit {
  stages: EducationStage[];
}

// Turma types
export interface Turma {
  id: string;
  unitId: string;
  stageId: string;
  professoraId?: string | null;
  name: string;
  code: string;
  year: number;
  shift?: string | null;
  capacity?: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TurmaWithStage extends Turma {
  stage: EducationStage;
  unit: Unit;
}

// Role Group types
export type RoleGroupCode =
  | "ADMIN"
  | "CLIENTES"
  | "ESCOLA_ADMINISTRATIVO"
  | "ESCOLA_PEDAGOGICO";

export interface RoleGroup {
  id: string;
  code: RoleGroupCode;
  name: string;
  description: string | null;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleGroupMapping {
  id: string;
  role: UserRole;
  groupId: string;
  displayOrder: number;
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
  stageId: string | null; // null for non stage-scoped roles
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
  stageId: string | null; // null for non stage-scoped roles
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

// Calendar types
export type { EventTypeConfig, MonthlyStats } from "./calendar";
export {
  eventTypeConfig,
  monthlyStats2026,
  TOTAL_SCHOOL_DAYS_2026,
} from "./calendar";

export * from "./turma-extended";

// Shop types (CEF Shop module)
export * from "./shop";

// Histórico types (Plano Aula Histórico)
export * from "./historico";

// Tarefas types (Task Management)
export * from "./tarefas";
