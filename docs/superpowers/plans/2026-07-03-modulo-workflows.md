# Modulo Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o modulo independente Workflows para registrar modelos operacionais por unidade, iniciar execucoes, acompanhar checklist, anexos e historico dentro do portal.

**Architecture:** O modulo usa tabelas Drizzle dedicadas em `@essencia/db`, um modulo NestJS `WorkflowsModule` com isolamento por `schoolId` e `unitId` da sessao, e um novo app Next.js `apps/workflows` em `/workflows`. O frontend consome somente a API HTTP, usa `TenantProvider` e `Shell`, e a navegacao compartilhada aponta para o novo app. Anexos usam o `StorageService` existente, com upload apenas depois da validacao de payload e permissao.

**Tech Stack:** Turborepo, pnpm, TypeScript, Drizzle ORM, PostgreSQL, NestJS + Fastify, MinIO/S3 via `StorageService`, Next.js 15 App Router, React 19, shadcn/ui + Tailwind, Jest no backend, Vitest no frontend.

---

## Contexto Obrigatorio

Leia antes de executar:

- `docs/plans/2026-07-02-workflows-design.md` - especificacao funcional validada.
- `docs/ARCHITECTURE.md` - regra de apps via HTTP e separacao Next/Nest/DB.
- `packages/db/src/schema/suporte.ts` - exemplo simples de entidade por tenant e anexos.
- `packages/db/src/schema/plano-aula.ts` e `packages/db/src/schema/plano-aula-historico.ts` - exemplos de workflow e historico.
- `services/api/src/modules/suporte/suporte.controller.ts` - multipart seguro: validar/autorizacao antes de upload.
- `services/api/src/modules/suporte/suporte.service.ts` - isolamento por sessao e permissao criador/admin.
- `services/api/src/modules/plano-aula/plano-aula.controller.ts` - padrao de controller com Zod.
- `services/api/src/modules/plano-aula/dto/plano-aula.dto.ts` - constantes de roles e schemas.
- `packages/components/src/shell/app-sidebar.tsx` - menu compartilhado.
- `apps/tarefas/app/layout.tsx` - layout com `TenantProvider`, `Shell` e `Toaster`.
- `apps/suporte/next.config.js`, `tailwind.config.ts`, `tsconfig.json` - configuracao de app independente.
- `nginx.conf` e `docker-compose.prod.yml` - roteamento e container de app novo.

Regras de execucao:

- Execute em worktree isolado, criado com `superpowers:using-git-worktrees`, porque o checkout atual pode estar sujo.
- Use `superpowers:test-driven-development` para cada tarefa que muda comportamento.
- Comunicacao, docs, comentarios e commits em Portugues do Brasil.
- Apps nunca importam `@essencia/db`; sempre usam `/api/workflows`.
- Todo isolamento de tenant vem de `req.user.schoolId` e `req.user.unitId`; ignore `schoolId` e `unitId` enviados em payload.
- Antes de qualquer commit, rode pelo menos o teste da tarefa. Antes do PR, rode `pnpm turbo lint && pnpm turbo typecheck`.

## Decisoes de Escopo

- O MVP usa app novo `apps/workflows` na porta `3015`.
- Roles de gestao do modulo sao somente `master`, `diretora_geral`, `gerente_unidade` e `coordenadora_geral`.
- Usuarios sem `unitId` na sessao recebem erro `400` em endpoints do modulo.
- Sugestoes de fases e etapas por categoria ficam em constante TypeScript na API no MVP; nao viram tabela separada.
- A execucao acompanha o modelo atual. Quando uma etapa publicada muda, a API incrementa `versao` da etapa, zera progresso dessa etapa em execucoes abertas e marca `modeloAtualizado` na execucao.
- Anexos sao gerais da execucao. Quem ve a execucao pode anexar e remover anexos.
- Execucoes de teste de rascunho usam `teste = true`, ficam visiveis apenas para gestao e podem ser descartadas por `DELETE /workflows/execucoes/:id`.

## Mapa de Arquivos

### Criar

| Arquivo | Responsabilidade |
|---|---|
| `packages/db/src/schema/workflows.ts` | Tabelas, enums, relations e schemas Drizzle/Zod do modulo. |
| `packages/shared/src/types/workflows.ts` | Tipos compartilhados para API e app. |
| `services/api/src/modules/workflows/dto/workflows.dto.ts` | Schemas Zod dos payloads e queries. |
| `services/api/src/modules/workflows/workflows.constants.ts` | Roles, eventos de historico e sugestoes por categoria. |
| `services/api/src/modules/workflows/workflows.types.ts` | Tipos internos de sessao, upload e respostas compostas. |
| `services/api/src/modules/workflows/workflows-historico.service.ts` | Gravacao padronizada de eventos de historico. |
| `services/api/src/modules/workflows/workflows-categorias.service.ts` | Categorias e sugestoes por unidade. |
| `services/api/src/modules/workflows/workflows-modelos.service.ts` | CRUD, publicacao, inativacao, duplicacao e atualizacao de modelo. |
| `services/api/src/modules/workflows/workflows-execucoes.service.ts` | Inicio, listagem, checklist, conclusao, cancelamento, reabertura e descarte. |
| `services/api/src/modules/workflows/workflows-anexos.service.ts` | Persistencia de anexos e historico depois do upload. |
| `services/api/src/modules/workflows/workflows.controller.ts` | Endpoints HTTP e multipart. |
| `services/api/src/modules/workflows/workflows.module.ts` | Wiring NestJS do modulo. |
| `services/api/src/modules/workflows/*.spec.ts` | Testes Jest do modulo. |
| `apps/workflows/package.json` | Scripts e dependencias do app. |
| `apps/workflows/next.config.js` | `basePath: "/workflows"` e transpile packages. |
| `apps/workflows/tsconfig.json` | Config TypeScript do app. |
| `apps/workflows/tailwind.config.ts` | Conteudo Tailwind do app. |
| `apps/workflows/postcss.config.js` | PostCSS Tailwind. |
| `apps/workflows/vitest.config.ts` | Testes Vitest/jsdom do app. |
| `apps/workflows/vitest.setup.ts` | Setup de testes React. |
| `apps/workflows/app/layout.tsx` | Layout com `TenantProvider`, `Shell` e `Toaster`. |
| `apps/workflows/app/page.tsx` | Tela principal `/workflows`. |
| `apps/workflows/app/modelos/novo/page.tsx` | Criacao de modelo. |
| `apps/workflows/app/modelos/[modeloId]/page.tsx` | Edicao/duplicacao/publicacao de modelo. |
| `apps/workflows/app/execucoes/[execucaoId]/page.tsx` | Tela de execucao com abas internas. |
| `apps/workflows/components/*.tsx` | Componentes focados de biblioteca, editor, execucao e dialogos. |
| `apps/workflows/lib/api.ts` | Cliente fino para `@essencia/shared/fetchers/client`. |
| `apps/workflows/lib/permissoes.ts` | Helper `isGestaoWorkflow`. |
| `apps/workflows/lib/workflow-utils.ts` | Calculo visual de fase atual e percentuais. |
| `apps/workflows/app/*.test.tsx` e `apps/workflows/lib/*.test.ts` | Testes de invariantes do app. |

### Modificar

| Arquivo | Responsabilidade |
|---|---|
| `packages/db/src/schema/index.ts` | Exportar `workflows.ts`. |
| `services/api/src/app.module.ts` | Importar e registrar `WorkflowsModule`. |
| `packages/shared/src/types/index.ts` | Exportar tipos de workflows. |
| `packages/components/src/shell/app-sidebar.tsx` | Adicionar item `Workflows`, permissao `ALL`, rota e porta 3015. |
| `nginx.conf` | Proxy `/workflows` para `essencia-workflows:3015`. |
| `docker-compose.prod.yml` | Servico `workflows`. |
| `docs/API.md` | Documentar endpoints principais. |
| `docs/ARCHITECTURE.md` | Registrar novo app e modulo API. |

## Contratos de API

Use estes endpoints no backend e no app:

```text
GET    /workflows/categorias
POST   /workflows/categorias
PATCH  /workflows/categorias/:categoriaId
GET    /workflows/categorias/:categoriaId/sugestoes

GET    /workflows/modelos
POST   /workflows/modelos
GET    /workflows/modelos/:modeloId
PATCH  /workflows/modelos/:modeloId
POST   /workflows/modelos/:modeloId/publicar
POST   /workflows/modelos/:modeloId/inativar
POST   /workflows/modelos/:modeloId/duplicar
POST   /workflows/modelos/:modeloId/execucoes

GET    /workflows/execucoes
GET    /workflows/execucoes/:execucaoId
PATCH  /workflows/execucoes/:execucaoId/titulo
PATCH  /workflows/execucoes/:execucaoId/etapas/:etapaId
POST   /workflows/execucoes/:execucaoId/concluir
POST   /workflows/execucoes/:execucaoId/cancelar
POST   /workflows/execucoes/:execucaoId/reabrir
DELETE /workflows/execucoes/:execucaoId
POST   /workflows/execucoes/:execucaoId/anexos
DELETE /workflows/execucoes/:execucaoId/anexos/:anexoId
```

Todas as respostas seguem:

```typescript
{
  success: true,
  data: resultado,
}
```

Erros de validacao no controller seguem:

```typescript
throw new BadRequestException({
  code: "VALIDATION_ERROR",
  message: "Dados invalidos",
  errors: parsed.error.errors,
});
```

## Task 1: Contratos Compartilhados

**Files:**
- Create: `packages/shared/src/types/workflows.ts`
- Modify: `packages/shared/src/types/index.ts`
- Test: `packages/shared/src/types/workflows.typecheck.ts`

- [ ] **Step 1.1: Escrever teste de contrato compartilhado**

Crie `packages/shared/src/types/workflows.typecheck.ts`:

```typescript
import type {
  WorkflowCategoria,
  WorkflowExecucaoDetalhe,
  WorkflowModeloDetalhe,
  WorkflowModeloStatus,
} from "./workflows";

const statusModelo: WorkflowModeloStatus = "PUBLICADO";

const modelo: WorkflowModeloDetalhe = {
  id: "modelo-1",
  schoolId: "school-1",
  unitId: "unit-1",
  categoriaId: "categoria-1",
  nome: "Evento Dia dos Pais",
  descricaoCurta: "Protocolo operacional do evento",
  status: statusModelo,
  criadoPor: "gestor-1",
  createdAt: "2026-07-03T10:00:00.000Z",
  updatedAt: "2026-07-03T10:00:00.000Z",
  categoria: {
    id: "categoria-1",
    schoolId: "school-1",
    unitId: "unit-1",
    nome: "Eventos",
    ativo: true,
    ordem: 1,
    createdAt: "2026-07-03T10:00:00.000Z",
    updatedAt: "2026-07-03T10:00:00.000Z",
  },
  orientacoes: [{ id: "ori-1", titulo: "Objetivo", conteudo: "Organizar", ordem: 1 }],
  fases: [
    {
      id: "fase-1",
      nome: "Preparacao",
      ordem: 1,
      etapas: [
        {
          id: "etapa-1",
          titulo: "Definir data",
          instrucao: "Confirmar no calendario",
          ordem: 1,
          versao: 1,
          updatedAt: "2026-07-03T10:00:00.000Z",
        },
      ],
    },
  ],
};

const categoria: WorkflowCategoria = modelo.categoria;

const execucao: WorkflowExecucaoDetalhe = {
  id: "execucao-1",
  schoolId: "school-1",
  unitId: "unit-1",
  modeloId: modelo.id,
  titulo: "Evento Dia dos Pais 2027",
  status: "EM_ANDAMENTO",
  teste: false,
  modeloAtualizado: true,
  iniciadoPor: "user-1",
  concluidoAt: null,
  canceladoAt: null,
  motivoCancelamento: null,
  createdAt: "2026-07-03T10:00:00.000Z",
  updatedAt: "2026-07-03T10:00:00.000Z",
  modelo,
  faseAtual: "Preparacao",
  progressoPercentual: 0,
  progresso: [
    {
      etapaId: "etapa-1",
      concluida: false,
      observacao: "Aguardando agenda",
      concluidaPor: null,
      concluidaAt: null,
      etapaVersao: 1,
    },
  ],
  anexos: [],
  historico: [
    {
      id: "hist-1",
      tipo: "WORKFLOW_INICIADO",
      descricao: "Workflow iniciado",
      motivo: null,
      autorId: "user-1",
      autorNome: "Professora Teste",
      createdAt: "2026-07-03T10:00:00.000Z",
    },
  ],
};

void categoria;
void execucao;
```

- [ ] **Step 1.2: Rodar o typecheck e confirmar falha**

Run:

```bash
pnpm --filter @essencia/shared typecheck
```

Expected: FAIL com erro equivalente a `Cannot find module './workflows'`.

- [ ] **Step 1.3: Implementar tipos compartilhados**

Crie `packages/shared/src/types/workflows.ts`:

```typescript
export type WorkflowModeloStatus = "RASCUNHO" | "PUBLICADO" | "INATIVO";

export type WorkflowExecucaoStatus =
  | "EM_ANDAMENTO"
  | "CONCLUIDA"
  | "CANCELADA";

export type WorkflowHistoricoTipo =
  | "WORKFLOW_INICIADO"
  | "ETAPA_CONCLUIDA"
  | "ETAPA_PENDENTE"
  | "OBSERVACAO_ETAPA_ALTERADA"
  | "ANEXO_ENVIADO"
  | "ANEXO_REMOVIDO"
  | "TITULO_EXECUCAO_EDITADO"
  | "MODELO_ATUALIZADO"
  | "EXECUCAO_CONCLUIDA"
  | "EXECUCAO_CANCELADA"
  | "EXECUCAO_REABERTA"
  | "EXECUCAO_DESCARTADA";

export interface WorkflowCategoria {
  id: string;
  schoolId: string;
  unitId: string;
  nome: string;
  ativo: boolean;
  ordem: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowOrientacao {
  id: string;
  titulo: string;
  conteudo: string;
  ordem: number;
}

export interface WorkflowEtapa {
  id: string;
  titulo: string;
  instrucao: string | null;
  ordem: number;
  versao: number;
  updatedAt: string;
}

export interface WorkflowFase {
  id: string;
  nome: string;
  ordem: number;
  etapas: WorkflowEtapa[];
}

export interface WorkflowModeloResumo {
  id: string;
  schoolId: string;
  unitId: string;
  categoriaId: string;
  nome: string;
  descricaoCurta: string;
  status: WorkflowModeloStatus;
  criadoPor: string;
  createdAt: string;
  updatedAt: string;
  categoria: WorkflowCategoria;
}

export interface WorkflowModeloDetalhe extends WorkflowModeloResumo {
  orientacoes: WorkflowOrientacao[];
  fases: WorkflowFase[];
}

export interface WorkflowEtapaProgresso {
  etapaId: string;
  concluida: boolean;
  observacao: string | null;
  concluidaPor: string | null;
  concluidaAt: string | null;
  etapaVersao: number;
}

export interface WorkflowAnexo {
  id: string;
  nomeOriginal: string;
  storageKey: string;
  url: string;
  mimeType: string;
  tamanhoBytes: number;
  enviadoPor: string;
  enviadoPorNome: string | null;
  createdAt: string;
}

export interface WorkflowHistoricoItem {
  id: string;
  tipo: WorkflowHistoricoTipo;
  descricao: string;
  motivo: string | null;
  autorId: string;
  autorNome: string | null;
  createdAt: string;
}

export interface WorkflowExecucaoResumo {
  id: string;
  schoolId: string;
  unitId: string;
  modeloId: string;
  titulo: string;
  status: WorkflowExecucaoStatus;
  teste: boolean;
  modeloAtualizado: boolean;
  iniciadoPor: string;
  concluidoAt: string | null;
  canceladoAt: string | null;
  motivoCancelamento: string | null;
  createdAt: string;
  updatedAt: string;
  modelo: WorkflowModeloResumo;
  faseAtual: string | null;
  progressoPercentual: number;
}

export interface WorkflowExecucaoDetalhe extends WorkflowExecucaoResumo {
  modelo: WorkflowModeloDetalhe;
  progresso: WorkflowEtapaProgresso[];
  anexos: WorkflowAnexo[];
  historico: WorkflowHistoricoItem[];
}

export interface WorkflowSugestaoEtapa {
  titulo: string;
  instrucao: string | null;
}

export interface WorkflowSugestaoFase {
  nome: string;
  etapas: WorkflowSugestaoEtapa[];
}

export interface WorkflowSugestoesCategoria {
  orientacoes: Array<{ titulo: string; conteudo: string }>;
  fases: WorkflowSugestaoFase[];
}
```

