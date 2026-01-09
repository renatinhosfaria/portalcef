# Database Documentation

Documentacao do banco de dados PostgreSQL e uso do Drizzle ORM no Portal Digital Colegio Essencia Feliz.

---

## Stack

| Tecnologia      | Versao | Uso                      |
| --------------- | ------ | ------------------------ |
| **PostgreSQL**  | 16     | Banco de dados principal |
| **Drizzle ORM** | 0.38+  | ORM type-safe            |
| **Redis**       | 7      | Cache de sessoes         |

---

## Diagrama ER

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
│ id (PK)             │◄────────┬──────────┼──────────┐
│ school_id (FK)──────┼─────────┼──────────┘          │
│ name                │         │                     │
│ code                │         │                     │
│ address             │         │                     │
│ created_at          │         │                     │
│ updated_at          │         │                     │
└─────────────────────┘         │                     │
         │                      │                     │
         │ 1:N                  │ 1:N                 │ 1:N
         ├──────────────────────┼─────────────────────┤
         │                      │                     │
         ▼                      │                     ▼
┌─────────────────────┐         │            ┌─────────────────────┐
│       users         │         │            │       turmas        │
├─────────────────────┤         │            ├─────────────────────┤
│ id (PK)             │◄────────┼──────────┐ │ id (PK)             │
│ email (UNIQUE)      │         │          │ │ unit_id (FK)────────┼─┐
│ password_hash       │         │          │ │ stage_id (FK)       │ │
│ name                │         │          │ │ name                │ │
│ role (ENUM)         │         │          │ │ code                │ │
│ school_id (FK)──────┼─────────┘          │ │ year                │ │
│ unit_id (FK)────────┼────────────────────┘ │ shift (ENUM)        │ │
│ created_at          │                      │ capacity            │ │
│ updated_at          │                      │ is_active           │ │
└─────────────────────┘                      │ created_at          │ │
                                             │ updated_at          │ │
                                             └─────────────────────┘ │
                                                       └─────────────┘
                                             UNIQUE(unit_id, code, year)
         │
         │ 1:N                      1:N
         ├───────────────────────────┐
         │                           │
         ▼                           ▼
┌─────────────────────┐    ┌─────────────────────────┐
│      sessions       │    │      plannings          │
├─────────────────────┤    ├─────────────────────────┤
│ id (PK)             │    │ id (PK)                 │◄────────┐
│ user_id (FK)────────┤    │ user_id (FK)            │         │
│ token (UNIQUE)      │    │ turma_id                │         │
│ expires_at          │    │ quinzena                │         │
│ created_at          │    │ status (ENUM)           │         │
└─────────────────────┘    │ review_cycles           │         │
                           │ first_pass_yield        │         │
                           │ created_at              │         │
                           │ updated_at              │         │
                           │ submitted_at            │         │
                           │ approved_at             │         │
                           └─────────────────────────┘         │
                                    │                          │
                                    │ 1:1                      │
                                    ▼                          │
                           ┌─────────────────────────┐         │
                           │  planning_contents      │         │
                           ├─────────────────────────┤         │
                           │ id (PK)                 │         │
                           │ planning_id (FK UNIQUE)─┼─────────┤
                           │ objetivos               │         │
                           │ metodologia             │         │
                           │ recursos                │         │
                           │ atividades              │         │
                           │ created_at              │         │
                           │ updated_at              │         │
                           └─────────────────────────┘         │
                                                               │
                           ┌─────────────────────────┐         │
                           │  planning_reviews       │         │
                           ├─────────────────────────┤         │
                           │ id (PK)                 │         │
                           │ planning_id (FK)────────┼─────────┘
                           │ reviewer_id (FK → users)│
                           │ status (ENUM)           │
                           │ comentario              │
                           │ created_at              │
                           └─────────────────────────┘
