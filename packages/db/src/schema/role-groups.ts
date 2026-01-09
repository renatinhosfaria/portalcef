import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { userRoleEnum } from "./users.js";

/**
 * Enum para os códigos de grupo de roles
 * ADMIN - Administração global (master)
 * CLIENTES - Diretores e proprietários (diretora_geral)
 * ESCOLA_ADMINISTRATIVO - Setor administrativo da unidade
 * ESCOLA_PEDAGOGICO - Setor pedagógico da unidade
 */
export const roleGroupCodeEnum = [
  "ADMIN",
  "CLIENTES",
  "ESCOLA_ADMINISTRATIVO",
  "ESCOLA_PEDAGOGICO",
] as const;
export type RoleGroupCode = (typeof roleGroupCodeEnum)[number];

/**
 * Tabela de grupos de roles
 * Define a organização hierárquica dos roles do sistema
 */
export const roleGroups = pgTable("role_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code", { enum: roleGroupCodeEnum }).notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type RoleGroup = typeof roleGroups.$inferSelect;
export type NewRoleGroup = typeof roleGroups.$inferInsert;

/**
 * Tabela de mapeamento role -> grupo
 * Cada role pertence a exatamente um grupo
 */
export const roleGroupMappings = pgTable(
  "role_group_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: text("role", { enum: userRoleEnum }).notNull().unique(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => roleGroups.id, { onDelete: "cascade" }),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    groupIdIdx: index("role_group_mappings_group_id_idx").on(table.groupId),
  }),
);

export type RoleGroupMapping = typeof roleGroupMappings.$inferSelect;
export type NewRoleGroupMapping = typeof roleGroupMappings.$inferInsert;