Modifique `packages/shared/src/types/index.ts` adicionando no final:

```typescript
export * from "./workflows";
```

- [ ] **Step 1.4: Rodar typecheck e confirmar sucesso**

Run:

```bash
pnpm --filter @essencia/shared typecheck
```

Expected: PASS.

- [ ] **Step 1.5: Commit**

```bash
git add packages/shared/src/types/workflows.ts packages/shared/src/types/workflows.typecheck.ts packages/shared/src/types/index.ts
git commit -m "feat(workflows): define contratos compartilhados"
```

## Task 2: Schema Drizzle e Migration

**Files:**
- Create: `packages/db/src/schema/workflows.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/drizzle/0039_workflows.sql`
- Modify: `packages/db/drizzle/meta/_journal.json` via `pnpm db:generate`
- Test: `services/api/src/quality/drizzle-migrations.spec.ts`

- [ ] **Step 2.1: Escrever teste de qualidade para migration**

Modifique `services/api/src/quality/drizzle-migrations.spec.ts` adicionando um `it` no `describe` existente:

```typescript
it("inclui a migration do modulo workflows com tabelas principais", () => {
  const migration = readFileSync(
    join(process.cwd(), "../../packages/db/drizzle/0039_workflows.sql"),
    "utf8",
  );

  expect(migration).toContain('CREATE TABLE IF NOT EXISTS "workflow_categorias"');
  expect(migration).toContain('CREATE TABLE IF NOT EXISTS "workflow_modelos"');
  expect(migration).toContain('CREATE TABLE IF NOT EXISTS "workflow_execucoes"');
  expect(migration).toContain('CREATE TABLE IF NOT EXISTS "workflow_historico"');
  expect(migration).toContain('"school_id" uuid NOT NULL');
  expect(migration).toContain('"unit_id" uuid NOT NULL');
});
```

- [ ] **Step 2.2: Rodar teste e confirmar falha**

Run:

```bash
pnpm --filter @essencia/api test -- drizzle-migrations
```

Expected: FAIL porque `0039_workflows.sql` ainda nao existe.

- [ ] **Step 2.3: Criar schema Drizzle**

Crie `packages/db/src/schema/workflows.ts` com este conteudo:

```typescript
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

import { schools } from "./schools.js";
import { units } from "./units.js";
import { users } from "./users.js";

export const workflowModeloStatusEnum = [
  "RASCUNHO",
  "PUBLICADO",
  "INATIVO",
] as const;
export type WorkflowModeloStatus = (typeof workflowModeloStatusEnum)[number];

export const workflowExecucaoStatusEnum = [
  "EM_ANDAMENTO",
  "CONCLUIDA",
  "CANCELADA",
] as const;
export type WorkflowExecucaoStatus =
  (typeof workflowExecucaoStatusEnum)[number];

export const workflowHistoricoTipoEnum = [
  "WORKFLOW_INICIADO",
  "ETAPA_CONCLUIDA",
  "ETAPA_PENDENTE",
  "OBSERVACAO_ETAPA_ALTERADA",
  "ANEXO_ENVIADO",
  "ANEXO_REMOVIDO",
  "TITULO_EXECUCAO_EDITADO",
  "MODELO_ATUALIZADO",
  "EXECUCAO_CONCLUIDA",
  "EXECUCAO_CANCELADA",
  "EXECUCAO_REABERTA",
  "EXECUCAO_DESCARTADA",
] as const;
export type WorkflowHistoricoTipo =
  (typeof workflowHistoricoTipoEnum)[number];

export const workflowCategorias = pgTable(
  "workflow_categorias",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    nome: varchar("nome", { length: 120 }).notNull(),
    ativo: boolean("ativo").notNull().default(true),
    ordem: integer("ordem").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    unidadeOrdemIdx: index("idx_workflow_categorias_unidade_ordem").on(
      table.unitId,
      table.ordem,
    ),
    nomeUnicoIdx: uniqueIndex("workflow_categorias_unit_nome_unique").on(
      table.unitId,
      table.nome,
    ),
  }),
);

export const workflowModelos = pgTable(
  "workflow_modelos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    categoriaId: uuid("categoria_id")
      .notNull()
      .references(() => workflowCategorias.id, { onDelete: "restrict" }),
    nome: varchar("nome", { length: 180 }).notNull(),
    descricaoCurta: varchar("descricao_curta", { length: 300 }).notNull(),
    status: text("status", { enum: workflowModeloStatusEnum })
      .notNull()
      .default("RASCUNHO"),
    criadoPor: uuid("criado_por")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    unidadeStatusIdx: index("idx_workflow_modelos_unidade_status").on(
      table.unitId,
      table.status,
    ),
    categoriaIdx: index("idx_workflow_modelos_categoria").on(table.categoriaId),
  }),
);

export const workflowOrientacoes = pgTable(
  "workflow_orientacoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modeloId: uuid("modelo_id")
      .notNull()
      .references(() => workflowModelos.id, { onDelete: "cascade" }),
    titulo: varchar("titulo", { length: 140 }).notNull(),
    conteudo: text("conteudo").notNull(),
    ordem: integer("ordem").notNull(),
  },
  (table) => ({
    modeloOrdemIdx: index("idx_workflow_orientacoes_modelo_ordem").on(
      table.modeloId,
      table.ordem,
    ),
  }),
);

export const workflowFases = pgTable(
  "workflow_fases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modeloId: uuid("modelo_id")
      .notNull()
      .references(() => workflowModelos.id, { onDelete: "cascade" }),
    nome: varchar("nome", { length: 140 }).notNull(),
    ordem: integer("ordem").notNull(),
  },
  (table) => ({
    modeloOrdemIdx: index("idx_workflow_fases_modelo_ordem").on(
      table.modeloId,
      table.ordem,
    ),
  }),
);

export const workflowEtapas = pgTable(
  "workflow_etapas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    faseId: uuid("fase_id")
      .notNull()
      .references(() => workflowFases.id, { onDelete: "cascade" }),
    titulo: varchar("titulo", { length: 180 }).notNull(),
    instrucao: text("instrucao"),
    ordem: integer("ordem").notNull(),
    versao: integer("versao").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    faseOrdemIdx: index("idx_workflow_etapas_fase_ordem").on(
      table.faseId,
      table.ordem,
    ),
  }),
);

export const workflowExecucoes = pgTable(
  "workflow_execucoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    modeloId: uuid("modelo_id")
      .notNull()
      .references(() => workflowModelos.id, { onDelete: "restrict" }),
    titulo: varchar("titulo", { length: 220 }).notNull(),
    status: text("status", { enum: workflowExecucaoStatusEnum })
      .notNull()
      .default("EM_ANDAMENTO"),
    teste: boolean("teste").notNull().default(false),
    modeloAtualizado: boolean("modelo_atualizado").notNull().default(false),
    iniciadoPor: uuid("iniciado_por")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    concluidoAt: timestamp("concluido_at", { withTimezone: true }),
    canceladoAt: timestamp("cancelado_at", { withTimezone: true }),
    motivoCancelamento: text("motivo_cancelamento"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    unidadeStatusIdx: index("idx_workflow_execucoes_unidade_status").on(
      table.unitId,
      table.status,
    ),
    iniciadoPorIdx: index("idx_workflow_execucoes_iniciado_por").on(
      table.iniciadoPor,
    ),
    modeloIdx: index("idx_workflow_execucoes_modelo").on(table.modeloId),
  }),
);

export const workflowEtapaProgresso = pgTable(
  "workflow_etapa_progresso",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    execucaoId: uuid("execucao_id")
      .notNull()
      .references(() => workflowExecucoes.id, { onDelete: "cascade" }),
    etapaId: uuid("etapa_id")
      .notNull()
      .references(() => workflowEtapas.id, { onDelete: "cascade" }),
    etapaVersao: integer("etapa_versao").notNull().default(1),
    concluida: boolean("concluida").notNull().default(false),
    observacao: text("observacao"),
    concluidaPor: uuid("concluida_por").references(() => users.id, {
      onDelete: "set null",
    }),
    concluidaAt: timestamp("concluida_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    execucaoEtapaIdx: uniqueIndex("workflow_progresso_execucao_etapa_unique").on(
      table.execucaoId,
      table.etapaId,
    ),
    execucaoIdx: index("idx_workflow_progresso_execucao").on(table.execucaoId),
  }),
);

export const workflowAnexos = pgTable(
  "workflow_anexos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    execucaoId: uuid("execucao_id")
      .notNull()
      .references(() => workflowExecucoes.id, { onDelete: "cascade" }),
    nomeOriginal: varchar("nome_original", { length: 255 }).notNull(),
    storageKey: varchar("storage_key", { length: 500 }).notNull(),
    url: varchar("url", { length: 1000 }).notNull(),
    mimeType: varchar("mime_type", { length: 160 }).notNull(),
    tamanhoBytes: integer("tamanho_bytes").notNull(),
    enviadoPor: uuid("enviado_por")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    execucaoIdx: index("idx_workflow_anexos_execucao").on(table.execucaoId),
  }),
);

export const workflowHistorico = pgTable(
  "workflow_historico",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    execucaoId: uuid("execucao_id")
      .notNull()
      .references(() => workflowExecucoes.id, { onDelete: "cascade" }),
    tipo: text("tipo", { enum: workflowHistoricoTipoEnum }).notNull(),
    descricao: text("descricao").notNull(),
    motivo: text("motivo"),
    metadata: text("metadata"),
    autorId: uuid("autor_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    execucaoIdx: index("idx_workflow_historico_execucao").on(table.execucaoId),
    tipoIdx: index("idx_workflow_historico_tipo").on(table.tipo),
  }),
);

export const workflowCategoriasRelations = relations(
  workflowCategorias,
  ({ one, many }) => ({
    school: one(schools, {
      fields: [workflowCategorias.schoolId],
      references: [schools.id],
    }),
    unit: one(units, {
      fields: [workflowCategorias.unitId],
      references: [units.id],
    }),
    modelos: many(workflowModelos),
  }),
);

export const workflowModelosRelations = relations(
  workflowModelos,
  ({ one, many }) => ({
    categoria: one(workflowCategorias, {
      fields: [workflowModelos.categoriaId],
      references: [workflowCategorias.id],
    }),
    criadoPorUser: one(users, {
      fields: [workflowModelos.criadoPor],
      references: [users.id],
    }),
    orientacoes: many(workflowOrientacoes),
    fases: many(workflowFases),
    execucoes: many(workflowExecucoes),
  }),
);

export const workflowOrientacoesRelations = relations(
  workflowOrientacoes,
  ({ one }) => ({
    modelo: one(workflowModelos, {
      fields: [workflowOrientacoes.modeloId],
      references: [workflowModelos.id],
    }),
  }),
);

export const workflowFasesRelations = relations(
  workflowFases,
  ({ one, many }) => ({
    modelo: one(workflowModelos, {
      fields: [workflowFases.modeloId],
      references: [workflowModelos.id],
    }),
    etapas: many(workflowEtapas),
  }),
);

export const workflowEtapasRelations = relations(
  workflowEtapas,
  ({ one, many }) => ({
    fase: one(workflowFases, {
      fields: [workflowEtapas.faseId],
      references: [workflowFases.id],
    }),
    progresso: many(workflowEtapaProgresso),
  }),
);

export const workflowExecucoesRelations = relations(
  workflowExecucoes,
  ({ one, many }) => ({
    modelo: one(workflowModelos, {
      fields: [workflowExecucoes.modeloId],
      references: [workflowModelos.id],
    }),
    iniciadoPorUser: one(users, {
      fields: [workflowExecucoes.iniciadoPor],
      references: [users.id],
    }),
    progresso: many(workflowEtapaProgresso),
    anexos: many(workflowAnexos),
    historico: many(workflowHistorico),
  }),
);

export const workflowEtapaProgressoRelations = relations(
  workflowEtapaProgresso,
  ({ one }) => ({
    execucao: one(workflowExecucoes, {
      fields: [workflowEtapaProgresso.execucaoId],
      references: [workflowExecucoes.id],
    }),
    etapa: one(workflowEtapas, {
      fields: [workflowEtapaProgresso.etapaId],
      references: [workflowEtapas.id],
    }),
    concluidaPorUser: one(users, {
      fields: [workflowEtapaProgresso.concluidaPor],
      references: [users.id],
    }),
  }),
);

export const workflowAnexosRelations = relations(
  workflowAnexos,
  ({ one }) => ({
    execucao: one(workflowExecucoes, {
      fields: [workflowAnexos.execucaoId],
      references: [workflowExecucoes.id],
    }),
    enviadoPorUser: one(users, {
      fields: [workflowAnexos.enviadoPor],
      references: [users.id],
    }),
  }),
);

export const workflowHistoricoRelations = relations(
  workflowHistorico,
  ({ one }) => ({
    execucao: one(workflowExecucoes, {
      fields: [workflowHistorico.execucaoId],
      references: [workflowExecucoes.id],
    }),
    autor: one(users, {
      fields: [workflowHistorico.autorId],
      references: [users.id],
    }),
  }),
);

export type WorkflowCategoria = typeof workflowCategorias.$inferSelect;
export type NewWorkflowCategoria = typeof workflowCategorias.$inferInsert;
export type WorkflowModelo = typeof workflowModelos.$inferSelect;
export type NewWorkflowModelo = typeof workflowModelos.$inferInsert;
export type WorkflowOrientacao = typeof workflowOrientacoes.$inferSelect;
export type WorkflowFase = typeof workflowFases.$inferSelect;
export type WorkflowEtapa = typeof workflowEtapas.$inferSelect;
export type WorkflowExecucao = typeof workflowExecucoes.$inferSelect;
export type WorkflowEtapaProgresso =
  typeof workflowEtapaProgresso.$inferSelect;
export type WorkflowAnexo = typeof workflowAnexos.$inferSelect;
export type WorkflowHistorico = typeof workflowHistorico.$inferSelect;

export const insertWorkflowCategoriaSchema =
  createInsertSchema(workflowCategorias);
export const selectWorkflowCategoriaSchema =
  createSelectSchema(workflowCategorias);
export const insertWorkflowModeloSchema = createInsertSchema(workflowModelos);
export const selectWorkflowModeloSchema = createSelectSchema(workflowModelos);
export const insertWorkflowExecucaoSchema =
  createInsertSchema(workflowExecucoes);
export const selectWorkflowExecucaoSchema =
  createSelectSchema(workflowExecucoes);
```