```

---

## Tabelas

### schools

Representa uma instituicao escolar (rede/grupo).

| Coluna       | Tipo          | Nullable | Descricao           |
| ------------ | ------------- | -------- | ------------------- |
| `id`         | `uuid`        | No       | PK - UUID aleatorio |
| `name`       | `text`        | No       | Nome da escola      |
| `code`       | `text`        | No       | Codigo unico (slug) |
| `created_at` | `timestamptz` | No       | Data de criacao     |
| `updated_at` | `timestamptz` | No       | Ultima atualizacao  |

**Constraints:**

- `code` UNIQUE

---

### units

Representa uma unidade/filial da escola.

| Coluna       | Tipo          | Nullable | Descricao           |
| ------------ | ------------- | -------- | ------------------- |
| `id`         | `uuid`        | No       | PK - UUID aleatorio |
| `school_id`  | `uuid`        | No       | FK → schools.id     |
| `name`       | `text`        | No       | Nome da unidade     |
| `code`       | `text`        | No       | Codigo da unidade   |
| `address`    | `text`        | Yes      | Endereco            |
| `created_at` | `timestamptz` | No       | Data de criacao     |
| `updated_at` | `timestamptz` | No       | Ultima atualizacao  |

**Constraints:**

- `school_id` FK CASCADE DELETE

---

### education_stages

Etapas educacionais usadas para segmentacao pedagogica.

| Coluna       | Tipo          | Nullable | Descricao                                      |
| ------------ | ------------- | -------- | ---------------------------------------------- |
| `id`         | `uuid`        | No       | PK - UUID aleatorio                            |
| `code`       | `text`        | No       | Codigo da etapa (BERCARIO, INFANTIL, etc)      |
| `name`       | `text`        | No       | Nome da etapa                                  |
| `created_at` | `timestamptz` | No       | Data de criacao                                |
| `updated_at` | `timestamptz` | No       | Ultima atualizacao                             |

**Constraints:**

- `code` UNIQUE

---

### role_groups

Grupos organizacionais de roles para exibicao e permissoes.

| Coluna          | Tipo          | Nullable | Descricao                                           |
| --------------- | ------------- | -------- | --------------------------------------------------- |
| `id`            | `uuid`        | No       | PK - UUID aleatorio                                 |
| `code`          | `text (enum)` | No       | Codigo do grupo (ADMIN, CLIENTES, ESCOLA_*)         |
| `name`          | `text`        | No       | Nome do grupo                                       |
| `description`   | `text`        | Yes      | Descricao do grupo                                  |
| `display_order` | `integer`     | No       | Ordem de exibicao (default: 0)                      |
| `created_at`    | `timestamptz` | No       | Data de criacao                                     |
| `updated_at`    | `timestamptz` | No       | Ultima atualizacao                                  |

**Enum Values (code):**

- `ADMIN` - Administradores do sistema (master)
- `CLIENTES` - Clientes da plataforma (diretora_geral)
- `ESCOLA_ADMINISTRATIVO` - Setor administrativo da escola
- `ESCOLA_PEDAGOGICO` - Setor pedagogico da escola

**Constraints:**

- `code` UNIQUE

---

### role_group_mappings

Mapeamento de roles para grupos.

| Coluna          | Tipo          | Nullable | Descricao                      |
| --------------- | ------------- | -------- | ------------------------------ |
| `id`            | `uuid`        | No       | PK - UUID aleatorio            |
| `role`          | `text (enum)` | No       | Role mapeada                   |
| `group_id`      | `uuid`        | No       | FK → role_groups.id            |
| `display_order` | `integer`     | No       | Ordem dentro do grupo          |

**Constraints:**

- `role` UNIQUE
- `group_id` FK

---

### unit_stages

Relacionamento many-to-many entre unidades e etapas educacionais.

| Coluna       | Tipo          | Nullable | Descricao                       |
| ------------ | ------------- | -------- | ------------------------------- |
| `id`         | `uuid`        | No       | PK - UUID aleatorio             |
| `unit_id`    | `uuid`        | No       | FK → units.id (CASCADE DELETE)  |
| `stage_id`   | `uuid`        | No       | FK → education_stages.id (CASCADE DELETE) |
| `is_active`  | `boolean`     | No       | Se a etapa esta ativa (soft delete) |
| `created_at` | `timestamptz` | No       | Data de criacao                 |
| `updated_at` | `timestamptz` | No       | Ultima atualizacao              |

**Constraints:**

- UNIQUE(unit_id, stage_id)
- `unit_id` FK CASCADE DELETE
- `stage_id` FK CASCADE DELETE

---

### turmas

Turmas (classes) organizadas por unidade, etapa e ano letivo.

| Coluna       | Tipo          | Nullable | Descricao                                      |
| ------------ | ------------- | -------- | ---------------------------------------------- |
| `id`         | `uuid`        | No       | PK - UUID aleatorio                            |
| `unit_id`    | `uuid`        | No       | FK → units.id (CASCADE DELETE)                 |
| `stage_id`   | `uuid`        | No       | FK → education_stages.id (CASCADE DELETE)      |
| `name`       | `text`        | No       | Nome da turma (ex: "Infantil 3A")              |
| `code`       | `text`        | No       | Codigo da turma (ex: "INF-3A")                 |
| `year`       | `integer`     | No       | Ano letivo (ex: 2025)                          |
| `shift`      | `text (enum)` | Yes      | Turno (matutino, vespertino, integral)         |
| `capacity`   | `integer`     | Yes      | Capacidade maxima de alunos                    |
| `is_active`  | `boolean`     | No       | Se a turma esta ativa (soft delete)            |
| `created_at` | `timestamptz` | No       | Data de criacao                                |
| `updated_at` | `timestamptz` | No       | Ultima atualizacao                             |

**Enum Values (shift):**

- `matutino` - Turno da manha
- `vespertino` - Turno da tarde
- `integral` - Turno integral (manha + tarde)

**Constraints:**

- UNIQUE(unit_id, code, year) - Impede codigo duplicado na mesma unidade/ano
- `unit_id` FK CASCADE DELETE
- `stage_id` FK CASCADE DELETE

**Regras de Negocio:**

- `stageId` deve existir em `unit_stages` para a `unitId` (validado na API)
- `code` e unico por unidade e ano letivo
- `year` deve estar entre 2020 e 2100

---

### calendar_events

Eventos do calendario escolar (feriados, recessos, eventos especiais, etc).

| Coluna                  | Tipo          | Nullable | Descricao                            |
| ----------------------- | ------------- | -------- | ------------------------------------ |
| `id`                    | `uuid`        | No       | PK - UUID aleatorio                  |
| `unit_id`               | `uuid`        | Yes      | FK → units.id (null = todas unidades)|
| `title`                 | `text`        | No       | Titulo do evento                     |
| `description`           | `text`        | Yes      | Descricao detalhada                  |
| `event_type`            | `text (enum)` | No       | Tipo do evento                       |
| `start_date`            | `date`        | No       | Data de inicio                       |
| `end_date`              | `date`        | Yes      | Data de termino (null = 1 dia)       |
| `is_school_day`         | `boolean`     | No       | Se eh dia letivo (default: true)     |
| `is_recurring_annually` | `boolean`     | No       | Se repete todo ano (default: false)  |
| `created_by`            | `uuid`        | No       | FK → users.id (quem criou)           |
| `created_at`            | `timestamptz` | No       | Data de criacao                      |
| `updated_at`            | `timestamptz` | No       | Ultima atualizacao                   |

**Enum Values (event_type):**

- `INICIO_SEMESTRE` - Inicio do semestre letivo
- `TERMINO_SEMESTRE` - Termino do semestre letivo
- `FERIADO` - Feriado nacional/estadual/municipal
- `RECESSO` - Periodo de recesso escolar
- `FERIAS_PROFESSORES` - Ferias dos professores
- `SABADO_LETIVO` - Sabado letivo compensatorio
- `SEMANA_PROVAS` - Semana de avaliacoes/provas
- `DIA_LETIVO` - Dia letivo especial
- `REUNIAO_PEDAGOGICA` - Reuniao pedagogica
- `EVENTO_ESPECIAL` - Outros eventos (formaturas, festas, etc)

**Constraints:**

- `unit_id` FK CASCADE DELETE (nullable para eventos globais)
- `created_by` FK SET NULL (manter historico se usuario deletado)

**Indices:**

- `calendar_events_unit_id_idx` on `unit_id`
- `calendar_events_start_date_idx` on `start_date`
- `calendar_events_event_type_idx` on `event_type`

**Regras de Negocio:**

- Se `unit_id` = null, evento aplica a todas as unidades da escola
- `start_date` <= `end_date` quando `end_date` != null
- `start_date` deve estar entre 2020-01-01 e 2100-12-31
- Eventos com `is_school_day = true` contam como dia letivo
- Eventos com `is_recurring_annually = true` repetem todo ano na mesma data

---

### users

Usuarios do sistema com contexto multi-tenant.

| Coluna          | Tipo          | Nullable | Descricao           |
| --------------- | ------------- | -------- | ------------------- |
| `id`            | `uuid`        | No       | PK - UUID aleatorio |
| `email`         | `text`        | No       | Email unico         |
| `password_hash` | `text`        | No       | Hash bcrypt         |
| `name`          | `text`        | No       | Nome completo       |
| `role`          | `text (enum)` | No       | Role do usuario     |
| `school_id`     | `uuid`        | Yes      | FK → schools.id     |
| `unit_id`       | `uuid`        | Yes      | FK → units.id       |
| `stage_id`      | `uuid`        | Yes      | FK → education_stages.id |
| `created_at`    | `timestamptz` | No       | Data de criacao     |
| `updated_at`    | `timestamptz` | No       | Ultima atualizacao  |

**Constraints:**

- `email` UNIQUE
- `school_id` FK CASCADE DELETE (nullable para master)
- `unit_id` FK CASCADE DELETE (nullable para master/diretora)
- `stage_id` FK SET NULL (nullable para roles sem etapa)

---

### sessions

Sessoes de usuario (tracking, backup do Redis).

| Coluna       | Tipo          | Nullable | Descricao             |
| ------------ | ------------- | -------- | --------------------- |
| `id`         | `uuid`        | No       | PK - UUID aleatorio   |
| `user_id`    | `uuid`        | No       | FK → users.id         |
| `token`      | `text`        | No       | Token unico da sessao |
| `expires_at` | `timestamptz` | No       | Data de expiracao     |
| `created_at` | `timestamptz` | No       | Data de criacao       |

**Constraints:**

- `token` UNIQUE
- `user_id` FK CASCADE DELETE

---

### plannings

Planejamentos pedagogicos quinzenais.

| Coluna             | Tipo          | Nullable | Descricao                     |
| ------------------ | ------------- | -------- | ----------------------------- |
| `id`               | `uuid`        | No       | PK - UUID aleatorio           |
| `user_id`          | `uuid`        | No       | FK → users.id (professora)    |
| `stage_id`         | `uuid`        | Yes      | FK → education_stages.id      |
| `turma_id`         | `text`        | No       | ID da turma (ex: "INF-1A")    |
| `quinzena`         | `text`        | No       | Quinzena (ex: "2025-Q01")     |
| `status`           | `text (enum)` | No       | Status do planejamento        |
| `review_cycles`    | `integer`     | No       | Ciclos de revisao (default 0) |
| `first_pass_yield` | `boolean`     | Yes      | Aprovado na 1a tentativa      |
| `created_at`       | `timestamptz` | No       | Data de criacao               |
| `updated_at`       | `timestamptz` | No       | Ultima atualizacao            |
| `submitted_at`     | `timestamptz` | Yes      | Data de envio                 |
| `approved_at`      | `timestamptz` | Yes      | Data de aprovacao             |

**Indices:**

- `plannings_status_idx` on `status`
- `plannings_user_turma_quinzena_unique` UNIQUE on (`user_id`, `turma_id`, `quinzena`)

---

### planning_contents

Conteudo pedagogico do planejamento (relacao 1:1).

| Coluna        | Tipo          | Nullable | Descricao                  |
| ------------- | ------------- | -------- | -------------------------- |
| `id`          | `uuid`        | No       | PK - UUID aleatorio        |
| `planning_id` | `uuid`        | No       | FK → plannings.id (UNIQUE) |
| `objetivos`   | `text`        | Yes      | Objetivos de aprendizagem  |
| `metodologia` | `text`        | Yes      | Metodologia pedagogica     |
| `recursos`    | `text`        | Yes      | Recursos necessarios       |
| `atividades`  | `text`        | Yes      | Atividades planejadas      |
| `created_at`  | `timestamptz` | No       | Data de criacao            |
| `updated_at`  | `timestamptz` | No       | Ultima atualizacao         |

**Constraints:**

- `planning_id` UNIQUE (garante 1:1)
- FK CASCADE DELETE

---

### planning_reviews

Historico de revisoes de planejamentos.

| Coluna        | Tipo          | Nullable | Descricao                    |
| ------------- | ------------- | -------- | ---------------------------- |
| `id`          | `uuid`        | No       | PK - UUID aleatorio          |
| `planning_id` | `uuid`        | No       | FK → plannings.id            |
| `reviewer_id` | `uuid`        | No       | FK → users.id (coordenadora) |
| `status`      | `text (enum)` | No       | Status da revisao            |
| `comentario`  | `text`        | No       | Comentario (obrigatorio)     |
| `created_at`  | `timestamptz` | No       | Data da revisao              |

**Constraints:**

- FKs CASCADE DELETE

---

## Enums

### planning_status

| Valor       | Descricao                                    |
| ----------- | -------------------------------------------- |
| `RASCUNHO`  | Salvo localmente ou no servidor, nao enviado |
| `PENDENTE`  | Enviado para coordenacao, aguardando review  |
| `EM_AJUSTE` | Coordenacao solicitou ajustes                |
| `APROVADO`  | Coordenacao aprovou                          |

### review_status

| Valor       | Descricao                 |
| ----------- | ------------------------- |
| `APROVADO`  | Planejamento aprovado     |
| `EM_AJUSTE` | Ajustes foram solicitados |

### user_role

| Role                       | Nivel | Escopo  |
| -------------------------- | ----- | ------- |
| `master`                   | 0     | Global  |
| `diretora_geral`           | 1     | Escola  |
| `gerente_unidade`          | 2     | Unidade |
| `gerente_financeiro`       | 3     | Unidade |
| `coordenadora_geral`       | 4     | Unidade |
| `coordenadora_bercario`    | 5     | Unidade |
| `coordenadora_infantil`    | 6     | Unidade |
| `coordenadora_fundamental_i` | 7   | Unidade |
| `coordenadora_fundamental_ii` | 8  | Unidade |
| `coordenadora_medio`       | 9     | Unidade |
| `analista_pedagogico`      | 10    | Unidade |
| `professora`               | 11    | Unidade |
| `auxiliar_administrativo`  | 12    | Unidade |
| `auxiliar_sala`            | 13    | Unidade |

---

## Multi-Tenant

### Hierarquia

```
Escola (schools)
  └── Unidade (units)
        └── Usuarios (users) [stage_id opcional]
              └── Planejamento (plannings)

