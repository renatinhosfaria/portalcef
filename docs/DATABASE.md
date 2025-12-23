# Database Documentation

Documentacao do banco de dados PostgreSQL e uso do Drizzle ORM no Portal Digital Colegio Espaco Feliz.

---

## Stack

| Tecnologia      | Versao | Uso               |
| --------------- | ------ | ----------------- |
| **PostgreSQL**  | 16     | Banco principal   |
| **Drizzle ORM** | Latest | Type-safe queries |
| **Redis**       | 7      | Cache de sessoes  |

---

## Schema

### Diagrama ER

```
┌─────────────────────┐
│      schools        │
├─────────────────────┤
│ id (PK)             │◄───────────────────┐
│ name                │                    │
│ code (UNIQUE)       │                    │
│ created_at          │                    │
│ updated_at          │                    │
└─────────────────────┘                    │
         │                                 │
         │ 1:N                             │
         ▼                                 │
┌─────────────────────┐                    │
│       units         │                    │
├─────────────────────┤                    │
│ id (PK)             │◄────────┐          │
│ school_id (FK)──────┼─────────┼──────────┘
│ name                │         │
│ code                │         │
│ address             │         │
│ created_at          │         │
│ updated_at          │         │
└─────────────────────┘         │
         │                      │
         │ 1:N                  │ 1:N
         ▼                      │
┌─────────────────────┐         │
│       users         │         │
├─────────────────────┤         │
│ id (PK)             │◄────────┼──────────┐
│ email (UNIQUE)      │         │          │
│ password_hash       │         │          │
│ name                │         │          │
│ role                │         │          │
│ school_id (FK)──────┼─────────┘          │
│ unit_id (FK)────────┼────────────────────┘
│ created_at          │
│ updated_at          │
└─────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────┐
│      sessions       │
├─────────────────────┤
│ id (PK)             │
│ user_id (FK)────────┼────────────────────
│ token (UNIQUE)      │
│ expires_at          │
│ created_at          │
└─────────────────────┘
```

### Tabela `schools`

| Coluna       | Tipo                   | Descricao           |
| ------------ | ---------------------- | ------------------- |
| `id`         | `uuid`                 | PK - Random UUID    |
| `name`       | `text`                 | Nome da escola      |
| `code`       | `text`                 | Codigo unico (slug) |
| `created_at` | `timestamp (timezone)` | Data criacao        |
| `updated_at` | `timestamp (timezone)` | Ultima atualizacao  |

### Tabela `units`

| Coluna       | Tipo                   | Descricao                 |
| ------------ | ---------------------- | ------------------------- |
| `id`         | `uuid`                 | PK - Random UUID          |
| `school_id`  | `uuid`                 | FK → schools.id (cascade) |
| `name`       | `text`                 | Nome da unidade           |
| `code`       | `text`                 | Codigo da unidade         |
| `address`    | `text`                 | Endereco (opcional)       |
| `created_at` | `timestamp (timezone)` | Data criacao              |
| `updated_at` | `timestamp (timezone)` | Ultima atualizacao        |

### Tabela `users`

| Coluna          | Tipo                   | Descricao                                                  |
| --------------- | ---------------------- | ---------------------------------------------------------- |
| `id`            | `uuid`                 | PK - Random UUID                                           |
| `email`         | `text`                 | Unico                                                      |
| `password_hash` | `text`                 | bcrypt                                                     |
| `name`          | `text`                 | Nome completo                                              |
| `role`          | `text (enum)`          | Role do usuario                                            |
| `school_id`     | `uuid`                 | FK → schools.id (cascade, null para master)                |
| `unit_id`       | `uuid`                 | FK → units.id (cascade, null para master e diretora_geral) |
| `created_at`    | `timestamp (timezone)` | Data criacao                                               |
| `updated_at`    | `timestamp (timezone)` | Ultima atualizacao                                         |

### Tabela `sessions`

| Coluna       | Tipo                   | Descricao               |
| ------------ | ---------------------- | ----------------------- |
| `id`         | `uuid`                 | PK - Random UUID        |
| `user_id`    | `uuid`                 | FK → users.id (cascade) |
| `token`      | `text`                 | Token unico da sessao   |
| `expires_at` | `timestamp (timezone)` | Data de expiracao       |
| `created_at` | `timestamp (timezone)` | Data criacao            |

### Enum `user_role`

