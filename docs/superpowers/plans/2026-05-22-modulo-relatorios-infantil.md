# Módulo Relatórios — Educação Infantil — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o módulo Relatórios — terceiro submódulo do Planejamento Pedagógico, exclusivo para turmas BERCARIO e INFANTIL, com paridade total de funcionalidades com o módulo de plano de aula.

**Architecture:** Nova entidade `relatorio` espelha `plano_aula`: três tabelas Drizzle (`semana_relatorio`, `relatorio`, `relatorio_documento`), dois módulos NestJS (`semana-relatorio/` e `relatorio/`) com o mesmo pipeline AuthGuard → RolesGuard → TenantGuard, e rotas Next.js em `apps/planejamento/app/relatorios/` espelhando as rotas existentes de planejamentos/analise/gestao. O frontend é organizado em `apps/planejamento/features/relatorio/` seguindo o padrão do `features/plano-aula/`.

**Tech Stack:** Turborepo, pnpm, Next.js 15 App Router, React 19, NestJS + Fastify, Drizzle ORM, PostgreSQL, BullMQ + Redis, shadcn/ui + Tailwind, Vitest (frontend), Jest + ts-jest (backend).

---

## Contexto Obrigatório

Leia antes de executar:

- `docs/superpowers/specs/2026-05-22-modulo-relatorios-infantil-design.md`
- `packages/db/src/schema/plano-aula.ts` — modelo de dados a espelhar
- `packages/db/src/schema/plano-aula-historico.ts` — modelo do histórico
- `packages/db/src/schema/plano-aula-periodo.ts` — modelo de período
- `services/api/src/modules/plano-aula/plano-aula.module.ts`
- `services/api/src/modules/plano-aula/plano-aula.service.ts`
- `services/api/src/modules/plano-aula/plano-aula.controller.ts`
- `services/api/src/modules/plano-aula/plano-aula-historico.service.ts`
- `services/api/src/modules/plano-aula/plano-aula-pdf-queue.service.ts`
- `services/api/src/modules/plano-aula/plano-aula-pdf-worker.service.ts`
- `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.controller.ts`
- `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.ts`
- `services/api/src/modules/plano-aula-periodo/dto/plano-aula-periodo.dto.ts`
- `services/api/src/app.module.ts`
- `apps/planejamento/app/page.tsx`
- `apps/planejamento/app/planejamentos/turmas/turmas-content.tsx`
- `apps/planejamento/app/plano-aula/[quinzenaId]/plano-content.tsx`
- `apps/planejamento/app/analise/analise-content.tsx`
- `apps/planejamento/app/analise/[planoId]/revisao-content.tsx`
- `apps/planejamento/app/gestao/periodos/periodos-content.tsx`
- `apps/planejamento/features/plano-aula/index.ts`
- `apps/planejamento/features/plano-aula/types.ts`
- `apps/planejamento/features/plano-aula/hooks/`
- `apps/planejamento/lib/role-groups.ts`

Regras de execução:

- Comunicação, comentários, documentação e commits em Português do Brasil.
- Rode `pnpm turbo lint && pnpm turbo typecheck` antes de cada commit.
- Use `superpowers:test-driven-development` em cada mudança de comportamento (teste falha → implementa → passa).
- Preserve arquivos locais não relacionados: `apps/loja*`, `nginx.conf`, backup `.sql`.

---

## Mapa de Arquivos

### Criar (novos)

```
packages/db/src/schema/semana-relatorio.ts
packages/db/src/schema/relatorio.ts
packages/db/src/schema/relatorio-historico.ts

services/api/src/modules/semana-relatorio/dto/semana-relatorio.dto.ts
services/api/src/modules/semana-relatorio/semana-relatorio.service.ts
services/api/src/modules/semana-relatorio/semana-relatorio.service.spec.ts
services/api/src/modules/semana-relatorio/semana-relatorio.controller.ts
services/api/src/modules/semana-relatorio/semana-relatorio.module.ts

services/api/src/modules/relatorio/dto/relatorio.dto.ts
services/api/src/modules/relatorio/relatorio-historico.service.ts
services/api/src/modules/relatorio/relatorio-historico.service.spec.ts
services/api/src/modules/relatorio/relatorio-pdf-queue.service.ts
services/api/src/modules/relatorio/relatorio-pdf-worker.service.ts
services/api/src/modules/relatorio/relatorio.service.ts
services/api/src/modules/relatorio/relatorio.service.spec.ts
services/api/src/modules/relatorio/relatorio.controller.ts
services/api/src/modules/relatorio/relatorio.controller.spec.ts
services/api/src/modules/relatorio/relatorio.module.ts

apps/planejamento/features/relatorio/types.ts
apps/planejamento/features/relatorio/hooks/use-relatorio.ts
apps/planejamento/features/relatorio/hooks/use-analista-relatorio.ts
apps/planejamento/features/relatorio/hooks/use-gestao-relatorio.ts
apps/planejamento/features/relatorio/hooks/use-semanas-relatorio.ts
apps/planejamento/features/relatorio/index.ts

apps/planejamento/app/relatorios/turmas/page.tsx
apps/planejamento/app/relatorios/turmas/turmas-content.tsx
apps/planejamento/app/relatorios/[semanaId]/page.tsx
apps/planejamento/app/relatorios/[semanaId]/relatorio-content.tsx
apps/planejamento/app/relatorios/analise/page.tsx
apps/planejamento/app/relatorios/analise/analise-content.tsx
apps/planejamento/app/relatorios/analise/[relatorioId]/page.tsx
apps/planejamento/app/relatorios/analise/[relatorioId]/revisao-content.tsx
apps/planejamento/app/relatorios/gestao/page.tsx
apps/planejamento/app/relatorios/gestao/dashboard-content.tsx
apps/planejamento/app/relatorios/gestao/semanas/page.tsx
apps/planejamento/app/relatorios/gestao/semanas/semanas-content.tsx
apps/planejamento/app/relatorios/gestao/relatorios/page.tsx
apps/planejamento/app/relatorios/gestao/relatorios/relatorios-content.tsx
```

### Modificar (existentes)

```
packages/db/src/schema/index.ts          — adicionar 3 exports
services/api/src/app.module.ts           — registrar RelatorioModule e SemanaRelatorioModule
apps/planejamento/app/page.tsx           — terceiro card Relatórios
apps/planejamento/lib/role-groups.ts     — getRelatorioUrl helper
```

---

## Fase 1 — Schema do Banco de Dados

### Tarefa 1: Schema `semana_relatorio`

**Arquivos:**
- Criar: `packages/db/src/schema/semana-relatorio.ts`

- [ ] **Passo 1: Criar o arquivo de schema**

```typescript
// packages/db/src/schema/semana-relatorio.ts
import { relations } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { relatorio } from "./relatorio.js";
import { units } from "./units.js";
import { users } from "./users.js";

export const semanaRelatorioEtapaEnum = ["BERCARIO", "INFANTIL"] as const;
export type SemanaRelatorioEtapa = (typeof semanaRelatorioEtapaEnum)[number];

export const semanaRelatorio = pgTable(
  "semana_relatorio",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unidadeId: uuid("unidade_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    etapa: text("etapa", { enum: semanaRelatorioEtapaEnum }).notNull(),
    numero: integer("numero").notNull(),
    descricao: text("descricao"),
    dataInicio: date("data_inicio").notNull(),
    dataFim: date("data_fim").notNull(),
    dataMaximaEntrega: date("data_maxima_entrega").notNull(),
    criadoPor: uuid("criado_por").references(() => users.id),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    semanaNumeroEtapaUnidadeIdx: uniqueIndex(
      "semana_relatorio_unidade_etapa_numero_unique",
    ).on(table.unidadeId, table.etapa, table.numero),
    unidadeIdx: index("idx_semana_relatorio_unidade").on(table.unidadeId),
    etapaIdx: index("idx_semana_relatorio_etapa").on(table.etapa),
    datasIdx: index("idx_semana_relatorio_datas").on(
      table.dataInicio,
      table.dataFim,
    ),
  }),
);

export const semanaRelatorioRelations = relations(
  semanaRelatorio,
  ({ one, many }) => ({
    unidade: one(units, {
      fields: [semanaRelatorio.unidadeId],
      references: [units.id],
    }),
    criadoPorUser: one(users, {
      fields: [semanaRelatorio.criadoPor],
      references: [users.id],
    }),
    relatorios: many(relatorio),
  }),
);

export type SemanaRelatorio = typeof semanaRelatorio.$inferSelect;
export type NewSemanaRelatorio = typeof semanaRelatorio.$inferInsert;

export const insertSemanaRelatorioSchema = createInsertSchema(semanaRelatorio);
export const selectSemanaRelatorioSchema = createSelectSchema(semanaRelatorio);
```

> **Nota:** `semana-relatorio.ts` importa `relatorio.ts` que ainda não existe. Crie ambos os arquivos antes de rodar o build, ou use referência circular via `./relatorio.js` apenas depois de criar a tarefa 2.

- [ ] **Passo 2: Commit parcial (aguardar Tarefa 2 para build passar)**

---

