import { z } from "zod";

// User role schema
export const userRoleSchema = z.enum([
  "master",
  "diretora_geral",
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_geral",
  "coordenadora_infantil",
  "coordenadora_fundamental",
  "analista_pedagogico",
  "professora",
  "auxiliar_administrativo",
  "auxiliar_sala",
]);

// Roles that require a unit
const unitRequiredRoles = [
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_geral",
  "coordenadora_infantil",
  "coordenadora_fundamental",
  "analista_pedagogico",
  "professora",
  "auxiliar_administrativo",
  "auxiliar_sala",
] as const;

// School schemas
export const schoolSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(200),
  code: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createSchoolSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(200),
  code: z
    .string()
    .min(2)
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      "Codigo deve conter apenas letras minusculas, numeros e hifens",
    ),
});

export const updateSchoolSchema = createSchoolSchema.partial();

// Unit schemas
export const unitSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string().min(2).max(200),
  code: z.string().min(2).max(50),
  address: z.string().max(500).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createUnitSchema = z.object({
  schoolId: z.string().uuid("Escola invalida"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(200),
  code: z
    .string()
    .min(2)
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      "Codigo deve conter apenas letras minusculas, numeros e hifens",
    ),
  address: z.string().max(500).optional(),
});

export const updateUnitSchema = createUnitSchema
  .omit({ schoolId: true })
  .partial();

// User schemas
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: userRoleSchema,
  schoolId: z.string().uuid().nullable(),
  unitId: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

// Base user data schema (before refinement)
const baseUserDataSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  role: userRoleSchema,
  schoolId: z.string().uuid("Escola invalida").nullable(),
  unitId: z.string().uuid("Unidade invalida").nullable(),
});

// Validation function for role/scope consistency
const validateRoleScope = (
  data: z.infer<typeof baseUserDataSchema>,
): boolean => {
  // master: both null
  if (data.role === "master") {
    return data.schoolId === null && data.unitId === null;
  }
  // diretora_geral: schoolId required, unitId null
  if (data.role === "diretora_geral") {
    return data.schoolId !== null && data.unitId === null;
  }
  // unit-scoped roles: both required
  if (
    unitRequiredRoles.includes(data.role as (typeof unitRequiredRoles)[number])
  ) {
    return data.schoolId !== null && data.unitId !== null;
  }
  return true;
};

export const registerSchema = baseUserDataSchema.refine(validateRoleScope, {
  message: "schoolId/unitId invalidos para o role selecionado",
});

export const createUserSchema = baseUserDataSchema.refine(validateRoleScope, {
  message: "schoolId/unitId invalidos para o role selecionado",
});

export const updateUserSchema = z.object({
  email: z.string().email("Email invalido").optional(),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").optional(),
  role: userRoleSchema.optional(),
  schoolId: z.string().uuid("Escola invalida").nullable().optional(),
  unitId: z.string().uuid("Unidade invalida").nullable().optional(),
});

// Pagination schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Export types from schemas
export type UserRole = z.infer<typeof userRoleSchema>;
export type School = z.infer<typeof schoolSchema>;
export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
export type User = z.infer<typeof userSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