Modifique `packages/db/src/schema/index.ts` adicionando:

```typescript
export * from "./workflows.js";
```

- [ ] **Step 2.4: Gerar migration**

Run:

```bash
pnpm --filter @essencia/db build
pnpm db:generate
```

Expected: arquivo `packages/db/drizzle/0039_workflows.sql` criado. Se o numero gerado for outro por migrations locais, renomeie apenas se a ordem real do reposititorio exigir; preserve o conteudo gerado pelo Drizzle.

- [ ] **Step 2.5: Rodar testes e typecheck do DB**

Run:

```bash
pnpm --filter @essencia/api test -- drizzle-migrations
pnpm --filter @essencia/db typecheck
```

Expected: PASS.

- [ ] **Step 2.6: Commit**

```bash
git add packages/db/src/schema/workflows.ts packages/db/src/schema/index.ts packages/db/drizzle packages/db/drizzle/meta services/api/src/quality/drizzle-migrations.spec.ts
git commit -m "feat(workflows): cria schema e migration"
```

## Task 3: DTOs, Constantes e Modulo API Vazio

**Files:**
- Create: `services/api/src/modules/workflows/dto/workflows.dto.ts`
- Create: `services/api/src/modules/workflows/workflows.constants.ts`
- Create: `services/api/src/modules/workflows/workflows.types.ts`
- Create: `services/api/src/modules/workflows/workflows.module.ts`
- Create: `services/api/src/modules/workflows/workflows.controller.ts`
- Create: `services/api/src/modules/workflows/workflows-categorias.service.ts`
- Create: `services/api/src/modules/workflows/workflows-modelos.service.ts`
- Create: `services/api/src/modules/workflows/workflows-execucoes.service.ts`
- Create: `services/api/src/modules/workflows/workflows-anexos.service.ts`
- Create: `services/api/src/modules/workflows/workflows-historico.service.ts`
- Modify: `services/api/src/app.module.ts`
- Test: `services/api/src/modules/workflows/workflows.controller.spec.ts`

- [ ] **Step 3.1: Escrever teste de guards e validacao inicial**

Crie `services/api/src/modules/workflows/workflows.controller.spec.ts`:

```typescript
import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { StorageService } from "../../common/storage/storage.service";
import { WorkflowsAnexosService } from "./workflows-anexos.service";
import { WorkflowsCategoriasService } from "./workflows-categorias.service";
import { WorkflowsController } from "./workflows.controller";
import { WorkflowsExecucoesService } from "./workflows-execucoes.service";
import { WorkflowsModelosService } from "./workflows-modelos.service";
import type { WorkflowUserContext } from "./workflows.types";

const usuarioBase: WorkflowUserContext = {
  userId: "user-1",
  role: "professora",
  schoolId: "school-1",
  unitId: "unit-1",
  stageId: null,
};

describe("WorkflowsController", () => {
  let controller: WorkflowsController;

  const categoriasService = {
    listar: jest.fn(),
    criar: jest.fn(),
    atualizar: jest.fn(),
    obterSugestoes: jest.fn(),
  };
  const modelosService = {
    listar: jest.fn(),
    criar: jest.fn(),
    buscarPorId: jest.fn(),
    atualizar: jest.fn(),
    publicar: jest.fn(),
    inativar: jest.fn(),
    duplicar: jest.fn(),
  };
  const execucoesService = {
    iniciar: jest.fn(),
    listar: jest.fn(),
    buscarPorId: jest.fn(),
    editarTitulo: jest.fn(),
    atualizarEtapa: jest.fn(),
    concluir: jest.fn(),
    cancelar: jest.fn(),
    reabrir: jest.fn(),
    descartarTeste: jest.fn(),
  };
  const anexosService = {
    registrarUpload: jest.fn(),
    remover: jest.fn(),
  };
  const storageService = {
    uploadBuffer: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkflowsController],
      providers: [
        { provide: WorkflowsCategoriasService, useValue: categoriasService },
        { provide: WorkflowsModelosService, useValue: modelosService },
        { provide: WorkflowsExecucoesService, useValue: execucoesService },
        { provide: WorkflowsAnexosService, useValue: anexosService },
        { provide: StorageService, useValue: storageService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get(WorkflowsController);
    jest.clearAllMocks();
  });

  it("valida payload antes de criar categoria", async () => {
    await expect(
      controller.criarCategoria({ user: usuarioBase }, { nome: "" }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(categoriasService.criar).not.toHaveBeenCalled();
  });

  it("encaminha listagem de categorias com usuario da sessao", async () => {
    categoriasService.listar.mockResolvedValue([]);

    await expect(
      controller.listarCategorias({ user: usuarioBase }),
    ).resolves.toEqual({ success: true, data: [] });

    expect(categoriasService.listar).toHaveBeenCalledWith(usuarioBase);
  });
});
```

- [ ] **Step 3.2: Rodar teste e confirmar falha**

Run:

```bash
pnpm --filter @essencia/api test -- workflows.controller
```

Expected: FAIL com `Cannot find module './workflows.controller'`.

- [ ] **Step 3.3: Criar DTOs**

Crie `services/api/src/modules/workflows/dto/workflows.dto.ts`:

```typescript
import { z } from "zod";

const itemOrdenadoSchema = z.object({
  id: z.string().uuid().optional(),
  ordem: z.coerce.number().int().min(1),
});

export const criarCategoriaSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  ordem: z.coerce.number().int().min(0).optional(),
});
export type CriarCategoriaDto = z.infer<typeof criarCategoriaSchema>;

export const atualizarCategoriaSchema = z.object({
  nome: z.string().trim().min(2).max(120).optional(),
  ativo: z.boolean().optional(),
  ordem: z.coerce.number().int().min(0).optional(),
});
export type AtualizarCategoriaDto = z.infer<typeof atualizarCategoriaSchema>;

export const orientacaoModeloSchema = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().trim().min(2).max(140),
  conteudo: z.string().trim().min(1),
  ordem: z.coerce.number().int().min(1),
});

export const etapaModeloSchema = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().trim().min(2).max(180),
  instrucao: z.string().trim().max(4000).nullable().optional(),
  ordem: z.coerce.number().int().min(1),
});

export const faseModeloSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2).max(140),
  ordem: z.coerce.number().int().min(1),
  etapas: z.array(etapaModeloSchema).min(1),
});

export const criarModeloSchema = z.object({
  categoriaId: z.string().uuid(),
  nome: z.string().trim().min(3).max(180),
  descricaoCurta: z.string().trim().min(3).max(300),
  orientacoes: z.array(orientacaoModeloSchema).min(1),
  fases: z.array(faseModeloSchema).min(1),
});
export type CriarModeloDto = z.infer<typeof criarModeloSchema>;

export const atualizarModeloSchema = criarModeloSchema
  .extend({
    status: z.enum(["RASCUNHO", "PUBLICADO", "INATIVO"]).optional(),
  })
  .partial()
  .refine((dto) => Object.keys(dto).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });
export type AtualizarModeloDto = z.infer<typeof atualizarModeloSchema>;

export const listarModelosSchema = z.object({
  status: z.enum(["RASCUNHO", "PUBLICADO", "INATIVO", "todos"]).default("PUBLICADO"),
  categoriaId: z.string().uuid().optional(),
  busca: z.string().trim().max(120).optional(),
});
export type ListarModelosDto = z.infer<typeof listarModelosSchema>;

export const iniciarExecucaoSchema = z.object({
  titulo: z.string().trim().min(3).max(220),
  teste: z.boolean().optional().default(false),
});
export type IniciarExecucaoDto = z.infer<typeof iniciarExecucaoSchema>;

export const listarExecucoesSchema = z.object({
  status: z
    .enum(["EM_ANDAMENTO", "CONCLUIDA", "CANCELADA", "todos"])
    .default("EM_ANDAMENTO"),
  teste: z.coerce.boolean().optional(),
  busca: z.string().trim().max(120).optional(),
});
export type ListarExecucoesDto = z.infer<typeof listarExecucoesSchema>;

export const editarTituloExecucaoSchema = z.object({
  titulo: z.string().trim().min(3).max(220),
});
export type EditarTituloExecucaoDto = z.infer<
  typeof editarTituloExecucaoSchema
>;

export const atualizarEtapaSchema = z.object({
  concluida: z.boolean().optional(),
  observacao: z.string().trim().max(4000).nullable().optional(),
});
export type AtualizarEtapaDto = z.infer<typeof atualizarEtapaSchema>;

export const motivoObrigatorioSchema = z.object({
  motivo: z.string().trim().min(5).max(1000),
});
export type MotivoObrigatorioDto = z.infer<typeof motivoObrigatorioSchema>;

export const reordenarSchema = z.object({
  itens: z.array(itemOrdenadoSchema).min(1),
});
export type ReordenarDto = z.infer<typeof reordenarSchema>;
```

- [ ] **Step 3.4: Criar constantes e tipos internos**

Crie `services/api/src/modules/workflows/workflows.constants.ts`:

```typescript
import type { UserRole } from "@essencia/shared/types";

export const WORKFLOW_ROLES_ACESSO = [
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
] as const satisfies readonly UserRole[];

export const WORKFLOW_GESTAO_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "coordenadora_geral",
] as const satisfies readonly UserRole[];

export const CATEGORIAS_PADRAO = [
  "Eventos",
  "Documentos",
  "Matricula",
  "Pedagogico",
  "Administrativo",
] as const;

export const SUGESTOES_POR_CATEGORIA = {
  eventos: {
    orientacoes: [
      { titulo: "Objetivo", conteudo: "Descreva o objetivo do evento." },
      { titulo: "Publico", conteudo: "Informe o publico participante." },
      { titulo: "Materiais", conteudo: "Liste materiais necessarios." },
      { titulo: "Comunicacao", conteudo: "Defina como as familias serao comunicadas." },
    ],
    fases: [
      {
        nome: "Preparacao",
        etapas: [
          { titulo: "Definir data e horario", instrucao: "Validar no calendario escolar." },
          { titulo: "Confirmar espaco", instrucao: "Reservar local e recursos." },
        ],
      },
      {
        nome: "Comunicacao",
        etapas: [
          { titulo: "Enviar comunicado", instrucao: "Enviar informacoes para as familias." },
          { titulo: "Confirmar participacao", instrucao: "Acompanhar retornos recebidos." },
        ],
      },
      {
        nome: "Finalizacao",
        etapas: [
          { titulo: "Registrar ocorrencias", instrucao: "Anotar aprendizados e pendencias." },
        ],
      },
    ],
  },
  documentos: {
    orientacoes: [
      { titulo: "Documentos necessarios", conteudo: "Liste todos os arquivos exigidos." },
      { titulo: "Onde enviar", conteudo: "Informe canal, sistema ou responsavel pelo recebimento." },
    ],
    fases: [
      {
        nome: "Preparacao",
        etapas: [
          { titulo: "Reunir documentos", instrucao: "Conferir lista obrigatoria." },
          { titulo: "Validar dados", instrucao: "Checar nomes, datas e assinaturas." },
        ],
      },
      {
        nome: "Envio",
        etapas: [
          { titulo: "Enviar documentos", instrucao: "Registrar protocolo quando houver." },
          { titulo: "Acompanhar retorno", instrucao: "Verificar aprovacao ou exigencias." },
        ],
      },
    ],
  },
  matricula: {
    orientacoes: [
      { titulo: "Dados do aluno", conteudo: "Informe dados e documentos iniciais." },
      { titulo: "Responsaveis", conteudo: "Registre responsaveis e contatos." },
    ],
    fases: [
      {
        nome: "Cadastro",
        etapas: [
          { titulo: "Conferir documentos", instrucao: "Validar documentos obrigatorios." },
          { titulo: "Cadastrar aluno", instrucao: "Registrar aluno no sistema." },
        ],
      },
      {
        nome: "Integracao",
        etapas: [
          { titulo: "Comunicar professora", instrucao: "Avisar turma sobre entrada do aluno." },
          { titulo: "Orientar familia", instrucao: "Enviar informacoes iniciais." },
        ],
      },
    ],
  },
  pedagogico: {
    orientacoes: [
      { titulo: "Objetivo pedagogico", conteudo: "Descreva o objetivo da rotina." },
      { titulo: "Evidencias", conteudo: "Defina registros esperados." },
    ],
    fases: [
      {
        nome: "Planejamento",
        etapas: [
          { titulo: "Definir responsaveis", instrucao: "Alinhar quem executa cada acao." },
          { titulo: "Preparar materiais", instrucao: "Separar materiais pedagogicos." },
        ],
      },
      {
        nome: "Acompanhamento",
        etapas: [
          { titulo: "Registrar andamento", instrucao: "Anotar observacoes relevantes." },
        ],
      },
    ],
  },
  administrativo: {
    orientacoes: [
      { titulo: "Objetivo", conteudo: "Descreva a rotina administrativa." },
      { titulo: "Prazos", conteudo: "Informe prazos e dependencias externas." },
    ],
    fases: [
      {
        nome: "Organizacao",
        etapas: [
          { titulo: "Levantar informacoes", instrucao: "Conferir dados necessarios." },
          { titulo: "Executar rotina", instrucao: "Realizar procedimento definido." },
        ],
      },
      {
        nome: "Conferencia",
        etapas: [
          { titulo: "Conferir resultado", instrucao: "Validar se nao ha pendencias." },
        ],
      },
    ],
  },
} as const;
```