### Tarefa 2: Schema `relatorio` e `relatorio_documento`

**Arquivos:**
- Criar: `packages/db/src/schema/relatorio.ts`

- [ ] **Passo 1: Criar arquivo de schema**

```typescript
// packages/db/src/schema/relatorio.ts
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { documentoTipoEnum, pdfStatusEnum } from "./plano-aula.js";
import { semanaRelatorio } from "./semana-relatorio.js";
import { turmas } from "./turmas.js";
import { units } from "./units.js";
import { users } from "./users.js";

// Re-exportar para conveniência nos consumers
export { documentoTipoEnum, pdfStatusEnum } from "./plano-aula.js";

export const relatorioStatusEnum = [
  "RASCUNHO",
  "AGUARDANDO_ANALISTA",
  "AGUARDANDO_COORDENADORA",
  "DEVOLVIDO_ANALISTA",
  "DEVOLVIDO_COORDENADORA",
  "REVISAO_ANALISTA",
  "APROVADO",
  "RECUPERADO",
] as const;
export type RelatorioStatus = (typeof relatorioStatusEnum)[number];

// ============================================
// Table: relatorio (Mestre)
// ============================================
export const relatorio = pgTable(
  "relatorio",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    turmaId: uuid("turma_id")
      .notNull()
      .references(() => turmas.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    semanaRelatorioId: uuid("semana_relatorio_id").references(
      () => semanaRelatorio.id,
      { onDelete: "restrict" },
    ),
    // UUID de roteamento — identifica a semana na URL,
    // análogo ao quinzenaId do plano-aula.
    semanaId: uuid("semana_id").notNull(),
    status: text("status", { enum: relatorioStatusEnum })
      .notNull()
      .default("RASCUNHO"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    statusIdx: index("relatorio_status_idx").on(table.status),
    semanaIdIdx: index("relatorio_semana_id_idx").on(table.semanaId),
    unitIdIdx: index("relatorio_unit_id_idx").on(table.unitId),
    userIdx: index("relatorio_user_idx").on(table.userId),
    semanaRelatorioIdx: index("relatorio_semana_relatorio_id_idx").on(
      table.semanaRelatorioId,
    ),
    uniqueRelatorioIdx: uniqueIndex(
      "relatorio_user_turma_semana_unique",
    ).on(table.userId, table.turmaId, table.semanaId),
  }),
);

// ============================================
// Table: relatorio_documento (N:1 para relatorio)
// ============================================
export const relatorioDocumento = pgTable(
  "relatorio_documento",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    relatorioId: uuid("relatorio_id")
      .notNull()
      .references(() => relatorio.id, { onDelete: "cascade" }),
    tipo: text("tipo", { enum: documentoTipoEnum }).notNull(),
    storageKey: varchar("storage_key", { length: 500 }),
    url: varchar("url", { length: 1000 }),
    fileName: varchar("file_name", { length: 255 }),
    fileSize: integer("file_size"),
    mimeType: varchar("mime_type", { length: 100 }),
    sharepointItemId: text("sharepoint_item_id"),
    sharepointEditUrl: text("sharepoint_edit_url"),
    editandoDesde: timestamp("editando_desde", { withTimezone: true }),
    pdfStorageKey: varchar("pdf_storage_key", { length: 500 }),
    pdfUrl: varchar("pdf_url", { length: 1000 }),
    pdfStatus: text("pdf_status", { enum: pdfStatusEnum })
      .notNull()
      .default("NAO_APLICAVEL"),
    pdfError: text("pdf_error"),
    pdfRequestedAt: timestamp("pdf_requested_at", { withTimezone: true }),
    pdfGeneratedAt: timestamp("pdf_generated_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    printedBy: uuid("printed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    printedAt: timestamp("printed_at", { withTimezone: true }),
    temComentarios: boolean("tem_comentarios").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    relatorioIdIdx: index("relatorio_documento_relatorio_id_idx").on(
      table.relatorioId,
    ),
  }),
);

// ============================================
// Relations
// ============================================
export const relatorioRelations = relations(relatorio, ({ one, many }) => ({
  user: one(users, { fields: [relatorio.userId], references: [users.id] }),
  turma: one(turmas, { fields: [relatorio.turmaId], references: [turmas.id] }),
  unit: one(units, { fields: [relatorio.unitId], references: [units.id] }),
  semana: one(semanaRelatorio, {
    fields: [relatorio.semanaRelatorioId],
    references: [semanaRelatorio.id],
  }),
  documentos: many(relatorioDocumento),
}));

export const relatorioDocumentoRelations = relations(
  relatorioDocumento,
  ({ one }) => ({
    relatorio: one(relatorio, {
      fields: [relatorioDocumento.relatorioId],
      references: [relatorio.id],
    }),
    approvedByUser: one(users, {
      fields: [relatorioDocumento.approvedBy],
      references: [users.id],
    }),
    printedByUser: one(users, {
      fields: [relatorioDocumento.printedBy],
      references: [users.id],
    }),
  }),
);

// Types
export type Relatorio = typeof relatorio.$inferSelect;
export type NewRelatorio = typeof relatorio.$inferInsert;
export type RelatorioDocumento = typeof relatorioDocumento.$inferSelect;
export type NewRelatorioDocumento = typeof relatorioDocumento.$inferInsert;

// Zod schemas
export const insertRelatorioSchema = createInsertSchema(relatorio);
export const selectRelatorioSchema = createSelectSchema(relatorio);
export const insertRelatorioDocumentoSchema =
  createInsertSchema(relatorioDocumento);
export const selectRelatorioDocumentoSchema =
  createSelectSchema(relatorioDocumento);
```

- [ ] **Passo 2: Verificar que o build do pacote db não quebra**

```bash
cd packages/db && pnpm build
```

Esperado: saída sem erros de TypeScript.

- [ ] **Passo 3: Commit**

```bash
git add packages/db/src/schema/semana-relatorio.ts packages/db/src/schema/relatorio.ts
git commit -m "feat(db): schema semana_relatorio, relatorio e relatorio_documento"
```

---

### Tarefa 3: Schema `relatorio_historico`

**Arquivos:**
- Criar: `packages/db/src/schema/relatorio-historico.ts`

- [ ] **Passo 1: Criar arquivo**

```typescript
// packages/db/src/schema/relatorio-historico.ts
import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { relatorio } from "./relatorio.js";
import { users } from "./users.js";

export const relatorioHistoricoAcaoEnum = [
  "CRIADO",
  "SUBMETIDO",
  "APROVADO_ANALISTA",
  "DEVOLVIDO_ANALISTA",
  "APROVADO_COORDENADORA",
  "DEVOLVIDO_COORDENADORA",
  "DOCUMENTO_IMPRESSO",
  "RECUPERADO",
  "COMENTARIO_ADICIONADO",
] as const;
export type RelatorioHistoricoAcao =
  (typeof relatorioHistoricoAcaoEnum)[number];

export const relatorioHistorico = pgTable(
  "relatorio_historico",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    relatorioId: uuid("relatorio_id")
      .notNull()
      .references(() => relatorio.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    userName: text("user_name").notNull(),
    userRole: text("user_role").notNull(),
    acao: text("acao", { enum: relatorioHistoricoAcaoEnum }).notNull(),
    statusAnterior: text("status_anterior"),
    statusNovo: text("status_novo").notNull(),
    detalhes: jsonb("detalhes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    relatorioIdIdx: index("relatorio_historico_relatorio_id_idx").on(
      table.relatorioId,
    ),
    createdAtIdx: index("relatorio_historico_created_at_idx").on(
      table.createdAt,
    ),
  }),
);

export const relatorioHistoricoRelations = relations(
  relatorioHistorico,
  ({ one }) => ({
    relatorio: one(relatorio, {
      fields: [relatorioHistorico.relatorioId],
      references: [relatorio.id],
    }),
    user: one(users, {
      fields: [relatorioHistorico.userId],
      references: [users.id],
    }),
  }),
);

export type RelatorioHistorico = typeof relatorioHistorico.$inferSelect;
export type NewRelatorioHistorico = typeof relatorioHistorico.$inferInsert;

export const insertRelatorioHistoricoSchema =
  createInsertSchema(relatorioHistorico);
export const selectRelatorioHistoricoSchema =
  createSelectSchema(relatorioHistorico);
```

- [ ] **Passo 2: Exportar do index**

Abra `packages/db/src/schema/index.ts` e adicione ao final:

```typescript
export * from "./semana-relatorio.js";
export * from "./relatorio.js";
export * from "./relatorio-historico.js";
```

- [ ] **Passo 3: Build e commit**

```bash
cd packages/db && pnpm build
git add packages/db/src/schema/relatorio-historico.ts packages/db/src/schema/index.ts
git commit -m "feat(db): schema relatorio_historico e exports do index"
```

---

### Tarefa 4: Migration Drizzle

**Arquivos:**
- Gera: `packages/db/drizzle/XXXX_create_relatorio_tables.sql` (nome gerado automaticamente)

- [ ] **Passo 1: Gerar a migration**

```bash
pnpm db:generate
```