| Role                       | Nivel | Escopo  | Descricao                        |
| -------------------------- | ----- | ------- | -------------------------------- |
| `master`                   | 0     | Global  | Acesso total a todas as escolas  |
| `diretora_geral`           | 1     | Escola  | Acesso total a todas as unidades |
| `gerente_unidade`          | 2     | Unidade | Gestao completa da unidade       |
| `gerente_financeiro`       | 3     | Unidade | Gestao financeira                |
| `coordenadora_geral`       | 4     | Unidade | Coordenacao academica            |
| `coordenadora_infantil`    | 5     | Unidade | Coordenacao infantil             |
| `coordenadora_fundamental` | 6     | Unidade | Coordenacao fundamental          |
| `analista_pedagogico`      | 7     | Unidade | Supervisao pedagogica            |
| `professora`               | 8     | Unidade | Acesso a turmas e alunos         |
| `auxiliar_administrativo`  | 9     | Unidade | Suporte administrativo           |
| `auxiliar_sala`            | 10    | Unidade | Suporte em sala de aula          |

```typescript
const userRoleEnum = [
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
] as const;
```

---

## Multi-Tenant

O sistema e multi-tenant com isolamento por escola e unidade:

- **Escola**: Entidade raiz (ex: "Colegio Espaco Feliz")
- **Unidade**: Filial da escola (ex: "Unidade Santa Monica")
- **Usuario**: Pertence a uma escola e, em geral, a uma unidade (exceto master e diretora_geral)

### Controle de Acesso

| Role                       | Propria Unidade | Outras Unidades (Mesma Escola) | Outras Escolas |
| -------------------------- | --------------- | ------------------------------ | -------------- |
| `master`                   | Total           | Total                          | Total          |
| `diretora_geral`           | Total           | Total                          | Nenhum         |
| `gerente_unidade`          | Total           | Nenhum                         | Nenhum         |
| `gerente_financeiro`       | Total           | Nenhum                         | Nenhum         |
| `coordenadora_geral`       | Total           | Nenhum                         | Nenhum         |
| `coordenadora_infantil`    | Total           | Nenhum                         | Nenhum         |
| `coordenadora_fundamental` | Total           | Nenhum                         | Nenhum         |
| `analista_pedagogico`      | Total           | Nenhum                         | Nenhum         |
| `professora`               | Leitura         | Nenhum                         | Nenhum         |
| `auxiliar_administrativo`  | Leitura         | Nenhum                         | Nenhum         |
| `auxiliar_sala`            | Leitura         | Nenhum                         | Nenhum         |

---

## Configuracao

### Variaveis de Ambiente

```bash
# Dev
DATABASE_URL=postgresql://essencia:essencia_dev@localhost:5432/essencia_db

# Prod
DATABASE_URL=postgresql://user:password@host:5432/essencia_db
```

---

## Schema Drizzle

```typescript
// packages/db/src/schema/schools.ts
export const schools = pgTable("schools", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// packages/db/src/schema/units.ts
export const units = pgTable("units", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  code: text("code").notNull(),
  address: text("address"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// packages/db/src/schema/users.ts
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: userRoleEnum })
    .notNull()
    .default("auxiliar_administrativo"),
  schoolId: uuid("school_id").references(() => schools.id, {
    onDelete: "cascade",
  }),
  unitId: uuid("unit_id").references(() => units.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

---

## Migracoes

### Comandos

```bash
pnpm db:generate  # Gerar migracao
pnpm db:migrate   # Aplicar migracoes
pnpm db:studio    # GUI Drizzle
```

---

## Queries Exemplo

```typescript
import { db, schools, units, users, eq, and } from "@essencia/db";

// Buscar escola por codigo
const school = await db.query.schools.findFirst({
  where: eq(schools.code, "colegio-espaco-feliz"),
});

// Buscar unidades da escola
const schoolUnits = await db.query.units.findMany({
  where: eq(units.schoolId, school.id),
});

// Buscar usuarios da unidade
const unitUsers = await db.query.users.findMany({
  where: and(eq(users.schoolId, school.id), eq(users.unitId, unit.id)),
});

// Criar usuario com tenant
const [newUser] = await db
  .insert(users)
  .values({
    email,
    passwordHash,
    name,
    role: "professora",
    schoolId: school.id,
    unitId: unit.id,
  })
  .returning();
```

---

## Regras de Acesso

> `packages/db` so pode ser importado por `services/api`

```typescript
// Backend (services/api)
import { db, users } from "@essencia/db";

// Frontend (apps/*) - ESLint Error!
import { db } from "@essencia/db";
```

---

## Referencias

- [Drizzle ORM](https://orm.drizzle.team/)
- [PostgreSQL 16](https://www.postgresql.org/docs/16/)
