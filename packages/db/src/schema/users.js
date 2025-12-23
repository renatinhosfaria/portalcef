import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { schools } from "./schools.js";
import { units } from "./units.js";
export const userRoleEnum = [
    "diretora",
    "gerente",
    "supervisora",
    "coordenadora",
    "professora",
    "auxiliar_sala",
    "auxiliar_administrativo",
];
export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: text("role", { enum: userRoleEnum })
        .notNull()
        .default("auxiliar_administrativo"),
    schoolId: uuid("school_id")
        .notNull()
        .references(() => schools.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
        .notNull()
        .references(() => units.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
});