Etapas (education_stages) = tabela de referencia global
```

### Isolamento de Dados

| Role             | Escopo                         |
| ---------------- | ------------------------------ |
| `master`         | Todas as escolas               |
| `diretora_geral` | Toda a escola (todas unidades) |
| Roles de etapa   | Unidade + sua etapa            |
| Demais roles     | Apenas sua unidade             |

---

## Configuracao

### Variaveis de Ambiente

```bash
# Desenvolvimento
DATABASE_URL=postgresql://essencia:essencia_dev@localhost:5432/essencia_db

# Producao
DATABASE_URL=postgresql://user:password@host:5432/essencia_db
```

### Docker Compose (Desenvolvimento)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: essencia-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: essencia
      POSTGRES_PASSWORD: essencia_dev
      POSTGRES_DB: essencia_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U essencia -d essencia_db"]
      interval: 10s
      timeout: 5s
      retries: 5
```

---

## Drizzle ORM

### Estrutura de Arquivos

```
packages/db/
├── src/
│   ├── schema/
│   │   ├── index.ts          # Re-exports
│   │   ├── education-stages.ts # Schema education_stages
│   │   ├── schools.ts        # Schema schools
│   │   ├── units.ts          # Schema units
│   │   ├── users.ts          # Schema users
│   │   ├── sessions.ts       # Schema sessions
│   │   └── planejamento.ts   # Schemas planning*
│   ├── client.ts             # Connection factory
│   └── index.ts              # Main exports
├── drizzle/                  # Migrations
│   ├── 0000_*.sql
│   ├── 0001_*.sql
│   └── meta/
└── drizzle.config.ts
```

