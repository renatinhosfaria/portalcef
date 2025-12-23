import { z } from "zod";
// User role schema
export const userRoleSchema = z.enum([
    "diretora",
    "gerente",
    "supervisora",
    "coordenadora",
    "professora",
    "auxiliar_sala",
    "auxiliar_administrativo",
]);
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
        .regex(/^[a-z0-9-]+$/, "Codigo deve conter apenas letras minusculas, numeros e hifens"),
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
        .regex(/^[a-z0-9-]+$/, "Codigo deve conter apenas letras minusculas, numeros e hifens"),
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
    schoolId: z.string().uuid(),
    unitId: z.string().uuid(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});
// Auth schemas
export const loginSchema = z.object({
    email: z.string().email("Email invalido"),
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});
export const registerSchema = z.object({
    email: z.string().email("Email invalido"),
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    role: userRoleSchema,
    schoolId: z.string().uuid("Escola invalida"),
    unitId: z.string().uuid("Unidade invalida"),
});
export const createUserSchema = z.object({
    email: z.string().email("Email invalido"),
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    role: userRoleSchema,
    schoolId: z.string().uuid("Escola invalida"),
    unitId: z.string().uuid("Unidade invalida"),
});
export const updateUserSchema = z.object({
    email: z.string().email("Email invalido").optional(),
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").optional(),
    role: userRoleSchema.optional(),
    unitId: z.string().uuid("Unidade invalida").optional(),
});
// Pagination schemas
export const paginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});