Crie `services/api/src/modules/workflows/workflows.types.ts`:

```typescript
import type { WorkflowHistoricoTipo } from "@essencia/db";

export interface WorkflowUserContext {
  userId: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
  stageId: string | null;
}

export interface ArquivoWorkflowUpload {
  buffer: Buffer;
  nomeOriginal: string;
  mimetype: string;
  tamanhoBytes: number;
}

export interface ArquivoWorkflowSalvo {
  url: string;
  storageKey: string;
  nomeOriginal: string;
  mimetype: string;
  tamanhoBytes: number;
}

export interface RegistrarHistoricoParams {
  execucaoId: string;
  tipo: WorkflowHistoricoTipo;
  descricao: string;
  autorId: string;
  motivo?: string | null;
  metadata?: Record<string, unknown> | null;
}
```

- [ ] **Step 3.5: Criar services minimos e controller**

Crie services com metodos declarados usados pelo controller. Exemplo para `workflows-categorias.service.ts`:

```typescript
import { Injectable } from "@nestjs/common";

import type {
  AtualizarCategoriaDto,
  CriarCategoriaDto,
} from "./dto/workflows.dto";
import type { WorkflowUserContext } from "./workflows.types";

@Injectable()
export class WorkflowsCategoriasService {
  async listar(_session: WorkflowUserContext) {
    return [];
  }

  async criar(_session: WorkflowUserContext, _dto: CriarCategoriaDto) {
    return null;
  }

  async atualizar(
    _session: WorkflowUserContext,
    _categoriaId: string,
    _dto: AtualizarCategoriaDto,
  ) {
    return null;
  }

  async obterSugestoes(_session: WorkflowUserContext, _categoriaId: string) {
    return { orientacoes: [], fases: [] };
  }
}
```

Crie `services/api/src/modules/workflows/workflows-modelos.service.ts`:

```typescript
import { Injectable } from "@nestjs/common";

import type {
  AtualizarModeloDto,
  CriarModeloDto,
  ListarModelosDto,
} from "./dto/workflows.dto";
import type { WorkflowUserContext } from "./workflows.types";

@Injectable()
export class WorkflowsModelosService {
  async listar(_session: WorkflowUserContext, _dto: ListarModelosDto) {
    return [];
  }

  async criar(_session: WorkflowUserContext, _dto: CriarModeloDto) {
    return null;
  }

  async buscarPorId(_session: WorkflowUserContext, _modeloId: string) {
    return null;
  }

  async atualizar(
    _session: WorkflowUserContext,
    _modeloId: string,
    _dto: AtualizarModeloDto,
  ) {
    return null;
  }

  async publicar(_session: WorkflowUserContext, _modeloId: string) {
    return null;
  }

  async inativar(_session: WorkflowUserContext, _modeloId: string) {
    return null;
  }

  async duplicar(_session: WorkflowUserContext, _modeloId: string) {
    return null;
  }
}
```

Crie `services/api/src/modules/workflows/workflows-execucoes.service.ts`:

```typescript
import { Injectable } from "@nestjs/common";

import type {
  AtualizarEtapaDto,
  EditarTituloExecucaoDto,
  IniciarExecucaoDto,
  ListarExecucoesDto,
  MotivoObrigatorioDto,
} from "./dto/workflows.dto";
import type { WorkflowUserContext } from "./workflows.types";

@Injectable()
export class WorkflowsExecucoesService {
  async iniciar(
    _session: WorkflowUserContext,
    _modeloId: string,
    _dto: IniciarExecucaoDto,
  ) {
    return null;
  }

  async listar(_session: WorkflowUserContext, _dto: ListarExecucoesDto) {
    return [];
  }

  async buscarPorId(_session: WorkflowUserContext, _execucaoId: string) {
    return null;
  }

  async editarTitulo(
    _session: WorkflowUserContext,
    _execucaoId: string,
    _dto: EditarTituloExecucaoDto,
  ) {
    return null;
  }

  async atualizarEtapa(
    _session: WorkflowUserContext,
    _execucaoId: string,
    _etapaId: string,
    _dto: AtualizarEtapaDto,
  ) {
    return null;
  }

  async concluir(_session: WorkflowUserContext, _execucaoId: string) {
    return null;
  }

  async cancelar(
    _session: WorkflowUserContext,
    _execucaoId: string,
    _dto: MotivoObrigatorioDto,
  ) {
    return null;
  }

  async reabrir(
    _session: WorkflowUserContext,
    _execucaoId: string,
    _dto: MotivoObrigatorioDto,
  ) {
    return null;
  }

  async descartarTeste(_session: WorkflowUserContext, _execucaoId: string) {
    return undefined;
  }
}
```

Crie `services/api/src/modules/workflows/workflows-anexos.service.ts`:

```typescript
import { Injectable } from "@nestjs/common";

import type { ArquivoWorkflowSalvo, WorkflowUserContext } from "./workflows.types";

@Injectable()
export class WorkflowsAnexosService {
  async registrarUpload(
    _session: WorkflowUserContext,
    _execucaoId: string,
    _arquivo: ArquivoWorkflowSalvo,
  ) {
    return null;
  }

  async remover(
    _session: WorkflowUserContext,
    _execucaoId: string,
    _anexoId: string,
  ) {
    return undefined;
  }
}
```

Crie `services/api/src/modules/workflows/workflows-historico.service.ts`:

```typescript
import { Injectable } from "@nestjs/common";

import type { RegistrarHistoricoParams } from "./workflows.types";

@Injectable()
export class WorkflowsHistoricoService {
  async registrar(_params: RegistrarHistoricoParams) {
    return undefined;
  }
}
```

O controller deve validar com Zod antes de chamar service:

```typescript
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";

import { Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import {
  atualizarCategoriaSchema,
  criarCategoriaSchema,
  listarModelosSchema,
} from "./dto/workflows.dto";
import { WORKFLOW_GESTAO_ROLES, WORKFLOW_ROLES_ACESSO } from "./workflows.constants";
import { WorkflowsCategoriasService } from "./workflows-categorias.service";
import { WorkflowsModelosService } from "./workflows-modelos.service";
import type { WorkflowUserContext } from "./workflows.types";

type RequestComUsuario = { user: WorkflowUserContext };

@Controller("workflows")
@UseGuards(AuthGuard, RolesGuard)
export class WorkflowsController {
  constructor(
    private readonly categoriasService: WorkflowsCategoriasService,
    private readonly modelosService: WorkflowsModelosService,
  ) {}

  private validar<T>(schema: { safeParse: (input: unknown) => { success: true; data: T } | { success: false; error: { errors: unknown[] } } }, input: unknown): T {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dados invalidos",
        errors: parsed.error.errors,
      });
    }
    return parsed.data;
  }

  @Get("categorias")
  @Roles(...WORKFLOW_ROLES_ACESSO)
  async listarCategorias(@Req() req: RequestComUsuario) {
    return {
      success: true,
      data: await this.categoriasService.listar(req.user),
    };
  }

  @Post("categorias")
  @Roles(...WORKFLOW_GESTAO_ROLES)
  async criarCategoria(
    @Req() req: RequestComUsuario,
    @Body() body: unknown,
  ) {
    const dto = this.validar(criarCategoriaSchema, body);
    return {
      success: true,
      data: await this.categoriasService.criar(req.user, dto),
    };
  }

  @Patch("categorias/:categoriaId")
  @Roles(...WORKFLOW_GESTAO_ROLES)
  async atualizarCategoria(
    @Req() req: RequestComUsuario,
    @Param("categoriaId") categoriaId: string,
    @Body() body: unknown,
  ) {
    const dto = this.validar(atualizarCategoriaSchema, body);
    return {
      success: true,
      data: await this.categoriasService.atualizar(req.user, categoriaId, dto),
    };
  }

  @Get("categorias/:categoriaId/sugestoes")
  @Roles(...WORKFLOW_GESTAO_ROLES)
  async obterSugestoesCategoria(
    @Req() req: RequestComUsuario,
    @Param("categoriaId") categoriaId: string,
  ) {
    return {
      success: true,
      data: await this.categoriasService.obterSugestoes(req.user, categoriaId),
    };
  }

  @Get("modelos")
  @Roles(...WORKFLOW_ROLES_ACESSO)
  async listarModelos(@Req() req: RequestComUsuario, @Query() query: unknown) {
    const dto = this.validar(listarModelosSchema, query);
    return {
      success: true,
      data: await this.modelosService.listar(req.user, dto),
    };
  }
}
```

- [ ] **Step 3.6: Criar module e registrar no app**

Crie `services/api/src/modules/workflows/workflows.module.ts`:

```typescript
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../../common/database/database.module";
import { StorageModule } from "../../common/storage/storage.module";
import { WorkflowsAnexosService } from "./workflows-anexos.service";
import { WorkflowsCategoriasService } from "./workflows-categorias.service";
import { WorkflowsController } from "./workflows.controller";
import { WorkflowsExecucoesService } from "./workflows-execucoes.service";
import { WorkflowsHistoricoService } from "./workflows-historico.service";
import { WorkflowsModelosService } from "./workflows-modelos.service";

@Module({
  imports: [AuthModule, DatabaseModule, StorageModule.forRoot()],
  controllers: [WorkflowsController],
  providers: [
    WorkflowsCategoriasService,
    WorkflowsModelosService,
    WorkflowsExecucoesService,
    WorkflowsAnexosService,
    WorkflowsHistoricoService,
  ],
  exports: [WorkflowsCategoriasService, WorkflowsModelosService, WorkflowsExecucoesService],
})
export class WorkflowsModule {}
```

Modifique `services/api/src/app.module.ts`:

```typescript
import { WorkflowsModule } from "./modules/workflows/workflows.module";
```

Adicione em `imports` depois de `SuporteModule`:

```typescript
    // Workflows operacionais internos
    WorkflowsModule,
```

- [ ] **Step 3.7: Rodar teste e typecheck**

Run:

```bash
pnpm --filter @essencia/api test -- workflows.controller
pnpm --filter @essencia/api typecheck
```

Expected: PASS. O typecheck pode exigir completar os metodos minimos dos services com assinaturas usadas no controller.

- [ ] **Step 3.8: Commit**

```bash
git add services/api/src/modules/workflows services/api/src/app.module.ts
git commit -m "feat(workflows): registra modulo api"
```

## Task 4: Categorias e Sugestoes

**Files:**
- Modify: `services/api/src/modules/workflows/workflows-categorias.service.ts`
- Test: `services/api/src/modules/workflows/workflows-categorias.service.spec.ts`

- [ ] **Step 4.1: Escrever testes de categorias**

Crie `services/api/src/modules/workflows/workflows-categorias.service.spec.ts`:

```typescript
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { DatabaseService } from "../../common/database/database.service";
import { WorkflowsCategoriasService } from "./workflows-categorias.service";

const mockDb = {
  query: {
    workflowCategorias: { findMany: jest.fn(), findFirst: jest.fn() },
  },
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  onConflictDoNothing: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
};

jest.mock("@essencia/db", () => ({
  and: jest.fn(),
  asc: jest.fn(),
  eq: jest.fn(),
  workflowCategorias: {},
}));

const databaseService = { db: mockDb };

const gestao = {
  userId: "gestor-1",
  role: "coordenadora_geral",
  schoolId: "school-1",
  unitId: "unit-1",
  stageId: null,
};

describe("WorkflowsCategoriasService", () => {
  let service: WorkflowsCategoriasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsCategoriasService,
        { provide: DatabaseService, useValue: databaseService },
      ],
    }).compile();

    service = module.get(WorkflowsCategoriasService);
    jest.clearAllMocks();
  });

  it("exige unidade na sessao", async () => {
    await expect(
      service.listar({ ...gestao, unitId: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("cria categorias padrao antes de listar", async () => {
    mockDb.query.workflowCategorias.findMany.mockResolvedValue([]);

    await service.listar(gestao);

    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ nome: "Eventos", unitId: "unit-1" }),
        expect.objectContaining({ nome: "Documentos", unitId: "unit-1" }),
      ]),
    );
  });

  it("bloqueia criacao para usuario comum", async () => {
    await expect(
      service.criar({ ...gestao, role: "professora" }, { nome: "Rotinas" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("retorna sugestoes de eventos pela categoria da unidade", async () => {
    mockDb.query.workflowCategorias.findFirst.mockResolvedValue({
      id: "cat-1",
      nome: "Eventos",
      schoolId: "school-1",
      unitId: "unit-1",
    });

    const sugestoes = await service.obterSugestoes(gestao, "cat-1");

    expect(sugestoes.fases[0].nome).toBe("Preparacao");
    expect(sugestoes.orientacoes[0].titulo).toBe("Objetivo");
  });

  it("retorna 404 para categoria de outra unidade", async () => {
    mockDb.query.workflowCategorias.findFirst.mockResolvedValue(null);

    await expect(service.obterSugestoes(gestao, "cat-outra")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
```

- [ ] **Step 4.2: Rodar teste e confirmar falha**

Run:

```bash
pnpm --filter @essencia/api test -- workflows-categorias.service
```

Expected: FAIL porque o service ainda retorna dados vazios e nao valida permissao.

- [ ] **Step 4.3: Implementar service de categorias**

Substitua `workflows-categorias.service.ts` por implementacao com:

```typescript
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq, workflowCategorias } from "@essencia/db";

import { DatabaseService } from "../../common/database/database.service";
import type {
  AtualizarCategoriaDto,
  CriarCategoriaDto,
} from "./dto/workflows.dto";
import {
  CATEGORIAS_PADRAO,
  SUGESTOES_POR_CATEGORIA,
  WORKFLOW_GESTAO_ROLES,
} from "./workflows.constants";
import type { WorkflowUserContext } from "./workflows.types";

@Injectable()
export class WorkflowsCategoriasService {
  constructor(private readonly database: DatabaseService) {}

  private validarTenant(session: WorkflowUserContext): asserts session is WorkflowUserContext & { schoolId: string; unitId: string } {
    if (!session.schoolId || !session.unitId) {
      throw new BadRequestException("Sessao invalida: escola e unidade sao obrigatorias");
    }
  }

  private exigirGestao(session: WorkflowUserContext) {
    if (!(WORKFLOW_GESTAO_ROLES as readonly string[]).includes(session.role)) {
      throw new ForbiddenException("Voce nao tem permissao para gerenciar categorias de workflows");
    }
  }

  private normalizarCategoria(nome: string): keyof typeof SUGESTOES_POR_CATEGORIA {
    const normalizada = nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (normalizada.includes("evento")) return "eventos";
    if (normalizada.includes("document")) return "documentos";
    if (normalizada.includes("matricula")) return "matricula";
    if (normalizada.includes("pedagog")) return "pedagogico";
    return "administrativo";
  }

  private async garantirCategoriasPadrao(session: WorkflowUserContext & { schoolId: string; unitId: string }) {
    await this.database.db
      .insert(workflowCategorias)
      .values(
        CATEGORIAS_PADRAO.map((nome, index) => ({
          schoolId: session.schoolId,
          unitId: session.unitId,
          nome,
          ordem: index + 1,
        })),
      )
      .onConflictDoNothing();
  }

  async listar(session: WorkflowUserContext) {
    this.validarTenant(session);
    await this.garantirCategoriasPadrao(session);

    return this.database.db.query.workflowCategorias.findMany({
      where: and(
        eq(workflowCategorias.schoolId, session.schoolId),
        eq(workflowCategorias.unitId, session.unitId),
      ),
      orderBy: [asc(workflowCategorias.ordem), asc(workflowCategorias.nome)],
    });
  }

  async criar(session: WorkflowUserContext, dto: CriarCategoriaDto) {
    this.validarTenant(session);
    this.exigirGestao(session);

    const [categoria] = await this.database.db
      .insert(workflowCategorias)
      .values({
        schoolId: session.schoolId,
        unitId: session.unitId,
        nome: dto.nome,
        ordem: dto.ordem ?? 999,
      })
      .returning();

    return categoria;
  }

  async atualizar(
    session: WorkflowUserContext,
    categoriaId: string,
    dto: AtualizarCategoriaDto,
  ) {
    this.validarTenant(session);
    this.exigirGestao(session);

    const [categoria] = await this.database.db
      .update(workflowCategorias)
      .set({ ...dto, updatedAt: new Date() })
      .where(
        and(
          eq(workflowCategorias.id, categoriaId),
          eq(workflowCategorias.schoolId, session.schoolId),
          eq(workflowCategorias.unitId, session.unitId),
        ),
      )
      .returning();

    if (!categoria) {
      throw new NotFoundException("Categoria nao encontrada");
    }

    return categoria;
  }

  async obterSugestoes(session: WorkflowUserContext, categoriaId: string) {
    this.validarTenant(session);
    this.exigirGestao(session);

    const categoria = await this.database.db.query.workflowCategorias.findFirst({
      where: and(
        eq(workflowCategorias.id, categoriaId),
        eq(workflowCategorias.schoolId, session.schoolId),
        eq(workflowCategorias.unitId, session.unitId),
      ),
    });

    if (!categoria) {
      throw new NotFoundException("Categoria nao encontrada");
    }

    return SUGESTOES_POR_CATEGORIA[this.normalizarCategoria(categoria.nome)];
  }
}
```

- [ ] **Step 4.4: Rodar teste e typecheck**

Run:

```bash
pnpm --filter @essencia/api test -- workflows-categorias.service
pnpm --filter @essencia/api typecheck
```

Expected: PASS.

- [ ] **Step 4.5: Commit**

```bash
git add services/api/src/modules/workflows/workflows-categorias.service.ts services/api/src/modules/workflows/workflows-categorias.service.spec.ts
git commit -m "feat(workflows): implementa categorias por unidade"
```

## Task 5: Modelos de Workflow

**Files:**
- Modify: `services/api/src/modules/workflows/workflows-modelos.service.ts`
- Modify: `services/api/src/modules/workflows/workflows.controller.ts`
- Test: `services/api/src/modules/workflows/workflows-modelos.service.spec.ts`

- [ ] **Step 5.1: Escrever testes de modelos**

Crie `services/api/src/modules/workflows/workflows-modelos.service.spec.ts` cobrindo:

```typescript
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { DatabaseService } from "../../common/database/database.service";
import { WorkflowsHistoricoService } from "./workflows-historico.service";
import { WorkflowsModelosService } from "./workflows-modelos.service";

const tx = {
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  delete: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
};

const db = {
  query: {
    workflowCategorias: { findFirst: jest.fn() },
    workflowModelos: { findFirst: jest.fn(), findMany: jest.fn() },
    workflowExecucoes: { findMany: jest.fn() },
  },
  transaction: jest.fn(async (cb: (txParam: typeof tx) => unknown) => cb(tx)),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  returning: jest.fn(),
};

jest.mock("@essencia/db", () => ({
  and: jest.fn(),
  asc: jest.fn(),
  desc: jest.fn(),
  eq: jest.fn(),
  ilike: jest.fn(),
  inArray: jest.fn(),
  workflowCategorias: {},
  workflowEtapaProgresso: {},
  workflowEtapas: {},
  workflowExecucoes: {},
  workflowFases: {},
  workflowModelos: {},
  workflowOrientacoes: {},
}));

const gestao = {
  userId: "gestor-1",
  role: "coordenadora_geral",
  schoolId: "school-1",
  unitId: "unit-1",
  stageId: null,
};

const dtoModelo = {
  categoriaId: "cat-1",
  nome: "Evento Dia dos Pais",
  descricaoCurta: "Fluxo do evento",
  orientacoes: [{ titulo: "Objetivo", conteudo: "Organizar", ordem: 1 }],
  fases: [
    {
      nome: "Preparacao",
      ordem: 1,
      etapas: [{ titulo: "Definir data", instrucao: null, ordem: 1 }],
    },
  ],
};

describe("WorkflowsModelosService", () => {
  let service: WorkflowsModelosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsModelosService,
        { provide: DatabaseService, useValue: { db } },
        { provide: WorkflowsHistoricoService, useValue: { registrar: jest.fn() } },
      ],
    }).compile();
    service = module.get(WorkflowsModelosService);
    jest.clearAllMocks();
  });

  it("bloqueia criacao por usuario comum", async () => {
    await expect(
      service.criar({ ...gestao, role: "professora" }, dtoModelo),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("bloqueia categoria de outra unidade", async () => {
    db.query.workflowCategorias.findFirst.mockResolvedValue(null);

    await expect(service.criar(gestao, dtoModelo)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("cria modelo com orientacoes, fases e etapas em transacao", async () => {
    db.query.workflowCategorias.findFirst.mockResolvedValue({ id: "cat-1" });
    tx.returning
      .mockResolvedValueOnce([{ id: "modelo-1" }])
      .mockResolvedValueOnce([{ id: "fase-1" }]);

    await service.criar(gestao, dtoModelo);

    expect(db.transaction).toHaveBeenCalled();
    expect(tx.insert).toHaveBeenCalled();
    expect(tx.values).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: "school-1",
        unitId: "unit-1",
        status: "RASCUNHO",
      }),
    );
  });

  it("reset etapa alterada em execucoes abertas de modelo publicado", async () => {
    const modeloPublicado = {
      id: "modelo-1",
      status: "PUBLICADO",
      schoolId: "school-1",
      unitId: "unit-1",
      fases: [{ id: "fase-1", etapas: [{ id: "etapa-1", titulo: "Antigo", instrucao: null, ordem: 1 }] }],
    };
    db.query.workflowModelos.findFirst.mockResolvedValue(modeloPublicado);

    await service.atualizar(gestao, "modelo-1", {
      fases: [{ id: "fase-1", nome: "Preparacao", ordem: 1, etapas: [{ id: "etapa-1", titulo: "Novo", instrucao: null, ordem: 1 }] }],
    });

    expect(tx.update).toHaveBeenCalled();
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({
        concluida: false,
        concluidaPor: null,
        concluidaAt: null,
      }),
    );
  });

  it("nao lista rascunhos para usuario comum", async () => {
    db.query.workflowModelos.findMany.mockResolvedValue([]);

    await service.listar({ ...gestao, role: "professora" }, { status: "todos" });

    expect(db.query.workflowModelos.findMany).toHaveBeenCalled();
  });
});
```

- [ ] **Step 5.2: Rodar teste e confirmar falha**

Run:

```bash
pnpm --filter @essencia/api test -- workflows-modelos.service
```

Expected: FAIL por regras nao implementadas.

- [ ] **Step 5.3: Implementar service de modelos**

Implemente em `workflows-modelos.service.ts`:

- `validarTenant(session)` igual ao service de categorias.
- `exigirGestao(session)` usando `WORKFLOW_GESTAO_ROLES`.
- `buscarCategoriaDaUnidade(session, categoriaId)`.
- `listar(session, dto)`: usuarios comuns sempre forcam `status = "PUBLICADO"`; gestao pode listar todos.
- `buscarPorId(session, modeloId)`: usuario comum so acessa `PUBLICADO`; gestao acessa todos da unidade.
- `criar(session, dto)`: transacao que cria modelo `RASCUNHO`, orientacoes, fases e etapas.
- `atualizar(session, modeloId, dto)`: gestao apenas; atualiza cabecalho e substitui colecoes de orientacoes/fases/etapas. Para etapas existentes alteradas em modelo `PUBLICADO`, incremente `versao`, zere progresso em execucoes abertas e marque `modeloAtualizado`.
- `publicar(session, modeloId)`: exige pelo menos uma fase e uma etapa; status `PUBLICADO`.
- `inativar(session, modeloId)`: status `INATIVO`.
- `duplicar(session, modeloId)`: copia modelo completo como `RASCUNHO` com nome `Copia de ${nome}`.

Use este helper para detectar etapa alterada:

```typescript
private etapaMudou(
  etapaAtual: { titulo: string; instrucao: string | null },
  etapaNova: { titulo: string; instrucao?: string | null },
) {
  return (
    etapaAtual.titulo !== etapaNova.titulo ||
    (etapaAtual.instrucao ?? null) !== (etapaNova.instrucao ?? null)
  );
}
```

Use este reset dentro da transacao quando uma etapa publicada mudar:

```typescript
await tx
  .update(workflowEtapaProgresso)
  .set({
    concluida: false,
    concluidaPor: null,
    concluidaAt: null,
    etapaVersao: novaVersao,
    updatedAt: new Date(),
  })
  .where(eq(workflowEtapaProgresso.etapaId, etapaId));

await tx
  .update(workflowExecucoes)
  .set({ modeloAtualizado: true, updatedAt: new Date() })
  .where(
    and(
      eq(workflowExecucoes.modeloId, modeloId),
      eq(workflowExecucoes.status, "EM_ANDAMENTO"),
    ),
  );
```

No fim da atualizacao de modelo publicado, registre historico `MODELO_ATUALIZADO` para cada execucao aberta impactada usando `WorkflowsHistoricoService`.

- [ ] **Step 5.4: Completar endpoints de modelo no controller**

Adicione ao `WorkflowsController`:

```typescript
@Post("modelos")
@Roles(...WORKFLOW_GESTAO_ROLES)
async criarModelo(@Req() req: RequestComUsuario, @Body() body: unknown) {
  const dto = this.validar(criarModeloSchema, body);
  return { success: true, data: await this.modelosService.criar(req.user, dto) };
}

@Get("modelos/:modeloId")
@Roles(...WORKFLOW_ROLES_ACESSO)
async buscarModelo(@Req() req: RequestComUsuario, @Param("modeloId") modeloId: string) {
  return { success: true, data: await this.modelosService.buscarPorId(req.user, modeloId) };
}

@Patch("modelos/:modeloId")
@Roles(...WORKFLOW_GESTAO_ROLES)
async atualizarModelo(@Req() req: RequestComUsuario, @Param("modeloId") modeloId: string, @Body() body: unknown) {
  const dto = this.validar(atualizarModeloSchema, body);
  return { success: true, data: await this.modelosService.atualizar(req.user, modeloId, dto) };
}

@Post("modelos/:modeloId/publicar")
@Roles(...WORKFLOW_GESTAO_ROLES)
async publicarModelo(@Req() req: RequestComUsuario, @Param("modeloId") modeloId: string) {
  return { success: true, data: await this.modelosService.publicar(req.user, modeloId) };
}

@Post("modelos/:modeloId/inativar")
@Roles(...WORKFLOW_GESTAO_ROLES)
async inativarModelo(@Req() req: RequestComUsuario, @Param("modeloId") modeloId: string) {
  return { success: true, data: await this.modelosService.inativar(req.user, modeloId) };
}

@Post("modelos/:modeloId/duplicar")
@Roles(...WORKFLOW_GESTAO_ROLES)
async duplicarModelo(@Req() req: RequestComUsuario, @Param("modeloId") modeloId: string) {
  return { success: true, data: await this.modelosService.duplicar(req.user, modeloId) };
}
```

- [ ] **Step 5.5: Rodar testes**

Run:

```bash
pnpm --filter @essencia/api test -- workflows-modelos.service workflows.controller
pnpm --filter @essencia/api typecheck
```

Expected: PASS.

- [ ] **Step 5.6: Commit**

```bash
git add services/api/src/modules/workflows
git commit -m "feat(workflows): implementa modelos reutilizaveis"
```

## Task 6: Execucoes, Checklist e Historico

**Files:**
- Modify: `services/api/src/modules/workflows/workflows-execucoes.service.ts`
- Modify: `services/api/src/modules/workflows/workflows-historico.service.ts`
- Modify: `services/api/src/modules/workflows/workflows.controller.ts`
- Test: `services/api/src/modules/workflows/workflows-execucoes.service.spec.ts`
- Test: `services/api/src/modules/workflows/workflows-historico.service.spec.ts`

- [ ] **Step 6.1: Escrever testes de historico**

Crie `workflows-historico.service.spec.ts`:

```typescript
import { Test, TestingModule } from "@nestjs/testing";

import { DatabaseService } from "../../common/database/database.service";
import { WorkflowsHistoricoService } from "./workflows-historico.service";

const db = {
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
};

jest.mock("@essencia/db", () => ({
  workflowHistorico: {},
}));

describe("WorkflowsHistoricoService", () => {
  let service: WorkflowsHistoricoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsHistoricoService,
        { provide: DatabaseService, useValue: { db } },
      ],
    }).compile();
    service = module.get(WorkflowsHistoricoService);
    jest.clearAllMocks();
  });

  it("serializa metadata e registra evento", async () => {
    await service.registrar({
      execucaoId: "exec-1",
      tipo: "WORKFLOW_INICIADO",
      descricao: "Workflow iniciado",
      autorId: "user-1",
      metadata: { titulo: "Evento" },
    });

    expect(db.values).toHaveBeenCalledWith(
      expect.objectContaining({
        execucaoId: "exec-1",
        tipo: "WORKFLOW_INICIADO",
        metadata: "{\"titulo\":\"Evento\"}",
      }),
    );
  });
});
```

- [ ] **Step 6.2: Escrever testes de execucoes**

Crie `workflows-execucoes.service.spec.ts` com casos:

```typescript
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { DatabaseService } from "../../common/database/database.service";
import { WorkflowsHistoricoService } from "./workflows-historico.service";
import { WorkflowsExecucoesService } from "./workflows-execucoes.service";

const tx = {
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
};

const db = {
  query: {
    workflowModelos: { findFirst: jest.fn() },
    workflowExecucoes: { findFirst: jest.fn(), findMany: jest.fn() },
  },
  transaction: jest.fn(async (cb: (txParam: typeof tx) => unknown) => cb(tx)),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  returning: jest.fn(),
};

jest.mock("@essencia/db", () => ({
  and: jest.fn(),
  asc: jest.fn(),
  desc: jest.fn(),
  eq: jest.fn(),
  ne: jest.fn(),
  or: jest.fn(),
  workflowEtapaProgresso: {},
  workflowExecucoes: {},
  workflowHistorico: {},
  workflowModelos: {},
}));

const professora = {
  userId: "prof-1",
  role: "professora",
  schoolId: "school-1",
  unitId: "unit-1",
  stageId: null,
};

const gestao = { ...professora, userId: "gestor-1", role: "coordenadora_geral" };

const modeloPublicado = {
  id: "modelo-1",
  status: "PUBLICADO",
  schoolId: "school-1",
  unitId: "unit-1",
  fases: [{ etapas: [{ id: "etapa-1", versao: 1 }] }],
};

describe("WorkflowsExecucoesService", () => {
  let service: WorkflowsExecucoesService;
  const historico = { registrar: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsExecucoesService,
        { provide: DatabaseService, useValue: { db } },
        { provide: WorkflowsHistoricoService, useValue: historico },
      ],
    }).compile();
    service = module.get(WorkflowsExecucoesService);
    jest.clearAllMocks();
  });

  it("inicia execucao real de modelo publicado para usuario comum", async () => {
    db.query.workflowModelos.findFirst.mockResolvedValue(modeloPublicado);
    tx.returning.mockResolvedValue([{ id: "exec-1", titulo: "Evento" }]);

    await service.iniciar(professora, "modelo-1", { titulo: "Evento", teste: false });

    expect(tx.values).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: "school-1",
        unitId: "unit-1",
        modeloId: "modelo-1",
        teste: false,
        iniciadoPor: "prof-1",
      }),
    );
    expect(historico.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "WORKFLOW_INICIADO" }),
    );
  });

  it("bloqueia usuario comum iniciando teste de rascunho", async () => {
    db.query.workflowModelos.findFirst.mockResolvedValue({
      ...modeloPublicado,
      status: "RASCUNHO",
    });

    await expect(
      service.iniciar(professora, "modelo-1", { titulo: "Teste", teste: true }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("bloqueia concluir workflow com etapa pendente", async () => {
    db.query.workflowExecucoes.findFirst.mockResolvedValue({
      id: "exec-1",
      status: "EM_ANDAMENTO",
      iniciadoPor: "prof-1",
      unitId: "unit-1",
      teste: false,
      modelo: modeloPublicado,
      progresso: [{ etapaId: "etapa-1", concluida: false }],
    });

    await expect(service.concluir(professora, "exec-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("usuario comum nao ve execucao de outro usuario", async () => {
    db.query.workflowExecucoes.findFirst.mockResolvedValue({
      id: "exec-1",
      iniciadoPor: "outro-user",
      unitId: "unit-1",
      teste: false,
      status: "EM_ANDAMENTO",
    });

    await expect(service.buscarPorId(professora, "exec-1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("gestao reabre execucao concluida com motivo", async () => {
    db.query.workflowExecucoes.findFirst.mockResolvedValue({
      id: "exec-1",
      status: "CONCLUIDA",
      iniciadoPor: "prof-1",
      unitId: "unit-1",
      teste: false,
    });
    db.returning.mockResolvedValue([{ id: "exec-1", status: "EM_ANDAMENTO" }]);

    await service.reabrir(gestao, "exec-1", { motivo: "Ajuste necessario" });

    expect(db.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "EM_ANDAMENTO",
        concluidoAt: null,
      }),
    );
  });
});
```

- [ ] **Step 6.3: Rodar testes e confirmar falha**

Run:

```bash
pnpm --filter @essencia/api test -- workflows-historico.service workflows-execucoes.service
```

Expected: FAIL.

- [ ] **Step 6.4: Implementar historico**

Substitua `workflows-historico.service.ts`:

```typescript
import { Injectable } from "@nestjs/common";
import { workflowHistorico } from "@essencia/db";

import { DatabaseService } from "../../common/database/database.service";
import type { RegistrarHistoricoParams } from "./workflows.types";

@Injectable()
export class WorkflowsHistoricoService {
  constructor(private readonly database: DatabaseService) {}

  async registrar(params: RegistrarHistoricoParams) {
    await this.database.db.insert(workflowHistorico).values({
      execucaoId: params.execucaoId,
      tipo: params.tipo,
      descricao: params.descricao,
      motivo: params.motivo ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      autorId: params.autorId,
    });
  }
}
```

- [ ] **Step 6.5: Implementar service de execucoes**

Implemente em `workflows-execucoes.service.ts`:

- `iniciar`: valida modelo da unidade; usuario comum so inicia `PUBLICADO` e `teste=false`; gestao pode iniciar teste de `RASCUNHO`; cria execucao e um progresso pendente por etapa.
- `listar`: gestao lista todas da unidade; usuario comum lista apenas `iniciadoPor`; comuns nao veem `teste=true`.
- `buscarPorId`: mesma regra de visibilidade; monta detalhe com modelo, progresso, anexos e historico.
- `atualizarEtapa`: apenas execucao `EM_ANDAMENTO`; quem iniciou ou gestao; atualiza `concluida`, `observacao`, `concluidaPor`, `concluidaAt`; grava historico conforme mudanca.
- `editarTitulo`: gestao edita qualquer; usuario comum so propria; grava historico.
- `concluir`: exige todas etapas do modelo com progresso `concluida=true`; muda status para `CONCLUIDA`; grava historico.
- `cancelar`: usuario comum so propria; gestao qualquer; motivo obrigatorio ja validado no controller; muda para `CANCELADA`; grava historico.
- `reabrir`: gestao apenas; exige status `CONCLUIDA`; volta para `EM_ANDAMENTO`; grava historico.
- `descartarTeste`: gestao apenas; exige `teste=true`; deleta execucao.

Use helpers:

```typescript
private isGestao(role: string) {
  return (WORKFLOW_GESTAO_ROLES as readonly string[]).includes(role);
}

private podeVerExecucao(session: WorkflowUserContext, execucao: { iniciadoPor: string; teste: boolean }) {
  if (this.isGestao(session.role)) return true;
  return !execucao.teste && execucao.iniciadoPor === session.userId;
}
```

Calculo de conclusao:

```typescript
private todasEtapasConcluidas(modelo: { fases: Array<{ etapas: Array<{ id: string }> }> }, progresso: Array<{ etapaId: string; concluida: boolean }>) {
  const concluidas = new Set(
    progresso.filter((item) => item.concluida).map((item) => item.etapaId),
  );
  const etapas = modelo.fases.flatMap((fase) => fase.etapas);
  return etapas.length > 0 && etapas.every((etapa) => concluidas.has(etapa.id));
}
```

Calculo de fase atual para respostas:

```typescript
private calcularFaseAtual(modelo: { fases: Array<{ nome: string; etapas: Array<{ id: string }> }> }, progresso: Array<{ etapaId: string; concluida: boolean }>) {
  const concluidas = new Set(
    progresso.filter((item) => item.concluida).map((item) => item.etapaId),
  );
  const primeiraPendente = modelo.fases.find((fase) =>
    fase.etapas.some((etapa) => !concluidas.has(etapa.id)),
  );
  return primeiraPendente?.nome ?? null;
}
```

- [ ] **Step 6.6: Completar endpoints de execucao no controller**

Adicione:

```typescript
@Post("modelos/:modeloId/execucoes")
@Roles(...WORKFLOW_ROLES_ACESSO)
async iniciarExecucao(@Req() req: RequestComUsuario, @Param("modeloId") modeloId: string, @Body() body: unknown) {
  const dto = this.validar(iniciarExecucaoSchema, body);
  return { success: true, data: await this.execucoesService.iniciar(req.user, modeloId, dto) };
}

@Get("execucoes")
@Roles(...WORKFLOW_ROLES_ACESSO)
async listarExecucoes(@Req() req: RequestComUsuario, @Query() query: unknown) {
  const dto = this.validar(listarExecucoesSchema, query);
  return { success: true, data: await this.execucoesService.listar(req.user, dto) };
}

@Get("execucoes/:execucaoId")
@Roles(...WORKFLOW_ROLES_ACESSO)
async buscarExecucao(@Req() req: RequestComUsuario, @Param("execucaoId") execucaoId: string) {
  return { success: true, data: await this.execucoesService.buscarPorId(req.user, execucaoId) };
}

@Patch("execucoes/:execucaoId/titulo")
@Roles(...WORKFLOW_ROLES_ACESSO)
async editarTituloExecucao(@Req() req: RequestComUsuario, @Param("execucaoId") execucaoId: string, @Body() body: unknown) {
  const dto = this.validar(editarTituloExecucaoSchema, body);
  return { success: true, data: await this.execucoesService.editarTitulo(req.user, execucaoId, dto) };
}

@Patch("execucoes/:execucaoId/etapas/:etapaId")
@Roles(...WORKFLOW_ROLES_ACESSO)
async atualizarEtapa(@Req() req: RequestComUsuario, @Param("execucaoId") execucaoId: string, @Param("etapaId") etapaId: string, @Body() body: unknown) {
  const dto = this.validar(atualizarEtapaSchema, body);
  return { success: true, data: await this.execucoesService.atualizarEtapa(req.user, execucaoId, etapaId, dto) };
}

@Post("execucoes/:execucaoId/concluir")
@Roles(...WORKFLOW_ROLES_ACESSO)
async concluirExecucao(@Req() req: RequestComUsuario, @Param("execucaoId") execucaoId: string) {
  return { success: true, data: await this.execucoesService.concluir(req.user, execucaoId) };
}

@Post("execucoes/:execucaoId/cancelar")
@Roles(...WORKFLOW_ROLES_ACESSO)
async cancelarExecucao(@Req() req: RequestComUsuario, @Param("execucaoId") execucaoId: string, @Body() body: unknown) {
  const dto = this.validar(motivoObrigatorioSchema, body);
  return { success: true, data: await this.execucoesService.cancelar(req.user, execucaoId, dto) };
}

@Post("execucoes/:execucaoId/reabrir")
@Roles(...WORKFLOW_GESTAO_ROLES)
async reabrirExecucao(@Req() req: RequestComUsuario, @Param("execucaoId") execucaoId: string, @Body() body: unknown) {
  const dto = this.validar(motivoObrigatorioSchema, body);
  return { success: true, data: await this.execucoesService.reabrir(req.user, execucaoId, dto) };
}

@Delete("execucoes/:execucaoId")
@Roles(...WORKFLOW_GESTAO_ROLES)
async descartarExecucaoTeste(@Req() req: RequestComUsuario, @Param("execucaoId") execucaoId: string) {
  await this.execucoesService.descartarTeste(req.user, execucaoId);
  return { success: true, data: null };
}
```

- [ ] **Step 6.7: Rodar testes**

Run:

```bash
pnpm --filter @essencia/api test -- workflows-historico.service workflows-execucoes.service workflows.controller
pnpm --filter @essencia/api typecheck
```

Expected: PASS.

- [ ] **Step 6.8: Commit**

```bash
git add services/api/src/modules/workflows
git commit -m "feat(workflows): implementa execucoes e checklist"
```

## Task 7: Anexos de Execucao

**Files:**
- Modify: `services/api/src/modules/workflows/workflows-anexos.service.ts`
- Modify: `services/api/src/modules/workflows/workflows.controller.ts`
- Test: `services/api/src/modules/workflows/workflows-anexos.service.spec.ts`
- Test: `services/api/src/modules/workflows/workflows.controller.spec.ts`

- [ ] **Step 7.1: Escrever testes de anexos**

Adicione ao `workflows.controller.spec.ts` um teste multipart:

```typescript
it("nao faz upload de anexo quando execucao nao e visivel", async () => {
  execucoesService.buscarPorId.mockRejectedValue(new ForbiddenException("Sem permissao"));
  storageService.uploadBuffer.mockResolvedValue({
    url: "https://cdn/arquivo.pdf",
    key: "workflows/arquivo.pdf",
    name: "arquivo.pdf",
  });

  const req = {
    user: usuarioBase,
    isMultipart: () => true,
    async *parts() {
      yield {
        type: "file",
        fieldname: "arquivo",
        filename: "arquivo.pdf",
        mimetype: "application/pdf",
        toBuffer: async () => Buffer.from("%PDF-1.4"),
      };
    },
  };

  await expect(controller.enviarAnexo("exec-1", req as never)).rejects.toBeInstanceOf(
    ForbiddenException,
  );

  expect(storageService.uploadBuffer).not.toHaveBeenCalled();
  expect(anexosService.registrarUpload).not.toHaveBeenCalled();
});
```

Crie `workflows-anexos.service.spec.ts`:

```typescript
import { Test, TestingModule } from "@nestjs/testing";

import { DatabaseService } from "../../common/database/database.service";
import { StorageService } from "../../common/storage/storage.service";
import { WorkflowsAnexosService } from "./workflows-anexos.service";
import { WorkflowsHistoricoService } from "./workflows-historico.service";

const db = {
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  query: {
    workflowAnexos: { findFirst: jest.fn() },
  },
  delete: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
};

jest.mock("@essencia/db", () => ({
  and: jest.fn(),
  eq: jest.fn(),
  workflowAnexos: {},
}));

describe("WorkflowsAnexosService", () => {
  let service: WorkflowsAnexosService;
  const historico = { registrar: jest.fn() };
  const storage = { deleteFile: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsAnexosService,
        { provide: DatabaseService, useValue: { db } },
        { provide: StorageService, useValue: storage },
        { provide: WorkflowsHistoricoService, useValue: historico },
      ],
    }).compile();
    service = module.get(WorkflowsAnexosService);
    jest.clearAllMocks();
  });

  it("registra anexo e historico", async () => {
    db.returning.mockResolvedValue([{ id: "anexo-1", nomeOriginal: "arquivo.pdf" }]);

    await service.registrarUpload(
      { userId: "user-1", role: "professora", schoolId: "school-1", unitId: "unit-1", stageId: null },
      "exec-1",
      {
        url: "https://cdn/arquivo.pdf",
        storageKey: "workflows/arquivo.pdf",
        nomeOriginal: "arquivo.pdf",
        mimetype: "application/pdf",
        tamanhoBytes: 8,
      },
    );

    expect(db.values).toHaveBeenCalledWith(
      expect.objectContaining({
        execucaoId: "exec-1",
        nomeOriginal: "arquivo.pdf",
        enviadoPor: "user-1",
      }),
    );
    expect(historico.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "ANEXO_ENVIADO" }),
    );
  });
});
```

- [ ] **Step 7.2: Rodar testes e confirmar falha**

Run:

```bash
pnpm --filter @essencia/api test -- workflows-anexos.service workflows.controller
```

Expected: FAIL.

- [ ] **Step 7.3: Implementar anexos service**