### Definicao de Schema

```typescript
// packages/db/src/schema/users.ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { educationStages } from "./education-stages.js";
import { schools } from "./schools.js";
import { units } from "./units.js";

export const userRoleEnum = [
  "master",
  "diretora_geral",
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
] as const;

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
  stageId: uuid("stage_id").references(() => educationStages.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

### Relacoes

```typescript
// packages/db/src/schema/planejamento.ts
export const planningsRelations = relations(plannings, ({ one, many }) => ({
  user: one(users, {
    fields: [plannings.userId],
    references: [users.id],
  }),
  stage: one(educationStages, {
    fields: [plannings.stageId],
    references: [educationStages.id],
  }),
  content: one(planningContents, {
    fields: [plannings.id],
    references: [planningContents.planningId],
  }),
  reviews: many(planningReviews),
}));
```

---

## Comandos

```bash
# Gerar migracao
pnpm db:generate

# Aplicar migracoes
pnpm db:migrate

# Abrir Drizzle Studio
pnpm db:studio

# Reset database (cuidado!)
pnpm --filter @essencia/db reset
```

---

## Queries Exemplo

### Buscar usuario por email

```typescript
import { db } from "@essencia/db";
import { users, eq } from "@essencia/db/schema";

const user = await db.query.users.findFirst({
  where: eq(users.email, "admin@essencia.edu.br"),
});
```

### Buscar usuarios por tenant

```typescript
const unitUsers = await db.query.users.findMany({
  where: and(
    eq(users.schoolId, currentUser.schoolId),
    eq(users.unitId, currentUser.unitId),
  ),
});
```

### Criar planejamento com conteudo

```typescript
const [planning] = await db
  .insert(plannings)
  .values({
    userId,
    turmaId: "INF-3A",
    quinzena: "2025-Q01",
    status: "RASCUNHO",
  })
  .returning();