Esperado: novo arquivo `.sql` em `packages/db/drizzle/` contendo `CREATE TABLE semana_relatorio`, `CREATE TABLE relatorio`, `CREATE TABLE relatorio_documento`, `CREATE TABLE relatorio_historico`.

- [ ] **Passo 2: Revisar o SQL gerado**

Abra o arquivo gerado e confirme:
- `semana_relatorio`: 4 índices (unique + 3 auxiliares)
- `relatorio`: 6 índices (unique + 5 auxiliares)
- `relatorio_documento`: 1 índice
- `relatorio_historico`: 2 índices

- [ ] **Passo 3: Aplicar em dev**

```bash
pnpm db:migrate
```

Esperado: `All migrations applied successfully` sem erros.

- [ ] **Passo 4: Verificar tabelas no banco**

```bash
docker exec essencia-postgres psql -U essencia -d essencia_db -c "\dt relatorio*" -c "\dt semana_relatorio*"
```

Esperado: 4 tabelas listadas.

- [ ] **Passo 5: Commit**

```bash
git add packages/db/drizzle/
git commit -m "feat(db): migration cria tabelas do módulo Relatórios"
```

---

## Fase 2 — Backend: Módulo `semana-relatorio`

### Tarefa 5: DTOs e Service `semana-relatorio`

**Arquivos:**
- Criar: `services/api/src/modules/semana-relatorio/dto/semana-relatorio.dto.ts`
- Criar: `services/api/src/modules/semana-relatorio/semana-relatorio.service.ts`
- Criar: `services/api/src/modules/semana-relatorio/semana-relatorio.service.spec.ts`

- [ ] **Passo 1: Escrever o teste falhando para `listarPorUnidade`**

```typescript
// services/api/src/modules/semana-relatorio/semana-relatorio.service.spec.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SemanaRelatorioService } from "./semana-relatorio.service";

vi.mock("@essencia/db", () => ({
  getDb: vi.fn(),
  eq: vi.fn((col, val) => ({ col, val })),
  and: vi.fn((...args) => args),
  asc: vi.fn((col) => col),
  semanaRelatorio: { unidadeId: "unidadeId", etapa: "etapa", numero: "numero" },
  turmas: { id: "id", unitId: "unitId", stageId: "stageId" },
  educationStages: { id: "id", code: "code" },
  relatorio: {},
}));

describe("SemanaRelatorioService", () => {
  let service: SemanaRelatorioService;
  let mockDb: { select: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const chainMock = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
      innerJoin: vi.fn().mockReturnThis(),
    };
    mockDb = { select: vi.fn().mockReturnValue(chainMock) };
    const { getDb } = require("@essencia/db");
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
    service = new SemanaRelatorioService();
  });

  it("listarPorUnidade retorna array vazio quando não há semanas", async () => {
    const result = await service.listarPorUnidade("unit-123");
    expect(Array.isArray(result)).toBe(true);
  });
});
```

- [ ] **Passo 2: Rodar e confirmar falha**

```bash
cd services/api && pnpm test --testPathPattern="semana-relatorio.service"
```

Esperado: `FAIL — Cannot find module './semana-relatorio.service'`

- [ ] **Passo 3: Criar os DTOs**

```typescript
// services/api/src/modules/semana-relatorio/dto/semana-relatorio.dto.ts
import { IsString, IsDateString, IsOptional, IsEnum, IsInt, Min } from "class-validator";

export class CriarSemanaRelatorioDto {
  @IsEnum(["BERCARIO", "INFANTIL"], {
    message: "Etapa deve ser BERCARIO ou INFANTIL",
  })
  etapa!: string;

  @IsInt()
  @Min(1)
  numero!: number;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsDateString()
  dataInicio!: string;

  @IsDateString()
  dataFim!: string;

  @IsDateString()
  dataMaximaEntrega!: string;
}

export class EditarSemanaRelatorioDto {
  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsDateString()
  dataMaximaEntrega?: string;
}
```

- [ ] **Passo 4: Criar o service**

```typescript
// services/api/src/modules/semana-relatorio/semana-relatorio.service.ts
import { Injectable, BadRequestException } from "@nestjs/common";
import { eq, and, asc, getDb } from "@essencia/db";
import {
  semanaRelatorio,
  relatorio,
  turmas,
  educationStages,
  type SemanaRelatorio,
} from "@essencia/db/schema";
import {
  CriarSemanaRelatorioDto,
  EditarSemanaRelatorioDto,
} from "./dto/semana-relatorio.dto";

@Injectable()
export class SemanaRelatorioService {
  private get db() {
    return getDb();
  }

  async listarPorUnidade(unidadeId: string) {
    const semanas: SemanaRelatorio[] = await this.db
      .select()
      .from(semanaRelatorio)
      .where(eq(semanaRelatorio.unidadeId, unidadeId))
      .orderBy(asc(semanaRelatorio.etapa), asc(semanaRelatorio.numero));

    return Promise.all(
      semanas.map(async (semana) => ({
        ...semana,
        relatoriosVinculados: await this.contarRelatoriosVinculados(semana.id),
      })),
    );
  }

  async buscarPorId(id: string, unitId: string) {
    const [semana] = await this.db
      .select()
      .from(semanaRelatorio)
      .where(
        and(
          eq(semanaRelatorio.id, id),
          eq(semanaRelatorio.unidadeId, unitId),
        ),
      );

    if (!semana) throw new BadRequestException("Semana não encontrada");
    return semana;
  }

  async buscarPorTurma(turmaId: string, unitId: string) {
    const [turma] = await this.db
      .select({
        turmaId: turmas.id,
        stageId: turmas.stageId,
        etapaCode: educationStages.code,
      })
      .from(turmas)
      .innerJoin(educationStages, eq(turmas.stageId, educationStages.id))
      .where(and(eq(turmas.id, turmaId), eq(turmas.unitId, unitId)));

    if (!turma) throw new BadRequestException("Turma não encontrada");

    const etapa = turma.etapaCode;
    if (etapa !== "BERCARIO" && etapa !== "INFANTIL") {
      throw new BadRequestException(
        "Esta turma não pertence a BERCARIO ou INFANTIL",
      );
    }

    return this.db
      .select()
      .from(semanaRelatorio)
      .where(
        and(
          eq(semanaRelatorio.unidadeId, unitId),
          eq(semanaRelatorio.etapa, etapa),
        ),
      )
      .orderBy(asc(semanaRelatorio.numero));
  }

  async criar(dto: CriarSemanaRelatorioDto, unitId: string, userId: string) {
    const [criada] = await this.db
      .insert(semanaRelatorio)
      .values({
        unidadeId: unitId,
        etapa: dto.etapa,
        numero: dto.numero,
        descricao: dto.descricao,
        dataInicio: dto.dataInicio,
        dataFim: dto.dataFim,
        dataMaximaEntrega: dto.dataMaximaEntrega,
        criadoPor: userId,
      })
      .returning();

    if (!criada) throw new BadRequestException("Falha ao criar semana");
    return criada;
  }

  async editar(id: string, dto: EditarSemanaRelatorioDto, unitId: string) {
    await this.buscarPorId(id, unitId);

    const campos: Partial<SemanaRelatorio> = {};
    if (dto.descricao !== undefined) campos.descricao = dto.descricao;
    if (dto.dataInicio) campos.dataInicio = dto.dataInicio;
    if (dto.dataFim) campos.dataFim = dto.dataFim;
    if (dto.dataMaximaEntrega)
      campos.dataMaximaEntrega = dto.dataMaximaEntrega;

    const [atualizada] = await this.db
      .update(semanaRelatorio)
      .set({ ...campos, atualizadoEm: new Date() })
      .where(eq(semanaRelatorio.id, id))
      .returning();

    return atualizada;
  }

  async excluir(id: string, unitId: string) {
    const vinculados = await this.contarRelatoriosVinculados(id);
    if (vinculados > 0) {
      throw new BadRequestException(
        `Não é possível excluir: ${vinculados} relatório(s) vinculado(s)`,
      );
    }
    await this.db
      .delete(semanaRelatorio)
      .where(
        and(eq(semanaRelatorio.id, id), eq(semanaRelatorio.unidadeId, unitId)),
      );
    return { success: true };
  }

  private async contarRelatoriosVinculados(semanaId: string): Promise<number> {
    const result = await this.db
      .select()
      .from(relatorio)
      .where(eq(relatorio.semanaRelatorioId, semanaId));
    return result.length;
  }
}
```

- [ ] **Passo 5: Rodar os testes**

```bash
cd services/api && pnpm test --testPathPattern="semana-relatorio.service"
```

Esperado: `PASS — 1 test passed`

- [ ] **Passo 6: Commit**

```bash
git add services/api/src/modules/semana-relatorio/
git commit -m "feat(api): service e DTOs do módulo semana-relatorio"
```

---

### Tarefa 6: Controller e Module `semana-relatorio`

**Arquivos:**
- Criar: `services/api/src/modules/semana-relatorio/semana-relatorio.controller.ts`
- Criar: `services/api/src/modules/semana-relatorio/semana-relatorio.module.ts`
- Modificar: `services/api/src/app.module.ts`

- [ ] **Passo 1: Criar o controller**