Implemente `registrarUpload` inserindo `workflowAnexos` e historico `ANEXO_ENVIADO`. Implemente `remover`:

- Busca anexo por `id` e `execucaoId`.
- Chama `StorageService.deleteFile(storageKey)`.
- Deleta registro.
- Registra `ANEXO_REMOVIDO`.

- [ ] **Step 7.4: Implementar multipart no controller**

No controller:

- Adicione imports `Multipart`, `FastifyRequest`, `Delete`, `InternalServerErrorException`, `Logger`.
- Crie helper `processarArquivoUnico(req)` que aceita apenas um arquivo nao vazio.
- Antes de upload, chame `execucoesService.buscarPorId(req.user, execucaoId)` para validar visibilidade.
- Use `storageService.uploadBuffer(buffer, nomeOriginal, mimetype, "workflows")`.
- Depois chame `anexosService.registrarUpload`.

Endpoint:

```typescript
@Post("execucoes/:execucaoId/anexos")
@Roles(...WORKFLOW_ROLES_ACESSO)
async enviarAnexo(@Param("execucaoId") execucaoId: string, @Req() req: FastifyMultipartRequest) {
  await this.execucoesService.buscarPorId(req.user, execucaoId);
  const arquivo = await this.processarArquivoUnico(req);
  const resultado = await this.storageService.uploadBuffer(
    arquivo.buffer,
    arquivo.nomeOriginal,
    arquivo.mimetype,
    "workflows",
  );
  return {
    success: true,
    data: await this.anexosService.registrarUpload(req.user, execucaoId, {
      url: resultado.url,
      storageKey: resultado.key,
      nomeOriginal: arquivo.nomeOriginal,
      mimetype: arquivo.mimetype,
      tamanhoBytes: arquivo.tamanhoBytes,
    }),
  };
}

@Delete("execucoes/:execucaoId/anexos/:anexoId")
@Roles(...WORKFLOW_ROLES_ACESSO)
async removerAnexo(@Req() req: RequestComUsuario, @Param("execucaoId") execucaoId: string, @Param("anexoId") anexoId: string) {
  await this.execucoesService.buscarPorId(req.user, execucaoId);
  await this.anexosService.remover(req.user, execucaoId, anexoId);
  return { success: true, data: null };
}
```

- [ ] **Step 7.5: Rodar testes**

Run:

```bash
pnpm --filter @essencia/api test -- workflows-anexos.service workflows.controller
pnpm --filter @essencia/api typecheck
```

Expected: PASS.

- [ ] **Step 7.6: Commit**

```bash
git add services/api/src/modules/workflows
git commit -m "feat(workflows): adiciona anexos de execucao"
```

## Task 8: Scaffold do App `apps/workflows`

**Files:**
- Create: `apps/workflows/package.json`
- Create: `apps/workflows/next.config.js`
- Create: `apps/workflows/tsconfig.json`
- Create: `apps/workflows/tailwind.config.ts`
- Create: `apps/workflows/postcss.config.js`
- Create: `apps/workflows/app/globals.css`
- Create: `apps/workflows/app/layout.tsx`
- Create: `apps/workflows/app/page.tsx`
- Create: `apps/workflows/vitest.config.ts`
- Create: `apps/workflows/vitest.setup.ts`
- Test: `apps/workflows/app/page.test.tsx`

- [ ] **Step 8.1: Criar teste inicial do app**

Crie `apps/workflows/app/page.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import WorkflowsPage from "./page";

vi.mock("@essencia/shared/providers/tenant", () => ({
  useTenant: () => ({
    role: "professora",
    userId: "user-1",
    isLoaded: true,
  }),
}));

vi.mock("@/lib/api", () => ({
  listarCategorias: vi.fn().mockResolvedValue([]),
  listarModelos: vi.fn().mockResolvedValue([]),
  listarExecucoes: vi.fn().mockResolvedValue([]),
}));

describe("WorkflowsPage", () => {
  it("renderiza abas principais do modulo", () => {
    render(<WorkflowsPage />);

    expect(screen.getByText("Workflows")).toBeTruthy();
    expect(screen.getByText("Em andamento")).toBeTruthy();
    expect(screen.getByText("Concluidos")).toBeTruthy();
  });
});
```

- [ ] **Step 8.2: Criar package/config e confirmar falha por pagina ausente**

Crie configs copiando padrao de `apps/suporte`, com alteracoes:

`apps/workflows/package.json`:

```json
{
  "name": "workflows",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "clean": "rimraf .next",
    "dev": "next dev --port 3015",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --environment jsdom --globals"
  },
  "dependencies": {
    "@essencia/components": "workspace:*",
    "@essencia/shared": "workspace:*",
    "@essencia/tailwind-config": "workspace:*",
    "@essencia/ui": "workspace:*",
    "date-fns": "^4.1.0",
    "lucide-react": "^0.469.0",
    "next": "15.1.12",
    "react": "19.0.4",
    "react-dom": "19.0.4"
  },
  "devDependencies": {
    "@essencia/config": "workspace:*",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.1",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "@vitejs/plugin-react": "^5.1.2",
    "autoprefixer": "^10.4.20",
    "jsdom": "^27.3.0",
    "postcss": "^8.4.49",
    "rimraf": "^5.0.5",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2",
    "vitest": "^4.0.16"
  }
}
```

`apps/workflows/next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/workflows",
  output: "standalone",
  transpilePackages: ["@essencia/ui", "@essencia/shared", "@essencia/components"],
};

module.exports = nextConfig;
```

`apps/workflows/tsconfig.json` igual ao `apps/suporte/tsconfig.json`.

`apps/workflows/tailwind.config.ts` igual ao `apps/suporte/tailwind.config.ts`.

`apps/workflows/postcss.config.js`:

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

`apps/workflows/vitest.config.ts`:

```typescript
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()] as any,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(__dirname, "node_modules/react/jsx-runtime"),
      "react/jsx-dev-runtime": path.resolve(__dirname, "node_modules/react/jsx-dev-runtime"),
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

`apps/workflows/vitest.setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

Run:

```bash
pnpm --filter workflows test -- app/page.test.tsx
```

Expected: FAIL por `Cannot find module './page'`.

- [ ] **Step 8.3: Criar layout e pagina inicial minima**

`apps/workflows/app/layout.tsx`:

```tsx
import { Shell } from "@essencia/components/shell/shell";
import { TarefaBadgeContainer } from "@essencia/components/tarefas";
import { TenantProvider } from "@essencia/shared/providers/tenant";
import { Toaster } from "@essencia/ui/components/toaster";
import "@essencia/ui/globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Workflows | Essencia",
  description: "Modulo de workflows operacionais",
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <TenantProvider>
          <Shell sidebarProps={{ tarefasBadge: <TarefaBadgeContainer /> }}>
            {children}
          </Shell>
          <Toaster position="bottom-right" />
        </TenantProvider>
      </body>
    </html>
  );
}
```

`apps/workflows/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`apps/workflows/app/page.tsx`:

```tsx
"use client";

import { Button } from "@essencia/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@essencia/ui/components/tabs";
import { Plus } from "lucide-react";

export default function WorkflowsPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Workflows</h1>
          <p className="text-sm text-slate-600">
            Protocolos internos, execucoes, checklist e historico da unidade.
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo workflow
        </Button>
      </div>

      <Tabs defaultValue="biblioteca" className="w-full">
        <TabsList>
          <TabsTrigger value="biblioteca">Workflows</TabsTrigger>
          <TabsTrigger value="andamento">Em andamento</TabsTrigger>
          <TabsTrigger value="concluidos">Concluidos</TabsTrigger>
        </TabsList>
        <TabsContent value="biblioteca" className="pt-4">
          Nenhum workflow encontrado.
        </TabsContent>
        <TabsContent value="andamento" className="pt-4">
          Nenhuma execucao em andamento.
        </TabsContent>
        <TabsContent value="concluidos" className="pt-4">
          Nenhuma execucao concluida.
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 8.4: Rodar teste e typecheck**

Run:

```bash
pnpm --filter workflows test -- app/page.test.tsx
pnpm --filter workflows typecheck
```

Expected: PASS.

- [ ] **Step 8.5: Commit**

```bash
git add apps/workflows
git commit -m "feat(workflows): cria app next"
```

## Task 9: Cliente API e Tela Principal

**Files:**
- Create: `apps/workflows/lib/api.ts`
- Create: `apps/workflows/lib/permissoes.ts`
- Create: `apps/workflows/components/workflow-card.tsx`
- Create: `apps/workflows/components/execucao-card.tsx`
- Create: `apps/workflows/components/iniciar-execucao-dialog.tsx`
- Modify: `apps/workflows/app/page.tsx`
- Test: `apps/workflows/app/page.test.tsx`

- [ ] **Step 9.1: Expandir teste da tela principal**

Atualize `apps/workflows/app/page.test.tsx` para verificar:

```typescript
it("mostra botao de criar modelo apenas para gestao", () => {
  mockUseTenant.mockReturnValue({ role: "professora", userId: "user-1", isLoaded: true });
  render(<WorkflowsPage />);
  expect(screen.queryByText("Novo workflow")).toBeNull();

  mockUseTenant.mockReturnValue({ role: "coordenadora_geral", userId: "gestor-1", isLoaded: true });
  render(<WorkflowsPage />);
  expect(screen.getByText("Novo workflow")).toBeTruthy();
});
```

No topo, defina `mockUseTenant` e mocks de API:

```typescript
const mockUseTenant = vi.fn();
const mockListarModelos = vi.fn();
const mockListarExecucoes = vi.fn();

vi.mock("@essencia/shared/providers/tenant", () => ({
  useTenant: () => mockUseTenant(),
}));

vi.mock("@/lib/api", () => ({
  listarModelos: (...args: unknown[]) => mockListarModelos(...args),
  listarExecucoes: (...args: unknown[]) => mockListarExecucoes(...args),
}));
```

- [ ] **Step 9.2: Rodar teste e confirmar falha**

Run:

```bash
pnpm --filter workflows test -- app/page.test.tsx
```

Expected: FAIL porque a pagina ainda mostra o botao para todos e nao carrega dados.

- [ ] **Step 9.3: Implementar cliente API**

Crie `apps/workflows/lib/api.ts`:

```typescript
import { api } from "@essencia/shared/fetchers/client";
import type {
  WorkflowCategoria,
  WorkflowExecucaoDetalhe,
  WorkflowExecucaoResumo,
  WorkflowModeloDetalhe,
  WorkflowModeloResumo,
  WorkflowSugestoesCategoria,
} from "@essencia/shared/types/workflows";

export const listarCategorias = () =>
  api.get<WorkflowCategoria[]>("/workflows/categorias");

export const listarModelos = (params = "status=PUBLICADO") =>
  api.get<WorkflowModeloResumo[]>(`/workflows/modelos?${params}`);

export const buscarModelo = (modeloId: string) =>
  api.get<WorkflowModeloDetalhe>(`/workflows/modelos/${modeloId}`);

export const criarModelo = (body: unknown) =>
  api.post<WorkflowModeloDetalhe>("/workflows/modelos", body);

export const atualizarModelo = (modeloId: string, body: unknown) =>
  api.patch<WorkflowModeloDetalhe>(`/workflows/modelos/${modeloId}`, body);

export const publicarModelo = (modeloId: string) =>
  api.post<WorkflowModeloDetalhe>(`/workflows/modelos/${modeloId}/publicar`);

export const inativarModelo = (modeloId: string) =>
  api.post<WorkflowModeloDetalhe>(`/workflows/modelos/${modeloId}/inativar`);

export const duplicarModelo = (modeloId: string) =>
  api.post<WorkflowModeloDetalhe>(`/workflows/modelos/${modeloId}/duplicar`);

export const obterSugestoes = (categoriaId: string) =>
  api.get<WorkflowSugestoesCategoria>(`/workflows/categorias/${categoriaId}/sugestoes`);

export const iniciarExecucao = (modeloId: string, body: { titulo: string; teste?: boolean }) =>
  api.post<WorkflowExecucaoDetalhe>(`/workflows/modelos/${modeloId}/execucoes`, body);

export const listarExecucoes = (params = "status=EM_ANDAMENTO") =>
  api.get<WorkflowExecucaoResumo[]>(`/workflows/execucoes?${params}`);

export const buscarExecucao = (execucaoId: string) =>
  api.get<WorkflowExecucaoDetalhe>(`/workflows/execucoes/${execucaoId}`);

export const atualizarEtapa = (
  execucaoId: string,
  etapaId: string,
  body: { concluida?: boolean; observacao?: string | null },
) => api.patch<WorkflowExecucaoDetalhe>(`/workflows/execucoes/${execucaoId}/etapas/${etapaId}`, body);

export const concluirExecucao = (execucaoId: string) =>
  api.post<WorkflowExecucaoDetalhe>(`/workflows/execucoes/${execucaoId}/concluir`);

export const cancelarExecucao = (execucaoId: string, motivo: string) =>
  api.post<WorkflowExecucaoDetalhe>(`/workflows/execucoes/${execucaoId}/cancelar`, { motivo });

export const reabrirExecucao = (execucaoId: string, motivo: string) =>
  api.post<WorkflowExecucaoDetalhe>(`/workflows/execucoes/${execucaoId}/reabrir`, { motivo });
```

Crie `apps/workflows/lib/permissoes.ts`:

```typescript
const GESTAO_WORKFLOW_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "coordenadora_geral",
];

export function isGestaoWorkflow(role: string) {
  return GESTAO_WORKFLOW_ROLES.includes(role);
}
```

- [ ] **Step 9.4: Implementar cards e carregar dados**

Use `useEffect` na pagina para carregar:

- `listarModelos("status=PUBLICADO")`
- `listarExecucoes("status=EM_ANDAMENTO")`
- `listarExecucoes("status=CONCLUIDA")`

O botao `Novo workflow` aparece apenas quando `isGestaoWorkflow(role)` for verdadeiro.

`WorkflowCard` deve exibir nome, categoria e descricao curta, com botao `Iniciar`.

`ExecucaoCard` deve exibir titulo, modelo, status, fase atual e progresso.

`IniciarExecucaoDialog` deve pedir somente `titulo`; ao confirmar chama `iniciarExecucao(modeloId, { titulo })`.

- [ ] **Step 9.5: Rodar testes**

Run:

```bash
pnpm --filter workflows test -- app/page.test.tsx
pnpm --filter workflows typecheck
```

Expected: PASS.

- [ ] **Step 9.6: Commit**

```bash
git add apps/workflows
git commit -m "feat(workflows): implementa biblioteca e listagens"
```

## Task 10: Editor de Modelo

**Files:**
- Create: `apps/workflows/components/workflow-editor.tsx`
- Create: `apps/workflows/app/modelos/novo/page.tsx`
- Create: `apps/workflows/app/modelos/[modeloId]/page.tsx`
- Test: `apps/workflows/components/workflow-editor.test.tsx`