await db.insert(planningContents).values({
  planningId: planning.id,
  objetivos: "...",
  metodologia: "...",
});
```

### Buscar planejamento com relacoes

```typescript
const planning = await db.query.plannings.findFirst({
  where: eq(plannings.id, planningId),
  with: {
    user: true,
    content: true,
    reviews: {
      with: {
        reviewer: true,
      },
    },
  },
});
```

---

## Governanca

### Regra de Acesso

**`packages/db` so pode ser importado por `services/api`**

```typescript
// services/api - OK
import { db, users } from "@essencia/db";

// apps/* - PROIBIDO (ESLint error)
import { db } from "@essencia/db";
```

### Fluxo de Dados

```
App (Next.js) → HTTP → API (NestJS) → Drizzle → PostgreSQL
                                          ↑
                                    @essencia/db
```

---

## Migracoes

### Arquivos

```
packages/db/drizzle/
├── 0000_initial.sql           # Schema inicial
├── 0001_add_plannings.sql     # Tabelas de planejamento
├── 0002_add_indexes.sql       # Indices de performance
├── 0003_add_reviews.sql       # Tabela de reviews
└── meta/
    └── _journal.json          # Historico de migracoes
```

### Criar Nova Migracao

1. Modificar schema em `packages/db/src/schema/*.ts`
2. Executar `pnpm db:generate`
3. Revisar SQL gerado em `drizzle/`
4. Executar `pnpm db:migrate`

### Rollback

Drizzle nao suporta rollback automatico. Para reverter:

1. Criar nova migracao com operacoes inversas
2. Ou restaurar backup do banco

---

## Referencias

- [Drizzle ORM](https://orm.drizzle.team)
- [PostgreSQL 16](https://www.postgresql.org/docs/16/)
- [Drizzle Kit](https://orm.drizzle.team/kit-docs)