```typescript
// services/api/src/modules/semana-relatorio/semana-relatorio.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { SemanaRelatorioService } from "./semana-relatorio.service";
import {
  CriarSemanaRelatorioDto,
  EditarSemanaRelatorioDto,
} from "./dto/semana-relatorio.dto";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

type UserContext = {
  userId: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
  stageId: string | null;
};

const VISUALIZAR_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_geral",
  "coordenadora_bercario",
  "coordenadora_infantil",
  "analista_pedagogico",
  "professora",
  "auxiliar_sala",
] as const;

const GERENCIAR_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "coordenadora_geral",
  "coordenadora_bercario",
  "coordenadora_infantil",
] as const;

@Controller("semana-relatorio")
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
export class SemanaRelatorioController {
  constructor(private readonly service: SemanaRelatorioService) {}

  @Get()
  @Roles(...VISUALIZAR_ROLES)
  async listarSemanas(@CurrentUser() session: UserContext) {
    if (!session.unitId) throw new BadRequestException("unitId ausente");
    const data = await this.service.listarPorUnidade(session.unitId);
    return { success: true, data };
  }

  @Get("turma/:turmaId")
  @Roles(...VISUALIZAR_ROLES)
  async buscarPorTurma(
    @CurrentUser() session: UserContext,
    @Param("turmaId") turmaId: string,
  ) {
    if (!session.unitId) throw new BadRequestException("unitId ausente");
    const data = await this.service.buscarPorTurma(turmaId, session.unitId);
    return { success: true, data };
  }

  @Get(":id")
  @Roles(...VISUALIZAR_ROLES)
  async buscarSemana(
    @CurrentUser() session: UserContext,
    @Param("id") id: string,
  ) {
    if (!session.unitId) throw new BadRequestException("unitId ausente");
    const data = await this.service.buscarPorId(id, session.unitId);
    return { success: true, data };
  }

  @Post()
  @Roles(...GERENCIAR_ROLES)
  async criarSemana(
    @CurrentUser() session: UserContext,
    @Body() dto: CriarSemanaRelatorioDto,
  ) {
    if (!session.unitId) throw new BadRequestException("unitId ausente");
    const data = await this.service.criar(dto, session.unitId, session.userId);
    return { success: true, data };
  }

  @Patch(":id")
  @Roles(...GERENCIAR_ROLES)
  async editarSemana(
    @CurrentUser() session: UserContext,
    @Param("id") id: string,
    @Body() dto: EditarSemanaRelatorioDto,
  ) {
    if (!session.unitId) throw new BadRequestException("unitId ausente");
    const data = await this.service.editar(id, dto, session.unitId);
    return { success: true, data };
  }

  @Delete(":id")
  @Roles(...GERENCIAR_ROLES)
  async excluirSemana(
    @CurrentUser() session: UserContext,
    @Param("id") id: string,
  ) {
    if (!session.unitId) throw new BadRequestException("unitId ausente");
    await this.service.excluir(id, session.unitId);
    return { success: true };
  }
}
```

- [ ] **Passo 2: Criar o module**

```typescript
// services/api/src/modules/semana-relatorio/semana-relatorio.module.ts
import { Module } from "@nestjs/common";
import { SemanaRelatorioService } from "./semana-relatorio.service";
import { SemanaRelatorioController } from "./semana-relatorio.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  providers: [SemanaRelatorioService],
  controllers: [SemanaRelatorioController],
  exports: [SemanaRelatorioService],
})
export class SemanaRelatorioModule {}
```

- [ ] **Passo 3: Registrar em `app.module.ts`**

Abra `services/api/src/app.module.ts`. Adicione o import e o módulo no array `imports`:

```typescript
import { SemanaRelatorioModule } from "./modules/semana-relatorio/semana-relatorio.module";
// ...
// No array imports[] do AppModule, após PlanoAulaPeriodoModule:
SemanaRelatorioModule,
```

- [ ] **Passo 4: Typecheck**

```bash
pnpm turbo typecheck --filter=api
```

Esperado: sem erros.

- [ ] **Passo 5: Commit**

```bash
git add services/api/src/modules/semana-relatorio/ services/api/src/app.module.ts
git commit -m "feat(api): módulo semana-relatorio com controller e module"
```

---

## Fase 3 — Backend: Módulo `relatorio`

### Tarefa 7: Historico Service

**Arquivos:**
- Criar: `services/api/src/modules/relatorio/relatorio-historico.service.ts`
- Criar: `services/api/src/modules/relatorio/relatorio-historico.service.spec.ts`

- [ ] **Passo 1: Escrever teste falhando**

```typescript
// services/api/src/modules/relatorio/relatorio-historico.service.spec.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RelatorioHistoricoService } from "./relatorio-historico.service";

vi.mock("@essencia/db", () => ({
  getDb: vi.fn(),
  eq: vi.fn(),
  desc: vi.fn(),
  relatorioHistorico: { relatorioId: "relatorioId", createdAt: "createdAt" },
}));

describe("RelatorioHistoricoService", () => {
  let service: RelatorioHistoricoService;

  beforeEach(() => {
    const { getDb } = require("@essencia/db");
    const mockQuery = { findMany: vi.fn().mockResolvedValue([]) };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue({
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{
          id: "h-1", relatorioId: "r-1", userId: "u-1",
          userName: "Ana", userRole: "analista_pedagogico",
          acao: "SUBMETIDO", statusAnterior: null, statusNovo: "AGUARDANDO_ANALISTA",
          detalhes: null, createdAt: new Date(),
        }]) }),
      }),
      query: { relatorioHistorico: mockQuery },
    });
    service = new RelatorioHistoricoService();
  });

  it("registrar retorna HistoricoEntry com campos corretos", async () => {
    const entry = await service.registrar({
      relatorioId: "r-1",
      userId: "u-1",
      userName: "Ana",
      userRole: "analista_pedagogico",
      acao: "SUBMETIDO",
      statusAnterior: null,
      statusNovo: "AGUARDANDO_ANALISTA",
    });
    expect(entry.relatorioId).toBe("r-1");
    expect(entry.acao).toBe("SUBMETIDO");
  });
});
```

- [ ] **Passo 2: Confirmar falha**

```bash
cd services/api && pnpm test --testPathPattern="relatorio-historico.service"
```

Esperado: `FAIL — Cannot find module './relatorio-historico.service'`

- [ ] **Passo 3: Implementar o service**

```typescript
// services/api/src/modules/relatorio/relatorio-historico.service.ts
import { Injectable } from "@nestjs/common";
import { getDb, relatorioHistorico, eq, desc } from "@essencia/db";
import type { RelatorioHistoricoAcao } from "@essencia/db/schema";

export interface RelatorioHistoricoEntry {
  id: string;
  relatorioId: string;
  userId: string;
  userName: string;
  userRole: string;
  acao: RelatorioHistoricoAcao;
  statusAnterior: string | null;
  statusNovo: string;
  detalhes: Record<string, unknown> | null;
  createdAt: string;
}

@Injectable()
export class RelatorioHistoricoService {
  async registrar(params: {
    relatorioId: string;
    userId: string;
    userName: string;
    userRole: string;
    acao: RelatorioHistoricoAcao;
    statusAnterior: string | null;
    statusNovo: string;
    detalhes?: Record<string, unknown> | null;
  }): Promise<RelatorioHistoricoEntry> {
    const db = getDb();
    const [entry] = await db
      .insert(relatorioHistorico)
      .values({
        relatorioId: params.relatorioId,
        userId: params.userId,
        userName: params.userName,
        userRole: params.userRole,
        acao: params.acao,
        statusAnterior: params.statusAnterior,
        statusNovo: params.statusNovo,
        detalhes: params.detalhes ?? null,
      })
      .returning();

    if (!entry) throw new Error("Falha ao registrar histórico");
    return this.mapEntry(entry);
  }

  async buscarPorRelatorio(
    relatorioId: string,
  ): Promise<RelatorioHistoricoEntry[]> {
    const db = getDb();
    const entries = await db.query.relatorioHistorico.findMany({
      where: eq(relatorioHistorico.relatorioId, relatorioId),
      orderBy: [desc(relatorioHistorico.createdAt)],
    });
    return entries.map((e) => this.mapEntry(e));
  }

  private mapEntry(entry: {
    id: string;
    relatorioId: string;
    userId: string;
    userName: string;
    userRole: string;
    acao: string;
    statusAnterior: string | null;
    statusNovo: string;
    detalhes: unknown;
    createdAt: Date;
  }): RelatorioHistoricoEntry {
    return {
      id: entry.id,
      relatorioId: entry.relatorioId,
      userId: entry.userId,
      userName: entry.userName,
      userRole: entry.userRole,
      acao: entry.acao as RelatorioHistoricoAcao,
      statusAnterior: entry.statusAnterior,
      statusNovo: entry.statusNovo,
      detalhes: entry.detalhes as Record<string, unknown> | null,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
```

- [ ] **Passo 4: Testes passando**

```bash
cd services/api && pnpm test --testPathPattern="relatorio-historico.service"
```

Esperado: `PASS — 1 test passed`

- [ ] **Passo 5: Commit**