- [ ] **Step 10.1: Escrever testes do editor**

Crie teste para invariantes:

```typescript
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkflowEditor } from "./workflow-editor";

describe("WorkflowEditor", () => {
  it("permite adicionar fase e etapa sem drag and drop", () => {
    render(
      <WorkflowEditor
        categorias={[]}
        onSalvar={vi.fn()}
        onPublicar={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Adicionar fase"));
    expect(screen.getByLabelText("Nome da fase")).toBeTruthy();

    fireEvent.click(screen.getByText("Adicionar etapa"));
    expect(screen.getByLabelText("Titulo da etapa")).toBeTruthy();
  });
});
```

- [ ] **Step 10.2: Rodar teste e confirmar falha**

Run:

```bash
pnpm --filter workflows test -- components/workflow-editor.test.tsx
```

Expected: FAIL porque componente nao existe.

- [ ] **Step 10.3: Implementar `WorkflowEditor`**

O editor deve ter estado local:

```typescript
type EditorState = {
  nome: string;
  descricaoCurta: string;
  categoriaId: string;
  orientacoes: Array<{ id?: string; titulo: string; conteudo: string; ordem: number }>;
  fases: Array<{
    id?: string;
    nome: string;
    ordem: number;
    etapas: Array<{ id?: string; titulo: string; instrucao: string | null; ordem: number }>;
  }>;
};
```

Controles obrigatorios:

- Campos basicos: nome, descricao curta, categoria.
- Botao para aplicar sugestoes da categoria usando `obterSugestoes(categoriaId)`.
- Lista de orientacoes com adicionar/remover.
- Lista de fases com adicionar/remover/mover para cima/mover para baixo.
- Lista de etapas por fase com adicionar/remover/mover para cima/mover para baixo.
- Botao `Salvar rascunho`.
- Em edicao, botoes `Publicar`, `Inativar` e `Duplicar` quando aplicavel.

Nao use drag and drop no MVP.

- [ ] **Step 10.4: Implementar rotas do editor**

`/modelos/novo`:

- Carrega categorias.
- Salva via `criarModelo`.
- Redireciona para `/workflows/modelos/{id}`.

`/modelos/[modeloId]`:

- Carrega categorias e modelo.
- Salva via `atualizarModelo`.
- Publica/inativa/duplica via API.
- Exibe aviso se status for `PUBLICADO`: "Alteracoes em etapas publicadas podem reabrir etapas pendentes nas execucoes abertas."

- [ ] **Step 10.5: Rodar testes**

Run:

```bash
pnpm --filter workflows test -- components/workflow-editor.test.tsx
pnpm --filter workflows typecheck
```

Expected: PASS.

- [ ] **Step 10.6: Commit**

```bash
git add apps/workflows
git commit -m "feat(workflows): implementa editor de modelos"
```

## Task 11: Tela de Execucao

**Files:**
- Create: `apps/workflows/components/execucao-detalhe.tsx`
- Create: `apps/workflows/components/cancelar-execucao-dialog.tsx`
- Create: `apps/workflows/components/anexos-execucao.tsx`
- Create: `apps/workflows/app/execucoes/[execucaoId]/page.tsx`
- Test: `apps/workflows/components/execucao-detalhe.test.tsx`

- [ ] **Step 11.1: Escrever teste da execucao**

Crie `execucao-detalhe.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExecucaoDetalhe } from "./execucao-detalhe";

const execucao = {
  id: "exec-1",
  titulo: "Evento Dia dos Pais",
  status: "EM_ANDAMENTO",
  faseAtual: "Preparacao",
  progressoPercentual: 0,
  modeloAtualizado: true,
  modelo: {
    nome: "Evento",
    orientacoes: [{ id: "ori-1", titulo: "Objetivo", conteudo: "Organizar", ordem: 1 }],
    fases: [{ id: "fase-1", nome: "Preparacao", ordem: 1, etapas: [{ id: "etapa-1", titulo: "Definir data", instrucao: null, ordem: 1, versao: 1, updatedAt: "2026-07-03T10:00:00.000Z" }] }],
  },
  progresso: [{ etapaId: "etapa-1", concluida: false, observacao: null, concluidaPor: null, concluidaAt: null, etapaVersao: 1 }],
  anexos: [],
  historico: [],
} as any;

describe("ExecucaoDetalhe", () => {
  it("exibe aviso de modelo atualizado e abas obrigatorias", () => {
    render(
      <ExecucaoDetalhe
        execucao={execucao}
        isGestao={false}
        onAtualizarEtapa={vi.fn()}
        onConcluir={vi.fn()}
        onCancelar={vi.fn()}
        onReabrir={vi.fn()}
      />,
    );

    expect(screen.getByText("Este workflow foi atualizado pela gestao. Revise as etapas pendentes.")).toBeTruthy();
    expect(screen.getByText("Orientacoes")).toBeTruthy();
    expect(screen.getByText("Checklist")).toBeTruthy();
    expect(screen.getByText("Anexos")).toBeTruthy();
    expect(screen.getByText("Historico")).toBeTruthy();
  });
});
```

- [ ] **Step 11.2: Rodar teste e confirmar falha**

Run:

```bash
pnpm --filter workflows test -- components/execucao-detalhe.test.tsx
```

Expected: FAIL.

- [ ] **Step 11.3: Implementar tela de execucao**

`ExecucaoDetalhe` deve conter:

- Cabecalho com titulo, modelo, status e fase atual.
- Aviso exato quando `modeloAtualizado=true`.
- Abas `Orientacoes`, `Checklist`, `Anexos`, `Historico`.
- Checklist agrupado por fase.
- Checkbox por etapa chamando `onAtualizarEtapa(execucao.id, etapa.id, { concluida: !atual })`.
- Textarea por observacao chamando `onAtualizarEtapa(execucao.id, etapa.id, { observacao })` em blur.
- Botao `Concluir workflow`, desabilitado quando houver etapa pendente.
- Botao `Cancelar` com dialog de motivo obrigatorio.
- Para gestao e status `CONCLUIDA`, botao `Reabrir` com motivo obrigatorio.
- Aba anexos com upload `FormData` para `/api/workflows/execucoes/{id}/anexos` e remocao por DELETE.
- Historico em ordem decrescente, exibindo tipo, descricao, autor, motivo e data.

- [ ] **Step 11.4: Implementar rota**

`apps/workflows/app/execucoes/[execucaoId]/page.tsx` deve:

- Carregar `buscarExecucao(params.execucaoId)`.
- Exibir loading, erro e detalhe.
- Recarregar apos concluir/cancelar/reabrir/atualizar etapa/anexar/remover.

- [ ] **Step 11.5: Rodar testes**

Run:

```bash
pnpm --filter workflows test -- components/execucao-detalhe.test.tsx
pnpm --filter workflows typecheck
```

Expected: PASS.

- [ ] **Step 11.6: Commit**

```bash
git add apps/workflows
git commit -m "feat(workflows): implementa tela de execucao"
```

## Task 12: Navegacao e Infraestrutura

**Files:**
- Modify: `packages/components/src/shell/app-sidebar.tsx`
- Modify: `nginx.conf`
- Modify: `docker-compose.prod.yml`
- Test: `packages/components/src/shell/app-sidebar.workflows.test.ts`

- [ ] **Step 12.1: Escrever teste source-reading da sidebar**

Crie `packages/components/src/shell/app-sidebar.workflows.test.ts`:

```typescript
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("AppSidebar Workflows", () => {
  const source = readFileSync(join(process.cwd(), "src/shell/app-sidebar.tsx"), "utf8");

  it("inclui Workflows no menu compartilhado para todos os usuarios", () => {
    expect(source).toContain('workflows: "ALL"');
    expect(source).toContain('label: "Workflows"');
    expect(source).toContain("/workflows?data=");
    expect(source).toContain('if (port === "3015") return setActivePage("workflows")');
  });
});
```

- [ ] **Step 12.2: Rodar teste e confirmar falha**

Run:

```bash
pnpm --filter @essencia/components test -- app-sidebar.workflows
```

Expected: FAIL se `@essencia/components` ainda nao tiver script `test`; nesse caso rode `pnpm --filter @essencia/components typecheck` depois de aplicar e mantenha o teste como documentacao de invariante para quando o pacote tiver Vitest.

- [ ] **Step 12.3: Atualizar sidebar**

Em `packages/components/src/shell/app-sidebar.tsx`:

- Importar `ClipboardList` de `lucide-react`.
- Adicionar `"workflows"` ao union `ActivePage`.
- Adicionar `workflows: "ALL"` em `MODULE_ACCESS_RULES`.
- Adicionar `if (normalizedPath.startsWith("/workflows")) return "workflows";`.
- Adicionar item no `menuItems` apos `Tarefas`:

```typescript
{
  key: "workflows" as ModuleKey,
  icon: ClipboardList,
  label: "Workflows",
  href: `https://www.portalcef.com.br/workflows?data=${tenantPayload}`,
  activePage: "workflows" as ActivePage,
},
```

- Adicionar porta:

```typescript
if (port === "3015") return setActivePage("workflows");
```

- [ ] **Step 12.4: Atualizar Nginx**

Em `nginx.conf`, antes de `# Loja Admin App`, adicione:

```nginx
        # Workflows App
        location /workflows {
            set $upstream_workflows essencia-workflows:3015;
            proxy_pass http://$upstream_workflows;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
```

- [ ] **Step 12.5: Atualizar Docker Compose**

Em `docker-compose.prod.yml`, apos `suporte`, adicione:

```yaml
  workflows:
    image: essencia-workflows:latest
    container_name: essencia-workflows
    <<: *common
    environment:
      <<: *nextjs-env
      PORT: 3015
    healthcheck:
      <<: *healthcheck
      test: [ "CMD", "curl", "-f", "http://localhost:3015/workflows" ]
    depends_on:
      api:
        condition: service_healthy
```

- [ ] **Step 12.6: Rodar validacoes**

Run:

```bash
pnpm --filter @essencia/components typecheck
nginx -t -c "$PWD/nginx.conf"
docker compose -f docker-compose.prod.yml config >/tmp/essencia-compose-workflows.yml
```

Expected: todos PASS. Se `nginx -t` falhar por paths de certificado locais, registre a falha no resumo e valide ao menos a sintaxe do bloco revisando `docker compose config`.

- [ ] **Step 12.7: Commit**

```bash
git add packages/components/src/shell/app-sidebar.tsx packages/components/src/shell/app-sidebar.workflows.test.ts nginx.conf docker-compose.prod.yml
git commit -m "feat(workflows): adiciona navegacao e infraestrutura"
```

## Task 13: Documentacao e Verificacao Final

**Files:**
- Modify: `docs/API.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/README.md`

- [ ] **Step 13.1: Documentar API**

Em `docs/API.md`, adicione secao `## Workflows` com:

```markdown
## Workflows

Modulo para protocolos operacionais internos por unidade.

### Permissoes

Todos os usuarios autenticados da unidade acessam modelos publicados e proprias execucoes. Gestao (`master`, `diretora_geral`, `gerente_unidade`, `coordenadora_geral`) gerencia modelos, categorias e todas as execucoes da unidade.

### Endpoints principais

- `GET /api/workflows/categorias`
- `POST /api/workflows/categorias`
- `GET /api/workflows/modelos`
- `POST /api/workflows/modelos`
- `PATCH /api/workflows/modelos/:modeloId`
- `POST /api/workflows/modelos/:modeloId/execucoes`
- `GET /api/workflows/execucoes`
- `GET /api/workflows/execucoes/:execucaoId`
- `PATCH /api/workflows/execucoes/:execucaoId/etapas/:etapaId`
- `POST /api/workflows/execucoes/:execucaoId/concluir`
- `POST /api/workflows/execucoes/:execucaoId/cancelar`
- `POST /api/workflows/execucoes/:execucaoId/reabrir`
- `POST /api/workflows/execucoes/:execucaoId/anexos`
```

- [ ] **Step 13.2: Documentar arquitetura**

Em `docs/ARCHITECTURE.md` e `docs/README.md`, registre `workflows :3015` e descreva como "protocolos operacionais internos com checklist, anexos e historico".

- [ ] **Step 13.3: Rodar matriz final**

Run:

```bash
pnpm --filter @essencia/shared typecheck
pnpm --filter @essencia/db typecheck
pnpm --filter @essencia/api test -- workflows
pnpm --filter workflows test
pnpm --filter workflows typecheck
pnpm turbo lint && pnpm turbo typecheck
```

Expected: PASS em todos.

- [ ] **Step 13.4: Commit**

```bash
git add docs/API.md docs/ARCHITECTURE.md docs/README.md
git commit -m "docs(workflows): documenta modulo operacional"
```

## Checklist de Cobertura da Spec

- Todos autenticados acessam `/workflows`: Task 8, Task 12.
- Usuarios comuns veem publicados e iniciam execucoes reais: Task 6, Task 9.
- Usuarios comuns veem apenas proprias execucoes: Task 6.
- Gestao ve todas execucoes da unidade: Task 6.
- Gestao cria/edita/publica/inativa/duplica/testa modelos: Task 5, Task 10.
- Rascunho nao aparece para comuns: Task 5.
- Execucao de teste de rascunho isolada e descartavel: Task 6.
- Categorias padrao por unidade e editaveis: Task 4.
- Sugestoes fixas por categoria: Task 4, Task 10.
- Editor permite adicionar/excluir/mover fases e etapas: Task 10.
- Execucao pede apenas titulo: Task 9.
- Abas de execucao: Task 11.
- Fase atual calculada pelo checklist: Task 6, Task 11.
- Conclusao exige todas etapas e clique explicito: Task 6, Task 11.
- Cancelamento e reabertura exigem motivo: Task 6, Task 11.
- Alterar etapa publicada reseta progresso em execucoes abertas: Task 5.
- Aviso de modelo atualizado: Task 11.
- Observacao por etapa: Task 6, Task 11.
- Anexos gerais: Task 7, Task 11.
- Historico detalhado: Task 6, Task 7, Task 11.
- App sem acesso direto ao banco: Task 9 e revisao final.

## Riscos e Pontos de Revisao

- `nginx -t` pode depender de certificados presentes apenas no servidor. Se falhar localmente por certificado, valide via `docker compose config` e revise manualmente o bloco.
- `pnpm --filter @essencia/components test` pode nao existir. O teste source-reading da sidebar deve ser mantido, mas a verificacao minima e `pnpm --filter @essencia/components typecheck`.
- Se `pnpm db:generate` gerar numero diferente de `0039`, ajuste referencias no teste de migration para o arquivo real gerado no branch.
- Ao implementar services, prefira queries Drizzle tipadas e transacoes curtas. Nao esconda autorizacao no controller: service deve validar tenant e permissao.
