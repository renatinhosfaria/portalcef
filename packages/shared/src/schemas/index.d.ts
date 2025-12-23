import { z } from "zod";
export declare const userRoleSchema: z.ZodEnum<
  [
    "diretora",
    "gerente",
    "supervisora",
    "coordenadora",
    "professora",
    "auxiliar_sala",
    "auxiliar_administrativo",
  ]
>;
export declare const schoolSchema: z.ZodObject<
  {
    id: z.ZodString;
    name: z.ZodString;
    code: z.ZodString;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
  },
  "strip",
  z.ZodTypeAny,
  {
    id: string;
    name: string;
    code: string;
    createdAt: Date;
    updatedAt: Date;
  },
  {
    id: string;
    name: string;
    code: string;
    createdAt: Date;
    updatedAt: Date;
  }
>;
export declare const createSchoolSchema: z.ZodObject<
  {
    name: z.ZodString;
    code: z.ZodString;
  },
  "strip",
  z.ZodTypeAny,
  {
    name: string;
    code: string;
  },
  {
    name: string;
    code: string;
  }
>;
export declare const updateSchoolSchema: z.ZodObject<
  {
    name: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
  },
  "strip",
  z.ZodTypeAny,
  {
    name?: string | undefined;
    code?: string | undefined;
  },
  {
    name?: string | undefined;
    code?: string | undefined;
  }
>;
export declare const unitSchema: z.ZodObject<
  {
    id: z.ZodString;
    schoolId: z.ZodString;
    name: z.ZodString;
    code: z.ZodString;
    address: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
  },
  "strip",
  z.ZodTypeAny,
  {
    id: string;
    name: string;
    code: string;
    createdAt: Date;
    updatedAt: Date;
    schoolId: string;
    address: string | null;
  },
  {
    id: string;
    name: string;
    code: string;
    createdAt: Date;
    updatedAt: Date;
    schoolId: string;
    address: string | null;
  }
>;
export declare const createUnitSchema: z.ZodObject<
  {
    schoolId: z.ZodString;
    name: z.ZodString;
    code: z.ZodString;
    address: z.ZodOptional<z.ZodString>;
  },
  "strip",
  z.ZodTypeAny,
  {
    name: string;
    code: string;
    schoolId: string;
    address?: string | undefined;
  },
  {
    name: string;
    code: string;
    schoolId: string;
    address?: string | undefined;
  }
>;
export declare const updateUnitSchema: z.ZodObject<
  {
    name: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodOptional<z.ZodString>>;
  },
  "strip",
  z.ZodTypeAny,
  {
    name?: string | undefined;
    code?: string | undefined;
    address?: string | undefined;
  },
  {
    name?: string | undefined;
    code?: string | undefined;
    address?: string | undefined;
  }
>;
export declare const userSchema: z.ZodObject<
  {
    id: z.ZodString;
    email: z.ZodString;
    name: z.ZodString;
    role: z.ZodEnum<
      [
        "diretora",
        "gerente",
        "supervisora",
        "coordenadora",
        "professora",
        "auxiliar_sala",
        "auxiliar_administrativo",
      ]
    >;
    schoolId: z.ZodString;
    unitId: z.ZodString;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
  },
  "strip",
  z.ZodTypeAny,
  {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    schoolId: string;
    email: string;
    role:
      | "diretora"
      | "gerente"
      | "supervisora"
      | "coordenadora"
      | "professora"
      | "auxiliar_sala"
      | "auxiliar_administrativo";
    unitId: string;
  },
  {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    schoolId: string;
    email: string;
    role:
      | "diretora"
      | "gerente"
      | "supervisora"
      | "coordenadora"
      | "professora"
      | "auxiliar_sala"
      | "auxiliar_administrativo";
    unitId: string;
  }
>;
export declare const loginSchema: z.ZodObject<
  {
    email: z.ZodString;
    password: z.ZodString;
  },
  "strip",
  z.ZodTypeAny,
  {
    email: string;
    password: string;
  },
  {
    email: string;
    password: string;
  }
>;
export declare const registerSchema: z.ZodObject<
  {
    email: z.ZodString;
    password: z.ZodString;
    name: z.ZodString;
    role: z.ZodEnum<
      [
        "diretora",
        "gerente",
        "supervisora",
        "coordenadora",
        "professora",
        "auxiliar_sala",
        "auxiliar_administrativo",
      ]
    >;
    schoolId: z.ZodString;
    unitId: z.ZodString;
  },
  "strip",
  z.ZodTypeAny,
  {
    name: string;
    schoolId: string;
    email: string;
    role:
      | "diretora"
      | "gerente"
      | "supervisora"
      | "coordenadora"
      | "professora"
      | "auxiliar_sala"
      | "auxiliar_administrativo";
    unitId: string;
    password: string;
  },
  {
    name: string;
    schoolId: string;
    email: string;
    role:
      | "diretora"
      | "gerente"
      | "supervisora"
      | "coordenadora"
      | "professora"
      | "auxiliar_sala"
      | "auxiliar_administrativo";
    unitId: string;
    password: string;
  }
>;
export declare const createUserSchema: z.ZodObject<
  {
    email: z.ZodString;
    password: z.ZodString;
    name: z.ZodString;
    role: z.ZodEnum<
      [
        "diretora",
        "gerente",
        "supervisora",
        "coordenadora",
        "professora",
        "auxiliar_sala",
        "auxiliar_administrativo",
      ]
    >;
    schoolId: z.ZodString;
    unitId: z.ZodString;
  },
  "strip",
  z.ZodTypeAny,
  {
    name: string;
    schoolId: string;
    email: string;
    role:
      | "diretora"
      | "gerente"
      | "supervisora"
      | "coordenadora"
      | "professora"
      | "auxiliar_sala"
      | "auxiliar_administrativo";
    unitId: string;
    password: string;
  },
  {
    name: string;
    schoolId: string;
    email: string;
    role:
      | "diretora"
      | "gerente"
      | "supervisora"
      | "coordenadora"
      | "professora"
      | "auxiliar_sala"
      | "auxiliar_administrativo";
    unitId: string;
    password: string;
  }
>;
export declare const updateUserSchema: z.ZodObject<
  {
    email: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<
      z.ZodEnum<
        [
          "diretora",
          "gerente",
          "supervisora",
          "coordenadora",
          "professora",
          "auxiliar_sala",
          "auxiliar_administrativo",
        ]
      >
    >;
    unitId: z.ZodOptional<z.ZodString>;
  },
  "strip",
  z.ZodTypeAny,
  {
    name?: string | undefined;
    email?: string | undefined;
    role?:
      | "diretora"
      | "gerente"
      | "supervisora"
      | "coordenadora"
      | "professora"
      | "auxiliar_sala"
      | "auxiliar_administrativo"
      | undefined;
    unitId?: string | undefined;
  },
  {
    name?: string | undefined;
    email?: string | undefined;
    role?:
      | "diretora"
      | "gerente"
      | "supervisora"
      | "coordenadora"
      | "professora"
      | "auxiliar_sala"
      | "auxiliar_administrativo"
      | undefined;
    unitId?: string | undefined;
  }
>;
export declare const paginationSchema: z.ZodObject<
  {
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
  },
  "strip",
  z.ZodTypeAny,
  {
    page: number;
    limit: number;
  },
  {
    page?: number | undefined;
    limit?: number | undefined;
  }
>;
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
//# sourceMappingURL=index.d.ts.map