```bash
git add services/api/src/modules/relatorio/
git commit -m "feat(api): RelatorioHistoricoService com testes"
```

---

### Tarefa 8: PDF Queue e Worker Services

**Arquivos:**
- Criar: `services/api/src/modules/relatorio/relatorio-pdf-queue.service.ts`
- Criar: `services/api/src/modules/relatorio/relatorio-pdf-worker.service.ts`
- Criar: `services/api/src/modules/relatorio/relatorio-pdf-queue.service.spec.ts`

- [ ] **Passo 1: Criar o queue service**

```typescript
// services/api/src/modules/relatorio/relatorio-pdf-queue.service.ts
import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue, type ConnectionOptions } from "bullmq";
import Redis from "ioredis";

export const RELATORIO_PDF_QUEUE_NAME = "relatorio-pdf-impressao";
export const RELATORIO_PDF_JOB_NAME = "gerar-pdf-relatorio";

export interface RelatorioPdfJobData {
  documentoId: string;
}

@Injectable()
export class RelatorioPdfQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(RelatorioPdfQueueService.name);
  private readonly connection: Redis;
  private readonly queue: Queue<
    RelatorioPdfJobData,
    void,
    typeof RELATORIO_PDF_JOB_NAME
  >;

  constructor(private readonly configService: ConfigService) {
    const redisUrl =
      this.configService.get<string>("REDIS_URL") ?? "redis://localhost:6379";
    this.connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue<RelatorioPdfJobData, void, typeof RELATORIO_PDF_JOB_NAME>(
      RELATORIO_PDF_QUEUE_NAME,
      { connection: this.connection as unknown as ConnectionOptions },
    );
  }

  async adicionar(documentoId: string): Promise<void> {
    try {
      await this.queue.add(
        RELATORIO_PDF_JOB_NAME,
        { documentoId },
        {
          jobId: `relatorio-documento:${documentoId}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        },
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Falha ao enfileirar PDF do documento ${documentoId}: ${msg}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }
}
```

- [ ] **Passo 2: Criar o worker service**

```typescript
// services/api/src/modules/relatorio/relatorio-pdf-worker.service.ts
import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Worker, type ConnectionOptions, type Job } from "bullmq";
import Redis from "ioredis";

import { PdfGeneratorService } from "../../common/sharepoint/pdf-generator.service";
import {
  RELATORIO_PDF_JOB_NAME,
  RELATORIO_PDF_QUEUE_NAME,
  type RelatorioPdfJobData,
} from "./relatorio-pdf-queue.service";
import { RelatorioService } from "./relatorio.service";

@Injectable()
export class RelatorioPdfWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(RelatorioPdfWorkerService.name);
  private readonly connection: Redis;
  private readonly worker: Worker<RelatorioPdfJobData, void, typeof RELATORIO_PDF_JOB_NAME>;

  constructor(
    private readonly configService: ConfigService,
    private readonly relatorioService: RelatorioService,
    private readonly pdfGeneratorService: PdfGeneratorService,
  ) {
    const redisUrl =
      this.configService.get<string>("REDIS_URL") ?? "redis://localhost:6379";
    this.connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.worker = new Worker<RelatorioPdfJobData, void, typeof RELATORIO_PDF_JOB_NAME>(
      RELATORIO_PDF_QUEUE_NAME,
      async (job: Job<RelatorioPdfJobData>) => {
        await this.processarDocumento(job.data.documentoId);
      },
      {
        connection: this.connection as unknown as ConnectionOptions,
        concurrency: 2,
      },
    );
    this.worker.on("failed", (job, err) => {
      this.logger.error(`Job ${job?.id} falhou: ${err.message}`);
    });
  }

  private async processarDocumento(documentoId: string): Promise<void> {
    this.logger.log(`Gerando PDF para documento ${documentoId}`);
    await this.relatorioService.processarPdfDocumento(documentoId, this.pdfGeneratorService);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.connection.quit();
  }
}
```

- [ ] **Passo 3: Teste do queue service**

```typescript
// services/api/src/modules/relatorio/relatorio-pdf-queue.service.spec.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));
vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({ quit: vi.fn() })),
}));

describe("RelatorioPdfQueueService", () => {
  it("adicionar chama queue.add com jobId correto", async () => {
    const { ConfigService } = await import("@nestjs/config");
    const { RelatorioPdfQueueService } = await import("./relatorio-pdf-queue.service");
    const configMock = { get: vi.fn().mockReturnValue("redis://localhost:6379") } as unknown as InstanceType<typeof ConfigService>;
    const svc = new RelatorioPdfQueueService(configMock);
    await svc.adicionar("doc-123");
    const { Queue } = await import("bullmq");
    const queueInstance = (Queue as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(queueInstance.add).toHaveBeenCalledWith(
      "gerar-pdf-relatorio",
      { documentoId: "doc-123" },
      expect.objectContaining({ jobId: "relatorio-documento:doc-123" }),
    );
  });
});
```

- [ ] **Passo 4: Rodar testes**

```bash
cd services/api && pnpm test --testPathPattern="relatorio-pdf-queue"
```

Esperado: `PASS`

- [ ] **Passo 5: Commit**

```bash
git add services/api/src/modules/relatorio/relatorio-pdf-queue.service.ts \
        services/api/src/modules/relatorio/relatorio-pdf-worker.service.ts \
        services/api/src/modules/relatorio/relatorio-pdf-queue.service.spec.ts
git commit -m "feat(api): PDF queue e worker para relatórios"
```

---

### Tarefa 9: DTOs do módulo `relatorio`

**Arquivos:**
- Criar: `services/api/src/modules/relatorio/dto/relatorio.dto.ts`

- [ ] **Passo 1: Criar os DTOs**

```typescript
// services/api/src/modules/relatorio/dto/relatorio.dto.ts
import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsNotEmpty,
} from "class-validator";
import type { RelatorioStatus } from "@essencia/db/schema";

export class CreateRelatorioDto {
  @IsUUID()
  turmaId!: string;

  @IsUUID()
  semanaId!: string;

  @IsOptional()
  @IsUUID()
  semanaRelatorioId?: string;
}

export class DevolverRelatorioDto {
  @IsString()
  @IsNotEmpty()
  motivo!: string;
}

export class ListarRelatoriosGestaoDto {
  @IsOptional()
  @IsEnum(["BERCARIO", "INFANTIL"])
  etapa?: string;

  @IsOptional()
  @IsString()
  status?: RelatorioStatus;

  @IsOptional()
  @IsString()
  semanaId?: string;
}

// Roles helpers — espelho dos helpers de plano-aula.dto.ts
export const isAnalista = (role: string) => role === "analista_pedagogico";

export const isCoordenadora = (role: string) =>
  [
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_geral",
    "gerente_unidade",
    "diretora_geral",
    "master",
  ].includes(role);

export const isGestao = (role: string) =>
  [
    "master",
    "diretora_geral",
    "gerente_unidade",
    "gerente_financeiro",
    "coordenadora_geral",
    "coordenadora_bercario",
    "coordenadora_infantil",
    "analista_pedagogico",
  ].includes(role);

export const STATUS_URL_MAP: Record<RelatorioStatus, string> = {
  RASCUNHO: "rascunho",
  AGUARDANDO_ANALISTA: "aguardando-analista",
  AGUARDANDO_COORDENADORA: "aguardando-coordenadora",
  DEVOLVIDO_ANALISTA: "devolvido-analista",
  DEVOLVIDO_COORDENADORA: "devolvido-coordenadora",
  REVISAO_ANALISTA: "revisao-analista",
  APROVADO: "aprovado",
  RECUPERADO: "recuperado",
};
```

- [ ] **Passo 2: Commit**

```bash
git add services/api/src/modules/relatorio/dto/
git commit -m "feat(api): DTOs do módulo relatorio"
```

---

### Tarefa 10: RelatorioService — Operações da Professora

**Arquivos:**
- Criar: `services/api/src/modules/relatorio/relatorio.service.ts`
- Criar: `services/api/src/modules/relatorio/relatorio.service.spec.ts`

- [ ] **Passo 1: Escrever testes falhando para criar e validar etapa**

```typescript
// services/api/src/modules/relatorio/relatorio.service.spec.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BadRequestException } from "@nestjs/common";

vi.mock("@essencia/db", () => ({
  getDb: vi.fn(),
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  and: vi.fn((...args) => ({ and: args })),
  or: vi.fn((...args) => ({ or: args })),
  desc: vi.fn((c) => c),
  ne: vi.fn(),
  inArray: vi.fn(),
  relatorio: { id: "id", userId: "userId", turmaId: "turmaId", unitId: "unitId", semanaId: "semanaId", status: "status" },
  relatorioDocumento: { id: "id", relatorioId: "relatorioId", pdfStatus: "pdfStatus" },
  turmas: { id: "id", unitId: "unitId", stageId: "stageId" },
  educationStages: { id: "id", code: "code" },
  users: { id: "id", name: "name" },
}));

describe("RelatorioService.criar", () => {
  let service: { criar: (dto: unknown, session: unknown) => Promise<unknown> };

  beforeEach(async () => {
    const { getDb } = require("@essencia/db");
    // Turma com etapa FUNDAMENTAL_I (inválida para relatório)
    const chainSelect = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        { turmaId: "t-1", stageId: "s-1", etapaCode: "FUNDAMENTAL_I" },
      ]),
    };
    (getDb as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue(chainSelect),
    });
    const { RelatorioService } = await import("./relatorio.service");
    const mockHistorico = { registrar: vi.fn() } as unknown as import("./relatorio-historico.service").RelatorioHistoricoService;
    const mockStorage = {} as unknown as import("../../common/storage/storage.service").StorageService;
    const mockQueue = { adicionar: vi.fn() } as unknown as import("./relatorio-pdf-queue.service").RelatorioPdfQueueService;
    service = new RelatorioService(mockHistorico, mockStorage, mockQueue);
  });

  it("rejeita turma de etapa não infantil", async () => {
    await expect(
      service.criar(
        { turmaId: "t-1", semanaId: "s-1" },
        { userId: "u-1", role: "professora", unitId: "unit-1" },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Passo 2: Confirmar falha**

```bash
cd services/api && pnpm test --testPathPattern="relatorio.service.spec"
```

Esperado: `FAIL — Cannot find module './relatorio.service'`

- [ ] **Passo 3: Implementar o service (operações da professora)**

Crie `services/api/src/modules/relatorio/relatorio.service.ts` com o conteúdo completo. Leia `services/api/src/modules/plano-aula/plano-aula.service.ts` como referência de implementação e adapte:

- Substitua `planoAula` → `relatorio`, `planoDocumento` → `relatorioDocumento`, `quinzenaId` → `semanaId`
- Adicione a validação de etapa em `criar()`:

```typescript
// Trecho crítico dentro do método criar():
const [turma] = await this.db
  .select({
    turmaId: turmas.id,
    stageId: turmas.stageId,
    etapaCode: educationStages.code,
  })
  .from(turmas)
  .innerJoin(educationStages, eq(turmas.stageId, educationStages.id))
  .where(and(eq(turmas.id, dto.turmaId), eq(turmas.unitId, session.unitId)));

if (!turma) throw new BadRequestException("Turma não encontrada");
if (turma.etapaCode !== "BERCARIO" && turma.etapaCode !== "INFANTIL") {
  throw new BadRequestException(
    "Relatórios são exclusivos para turmas BERCARIO e INFANTIL",
  );
}
```

- O método `processarPdfDocumento(documentoId, pdfGeneratorService)` deve seguir o padrão do `PlanoAulaService.processarPdfDocumento` — leia o original antes de implementar.

- [ ] **Passo 4: Rodar os testes**

```bash
cd services/api && pnpm test --testPathPattern="relatorio.service.spec"
```

Esperado: `PASS — 1 test passed`

- [ ] **Passo 5: Commit**

```bash
git add services/api/src/modules/relatorio/relatorio.service.ts \
        services/api/src/modules/relatorio/relatorio.service.spec.ts
git commit -m "feat(api): RelatorioService com validação de etapa"
```

---

### Tarefa 11: RelatorioController + RelatorioModule + Registro

**Arquivos:**
- Criar: `services/api/src/modules/relatorio/relatorio.controller.ts`
- Criar: `services/api/src/modules/relatorio/relatorio.controller.spec.ts`
- Criar: `services/api/src/modules/relatorio/relatorio.module.ts`
- Modificar: `services/api/src/app.module.ts`

- [ ] **Passo 1: Escrever teste do controller**

```typescript
// services/api/src/modules/relatorio/relatorio.controller.spec.ts
import { describe, it, expect, vi } from "vitest";

describe("RelatorioController guards", () => {
  it("define rotas básicas sem erros de import", async () => {
    vi.mock("./relatorio.service", () => ({ RelatorioService: vi.fn() }));
    vi.mock("../../common/guards/auth.guard", () => ({ AuthGuard: vi.fn() }));
    vi.mock("../../common/guards/roles.guard", () => ({ RolesGuard: vi.fn() }));
    vi.mock("../../common/guards/tenant.guard", () => ({ TenantGuard: vi.fn() }));
    const mod = await import("./relatorio.controller");
    expect(mod.RelatorioController).toBeDefined();
  });
});
```

- [ ] **Passo 2: Criar o controller**

Leia `services/api/src/modules/plano-aula/plano-aula.controller.ts` na íntegra. Copie a estrutura e adapte:
- `@Controller("plano-aula")` → `@Controller("relatorio")`
- `PlanoAulaService` → `RelatorioService`
- `planoId` → `relatorioId` nos `@Param`
- Mantenha todos os 27 endpoints da spec: criar, listar, buscar, historico, submeter, recuperar, upload, youtube, atualizar, deletar documento, download, editar-word, sharepoint, sincronizar-word, pendentes analista, aprovar/devolver analista, pendentes coordenadora, aprovar/devolver coordenadora, dashboard, lista gestão, deletar, aprovar/desaprovar documento, regerar-pdf, imprimir
- Roles de edição Word: adicione `analista_pedagogico` além dos roles de professora (para revisão)

- [ ] **Passo 3: Criar o module**

```typescript
// services/api/src/modules/relatorio/relatorio.module.ts
import { Module } from "@nestjs/common";
import { SharePointModule } from "../../common/sharepoint/sharepoint.module";
import { StorageModule } from "../../common/storage/storage.module";
import { AuthModule } from "../auth/auth.module";
import { PlanejamentoObservabilidadeProvidersModule } from "../planejamento-observabilidade/planejamento-observabilidade.module";
import { RelatorioController } from "./relatorio.controller";
import { RelatorioHistoricoService } from "./relatorio-historico.service";
import { RelatorioPdfQueueService } from "./relatorio-pdf-queue.service";
import { RelatorioPdfWorkerService } from "./relatorio-pdf-worker.service";
import { RelatorioService } from "./relatorio.service";

@Module({
  imports: [
    AuthModule,
    StorageModule.forRoot(),
    SharePointModule,
    PlanejamentoObservabilidadeProvidersModule,
  ],
  controllers: [RelatorioController],
  providers: [
    RelatorioService,
    RelatorioHistoricoService,
    RelatorioPdfQueueService,
    RelatorioPdfWorkerService,
  ],
  exports: [RelatorioService],
})
export class RelatorioModule {}
```

- [ ] **Passo 4: Registrar no AppModule**

```typescript
// Em services/api/src/app.module.ts — adicionar:
import { RelatorioModule } from "./modules/relatorio/relatorio.module";
// No array imports[]:
RelatorioModule,
```

- [ ] **Passo 5: Typecheck e lint**

```bash
pnpm turbo lint && pnpm turbo typecheck --filter=api
```

Esperado: sem erros.

- [ ] **Passo 6: Commit**

```bash
git add services/api/src/modules/relatorio/ services/api/src/app.module.ts
git commit -m "feat(api): módulo relatorio completo com controller, module e registro"
```

---

## Fase 4 — Frontend

### Tarefa 12: Feature folder `relatorio`

**Arquivos:**
- Criar: `apps/planejamento/features/relatorio/types.ts`
- Criar: `apps/planejamento/features/relatorio/hooks/use-relatorio.ts`
- Criar: `apps/planejamento/features/relatorio/hooks/use-analista-relatorio.ts`
- Criar: `apps/planejamento/features/relatorio/hooks/use-gestao-relatorio.ts`
- Criar: `apps/planejamento/features/relatorio/hooks/use-semanas-relatorio.ts`
- Criar: `apps/planejamento/features/relatorio/index.ts`

- [ ] **Passo 1: Criar `types.ts`**

```typescript
// apps/planejamento/features/relatorio/types.ts
export type RelatorioStatus =
  | "RASCUNHO"
  | "AGUARDANDO_ANALISTA"
  | "AGUARDANDO_COORDENADORA"
  | "DEVOLVIDO_ANALISTA"
  | "DEVOLVIDO_COORDENADORA"
  | "REVISAO_ANALISTA"
  | "APROVADO"
  | "RECUPERADO";

export type DocumentoTipo = "ARQUIVO" | "LINK_YOUTUBE";
export type PdfStatus = "NAO_APLICAVEL" | "PENDENTE" | "GERANDO" | "PRONTO" | "ERRO";

export interface RelatorioDocumento {
  id: string;
  relatorioId: string;
  tipo: DocumentoTipo;
  url?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  pdfUrl?: string | null;
  pdfStatus: PdfStatus;
  approvedAt?: string | null;
  printedAt?: string | null;
  sharepointEditUrl?: string | null;
  editandoDesde?: string | null;
  temComentarios: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Relatorio {
  id: string;
  userId: string;
  turmaId: string;
  unitId: string;
  semanaId: string;
  semanaRelatorioId?: string | null;
  status: RelatorioStatus;
  submittedAt?: string | null;
  approvedAt?: string | null;
  documentos: RelatorioDocumento[];
  user: { id: string; name: string };
  turma: { id: string; name: string; code: string; stageId: string };
  createdAt: string;
  updatedAt: string;
}

export interface RelatorioSummary {
  id: string;
  status: RelatorioStatus;
  turma: { id: string; name: string; code: string };
  user: { id: string; name: string };
  semanaId: string;
  submittedAt?: string | null;
  documentos: Array<{ id: string; pdfStatus: PdfStatus }>;
}

export interface SemanaRelatorio {
  id: string;
  unidadeId: string;
  etapa: "BERCARIO" | "INFANTIL";
  numero: number;
  descricao?: string | null;
  dataInicio: string;
  dataFim: string;
  dataMaximaEntrega: string;
  relatoriosVinculados?: number;
}

export const STATUS_LABELS: Record<RelatorioStatus, string> = {
  RASCUNHO: "Rascunho",
  AGUARDANDO_ANALISTA: "Aguardando Analista",
  AGUARDANDO_COORDENADORA: "Aguardando Coordenadora",
  DEVOLVIDO_ANALISTA: "Devolvido pela Analista",
  DEVOLVIDO_COORDENADORA: "Devolvido pela Coordenadora",
  REVISAO_ANALISTA: "Em Revisão",
  APROVADO: "Aprovado",
  RECUPERADO: "Recuperado",
};

export const STATUS_COLORS: Record<RelatorioStatus, string> = {
  RASCUNHO: "bg-gray-100 text-gray-700",
  AGUARDANDO_ANALISTA: "bg-yellow-100 text-yellow-800",
  AGUARDANDO_COORDENADORA: "bg-blue-100 text-blue-800",
  DEVOLVIDO_ANALISTA: "bg-orange-100 text-orange-800",
  DEVOLVIDO_COORDENADORA: "bg-red-100 text-red-800",
  REVISAO_ANALISTA: "bg-purple-100 text-purple-800",
  APROVADO: "bg-green-100 text-green-800",
  RECUPERADO: "bg-gray-100 text-gray-600",
};
```

- [ ] **Passo 2: Criar `hooks/use-relatorio.ts`**

Leia `apps/planejamento/features/plano-aula/hooks/` como referência. Crie `use-relatorio.ts` espelhando `use-plano-aula.ts` com:
- `api.get("/relatorio")` → listar
- `api.post("/relatorio")` → criar
- `api.post("/relatorio/:id/submeter")` → submeter
- `api.post("/relatorio/:id/recuperar")` → recuperar
- `api.get("/relatorio/:id")` → buscar por ID
- `api.get("/relatorio/:id/historico")` → histórico
- Upload/download via endpoints `/relatorio/:id/documento/...`
- Edição Word: `editar-word`, `sharepoint`, `sincronizar-word`

- [ ] **Passo 3: Criar `hooks/use-analista-relatorio.ts`**

Espelha `use-plano-aula.ts` (parte analista):
- `api.get("/relatorio/analise/pendentes")` → listar pendentes
- `api.post("/relatorio/:id/aprovar-analista")` → aprovar
- `api.post("/relatorio/:id/devolver-analista")` → devolver
- `api.post("/relatorio/:id/documento/:docId/aprovar")` → aprovar documento
- Edição Word do analista via mesmos endpoints que a professora

- [ ] **Passo 4: Criar `hooks/use-gestao-relatorio.ts`**

- `api.get("/relatorio/gestao/dashboard")` → dashboard
- `api.get("/relatorio/gestao/lista")` → listagem
- `api.post("/relatorio/:id/aprovar-coordenadora")` → aprovar
- `api.post("/relatorio/:id/devolver-coordenadora")` → devolver

- [ ] **Passo 5: Criar `hooks/use-semanas-relatorio.ts`**

- `api.get("/semana-relatorio")` → listar
- `api.get("/semana-relatorio/turma/:turmaId")` → por turma
- `api.post("/semana-relatorio")` → criar
- `api.patch("/semana-relatorio/:id")` → editar
- `api.delete("/semana-relatorio/:id")` → excluir

- [ ] **Passo 6: Criar o barrel `index.ts`**

```typescript
// apps/planejamento/features/relatorio/index.ts
export type {
  RelatorioStatus,
  DocumentoTipo,
  PdfStatus,
  RelatorioDocumento,
  Relatorio,
  RelatorioSummary,
  SemanaRelatorio,
} from "./types";
export { STATUS_LABELS, STATUS_COLORS } from "./types";
export { useRelatorio } from "./hooks/use-relatorio";
export { useAnalistaRelatorio } from "./hooks/use-analista-relatorio";
export { useGestaoRelatorio } from "./hooks/use-gestao-relatorio";
export { useSemanaRelatorio } from "./hooks/use-semanas-relatorio";
```

- [ ] **Passo 7: Typecheck**

```bash
pnpm turbo typecheck --filter=planejamento
```

Esperado: sem erros.

- [ ] **Passo 8: Commit**

```bash
git add apps/planejamento/features/relatorio/
git commit -m "feat(planejamento): feature folder relatorio com tipos e hooks"
```

---

### Tarefa 13: Home page — card Relatórios

**Arquivos:**
- Modificar: `apps/planejamento/app/page.tsx`

- [ ] **Passo 1: Adicionar helper `getRelatorioUrl` e card**

Abra `apps/planejamento/app/page.tsx`. Adicione após a função `getProvaUrl`:

```typescript
function getRelatorioUrl(dashboardType: string): string {
  switch (dashboardType) {
    case "professora":
      return "/relatorios/turmas";
    case "analise":
      return "/relatorios/analise";
    case "gestao":
      return "/relatorios/gestao";
    default:
      return "/relatorios/turmas";
  }
}
```

- [ ] **Passo 2: Adicionar estado para turmas infantil**

```typescript
// Dentro de HomePage, após as declarações existentes:
const [temTurmaInfantil, setTemTurmaInfantil] = useState<boolean | null>(null);

useEffect(() => {
  if (dashboardType !== "professora") return;
  api
    .get<{ temInfantil: boolean }>("/relatorio/tem-turma-infantil")
    .then((res) => setTemTurmaInfantil(res.temInfantil))
    .catch(() => setTemTurmaInfantil(false));
}, [dashboardType]);
```

> **Nota:** adicione o endpoint `GET /relatorio/tem-turma-infantil` no `RelatorioController` para retornar `{ temInfantil: boolean }`. O service deve buscar as turmas da professora e verificar se alguma tem etapa BERCARIO ou INFANTIL. Crie esse endpoint como parte desta tarefa antes de finalizar o frontend.

- [ ] **Passo 3: Adicionar o card no grid**

No JSX de `HomePage`, dentro do `<div className="grid ...">`, adicione o terceiro card após o card de Provas. A condição de visibilidade:

```typescript
{/* Card Relatórios — só para roles com acesso */}
{(dashboardType === "analise" ||
  dashboardType === "gestao" ||
  (dashboardType === "professora" && temTurmaInfantil === true)) && (
  <Card
    className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 hover:scale-[1.02]"
    onClick={() => {
      const relatorioUrl = getRelatorioUrl(dashboardType);
      if (dashboardType === "professora") {
        window.location.href = `/planejamento${relatorioUrl}`;
      } else {
        router.push(relatorioUrl);
      }
    }}
  >
    <CardContent className="flex flex-col items-center gap-4 p-8">
      <div className="rounded-xl bg-primary/10 p-4">
        <BookOpen className="h-10 w-10 text-primary" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold">Relatórios</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Relatórios semanais da educação infantil
        </p>
      </div>
    </CardContent>
  </Card>
)}
```

Adicione `BookOpen` ao import do lucide-react.

- [ ] **Passo 4: Adicionar endpoint `tem-turma-infantil` no backend**

Em `relatorio.controller.ts`, antes dos outros endpoints:

```typescript
@Get("tem-turma-infantil")
@Roles("professora", "auxiliar_sala")
async temTurmaInfantil(@CurrentUser() session: UserContext) {
  if (!session.unitId) return { success: true, data: { temInfantil: false } };
  const temInfantil = await this.service.verificarTurmaInfantil(
    session.userId,
    session.unitId,
  );
  return { success: true, data: { temInfantil } };
}
```

E no service, adicione `verificarTurmaInfantil(userId, unitId)` que consulta turmas do usuário filtrando por etapa BERCARIO ou INFANTIL.

- [ ] **Passo 5: Lint e typecheck**

```bash
pnpm turbo lint && pnpm turbo typecheck --filter=planejamento
```

- [ ] **Passo 6: Commit**

```bash
git add apps/planejamento/app/page.tsx \
        services/api/src/modules/relatorio/
git commit -m "feat(planejamento): card Relatórios na home com visibilidade condicional"
```

---

### Tarefa 14: Páginas da Professora

**Arquivos:**
- Criar: `apps/planejamento/app/relatorios/turmas/page.tsx`
- Criar: `apps/planejamento/app/relatorios/turmas/turmas-content.tsx`
- Criar: `apps/planejamento/app/relatorios/[semanaId]/page.tsx`
- Criar: `apps/planejamento/app/relatorios/[semanaId]/relatorio-content.tsx`

- [ ] **Passo 1: Criar `turmas/page.tsx`**

```typescript
// apps/planejamento/app/relatorios/turmas/page.tsx
import { TurmasRelatorioContent } from "./turmas-content";

export default function TurmasRelatorioPage() {
  return <TurmasRelatorioContent />;
}
```

- [ ] **Passo 2: Criar `turmas-content.tsx`**

Leia `apps/planejamento/app/planejamentos/turmas/turmas-content.tsx` como referência e adapte:
- Trocar `api.get<Turma[]>("/plannings/turmas")` por `api.get<Turma[]>("/plannings/turmas")` filtrado por etapa BERCARIO/INFANTIL (ou usar endpoint específico `/relatorio/turmas-infantil`)
- Redirecionar para `/relatorios?turmaId=...` ao selecionar turma única
- Redirecionar para `/relatorios/[semanaId]?turmaId=...` ao selecionar semana
- Título: "Relatórios Semanais"

> **Alternativa simples para filtro:** use `useSemanaRelatorio().buscarPorTurma(turmaId)` — se retornar erro de etapa inválida, a turma não aparece na lista.

- [ ] **Passo 3: Criar `[semanaId]/page.tsx`**

```typescript
// apps/planejamento/app/relatorios/[semanaId]/page.tsx
import { RelatorioContent } from "./relatorio-content";

interface Props {
  params: Promise<{ semanaId: string }>;
  searchParams: Promise<{ turmaId?: string }>;
}

export default async function RelatorioPage({ params, searchParams }: Props) {
  const { semanaId } = await params;
  const { turmaId } = await searchParams;
  return <RelatorioContent semanaId={semanaId} turmaId={turmaId ?? null} />;
}
```

- [ ] **Passo 4: Criar `relatorio-content.tsx`**

Leia `apps/planejamento/app/plano-aula/[quinzenaId]/plano-content.tsx` e adapte para usar:
- `useRelatorio()` em vez de `usePlanoAula()`
- `semanaId` em vez de `periodoId`/`quinzenaId`
- Mesmos componentes `DocumentoUpload`, `DocumentoList`, `HistoricoTimeline` (reutilize do `features/plano-aula` ou crie versões equivalentes em `features/relatorio`)
- Título: "Relatório Semanal"

- [ ] **Passo 5: Commit**

```bash
git add apps/planejamento/app/relatorios/
git commit -m "feat(planejamento): páginas da professora para relatórios (turmas e edição)"
```

---

### Tarefa 15: Páginas da Analista

**Arquivos:**
- Criar: `apps/planejamento/app/relatorios/analise/page.tsx`
- Criar: `apps/planejamento/app/relatorios/analise/analise-content.tsx`
- Criar: `apps/planejamento/app/relatorios/analise/[relatorioId]/page.tsx`
- Criar: `apps/planejamento/app/relatorios/analise/[relatorioId]/revisao-content.tsx`

- [ ] **Passo 1: Criar `analise/page.tsx`**

```typescript
// apps/planejamento/app/relatorios/analise/page.tsx
import { AnaliseRelatorioContent } from "./analise-content";

export default function AnaliseRelatorioPage() {
  return <AnaliseRelatorioContent />;
}
```

- [ ] **Passo 2: Criar `analise-content.tsx`**

Leia `apps/planejamento/app/analise/analise-content.tsx` e adapte:
- `useAnalistaRelatorio().listarPendentes()` em vez de `useAnalistaActions().listarPendentes()`
- Filtro de segmento: apenas BERCARIO e INFANTIL (remover os outros)
- Links para `/relatorios/analise/[relatorioId]`
- Título: "Análise de Relatórios"

- [ ] **Passo 3: Criar `[relatorioId]/page.tsx`**

```typescript
// apps/planejamento/app/relatorios/analise/[relatorioId]/page.tsx
import { RevisaoRelatorioContent } from "./revisao-content";

interface Props {
  params: Promise<{ relatorioId: string }>;
}

export default async function RevisaoRelatorioPage({ params }: Props) {
  const { relatorioId } = await params;
  return <RevisaoRelatorioContent relatorioId={relatorioId} />;
}
```

- [ ] **Passo 4: Criar `revisao-content.tsx`**

Leia `apps/planejamento/app/analise/[planoId]/revisao-content.tsx` e adapte para relatórios. Pontos críticos:
- Incluir os botões de edição Word (`editar-word`, `sincronizar-word`) disponíveis para a analista — **este é o requisito explícito do usuário**
- Usar `useAnalistaRelatorio()` para aprovar/devolver
- Usar `useRelatorio().editarWord(relatorioId, docId)` para abrir SharePoint
- Botões: "Aprovar", "Devolver", "Editar Word" (se documento Word)

- [ ] **Passo 5: Commit**

```bash
git add apps/planejamento/app/relatorios/analise/
git commit -m "feat(planejamento): páginas da analista para relatórios (fila e revisão com edição Word)"
```

---

### Tarefa 16: Páginas de Gestão

**Arquivos:**
- Criar: `apps/planejamento/app/relatorios/gestao/page.tsx`
- Criar: `apps/planejamento/app/relatorios/gestao/dashboard-content.tsx`
- Criar: `apps/planejamento/app/relatorios/gestao/semanas/page.tsx`
- Criar: `apps/planejamento/app/relatorios/gestao/semanas/semanas-content.tsx`
- Criar: `apps/planejamento/app/relatorios/gestao/relatorios/page.tsx`
- Criar: `apps/planejamento/app/relatorios/gestao/relatorios/relatorios-content.tsx`

- [ ] **Passo 1: Criar `gestao/page.tsx`**

```typescript
// apps/planejamento/app/relatorios/gestao/page.tsx
import { GestaoRelatorioContent } from "./dashboard-content";

export default function GestaoRelatorioPage() {
  return <GestaoRelatorioContent />;
}
```

- [ ] **Passo 2: Criar `dashboard-content.tsx`**

Leia `apps/planejamento/app/gestao/dashboard-content.tsx` e adapte com `useGestaoRelatorio().dashboard()`. O dashboard deve exibir cards de contagem por status (RASCUNHO, AGUARDANDO_ANALISTA, AGUARDANDO_COORDENADORA, APROVADO) filtrado por BERCARIO e INFANTIL.

- [ ] **Passo 3: Criar `semanas/page.tsx`**

```typescript
// apps/planejamento/app/relatorios/gestao/semanas/page.tsx
import { SemanasRelatorioContent } from "./semanas-content";

export default function SemanasRelatorioPage() {
  return <SemanasRelatorioContent />;
}
```

- [ ] **Passo 4: Criar `semanas-content.tsx`**

Leia `apps/planejamento/app/gestao/periodos/periodos-content.tsx` e adapte:
- Filtro de etapa: apenas BERCARIO e INFANTIL (duas abas em vez de cinco)
- Usar `useSemanaRelatorio()` para CRUD
- Formulário de criação com campos: etapa, numero, descricao, dataInicio, dataFim, dataMaximaEntrega

- [ ] **Passo 5: Criar `relatorios/page.tsx` e `relatorios-content.tsx`**

```typescript
// apps/planejamento/app/relatorios/gestao/relatorios/page.tsx
import { RelatoriosGestaoContent } from "./relatorios-content";

export default function RelatoriosGestaoPage() {
  return <RelatoriosGestaoContent />;
}
```

`relatorios-content.tsx`: leia `apps/planejamento/app/gestao/planos/planos-content.tsx` e adapte com `useGestaoRelatorio().listar()`. Filtros: status, etapa (BERCARIO/INFANTIL), semanaId.

- [ ] **Passo 6: Lint, typecheck e commit**

```bash
pnpm turbo lint && pnpm turbo typecheck
git add apps/planejamento/app/relatorios/gestao/
git commit -m "feat(planejamento): páginas de gestão de relatórios (dashboard, semanas, listagem)"
```

---

## Verificação Final

### Tarefa 17: Smoke Test Completo

- [ ] **Passo 1: Build de produção**

```bash
pnpm turbo build
```

Esperado: todos os apps compilam sem erros.

- [ ] **Passo 2: Aplicar migration em produção (via script)**

```bash
./scripts/migrate.sh
```

- [ ] **Passo 3: Verificar health**

```bash
curl https://www.portalcef.com.br/api/health
```

Esperado: `{"status":"ok",...}`

- [ ] **Passo 4: Validar critérios de aceitação**

Acesse o módulo de planejamento com cada role abaixo e confirme:

| Cenário | Role | Resultado esperado |
|---|---|---|
| Home mostra 3 cards | professora (turma infantil) | Card Relatórios visível |
| Home mostra 2 cards | professora (turma fundamental) | Card Relatórios ausente |
| Home mostra 3 cards | analista_pedagogico | Card Relatórios visível |
| Home mostra 3 cards | coordenadora_bercario | Card Relatórios visível |
| Criar relatório etapa inválida | professora (fund.) | API retorna 400 |
| Submeter → analista vê pendente | professora + analista | Fila atualizada |
| Analista edita Word | analista | SharePoint abre |
| PDF gerado após aprovação | analista aprova doc | `pdfStatus: PRONTO` |

- [ ] **Passo 5: Commit final**

```bash
pnpm turbo lint && pnpm turbo typecheck
git add .
git commit -m "feat: módulo Relatórios para educação infantil — implementação completa"
```
