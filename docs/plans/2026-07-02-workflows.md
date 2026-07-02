# Workflows Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar o modulo independente `/workflows` para cadastrar modelos de workflows por unidade, iniciar execucoes, acompanhar checklist, anexos gerais e historico detalhado.

**Architecture:** O app `apps/workflows` usa Next.js App Router, `TenantProvider`, `Shell` compartilhado e chamadas HTTP para a API. A API NestJS concentra regras de tenant/permissao e persiste os dados em novas tabelas Drizzle. O app nunca acessa banco diretamente.

**Tech Stack:** Turborepo, pnpm, Next.js 15, React 19, NestJS 10, Fastify multipart, Drizzle ORM, PostgreSQL, MinIO/S3 via `StorageService`, Zod, Jest, Vitest, Testing Library.

---

## Contexto Validado

Spec aprovada: `docs/plans/2026-07-02-workflows-design.md`.

Worktree de implementacao: `/var/www/essencia/.worktrees/workflows`.

Branch: `codex/workflows`.

Baseline executado antes do plano:

```bash
pnpm install --frozen-lockfile
pnpm turbo lint && pnpm turbo typecheck
```

Resultado: lint sem erros, com avisos preexistentes em `packages/shared/src/fetchers/client.ts`, `services/api/src/common/sharepoint/*`, `apps/loja/app/[schoolId]/[unitId]/produto/[id]/page.tsx` e `apps/loja-admin/app/relatorios/page.tsx`; typecheck passou.

## Regras Globais Para Execucao

- Use TDD em todos os blocos de comportamento: escreva o teste, veja falhar pelo motivo esperado, implemente o minimo e veja passar.
- Nao use `schoolId` ou `unitId` enviados pelo payload para decidir tenant. Use somente sessao.
- Commits pequenos por tarefa.
- Depois de tocar banco, rode build/typecheck dos pacotes afetados antes de gerar migration.
- Se houver conflito de numero de migration com outra branch, regenere a migration no fim.
- Textos, nomes de dominio e mensagens em Portugues do Brasil.

## Modelo de Dados Alvo

Enums:

```typescript
export const workflowModeloStatusEnum = [
  "RASCUNHO",
  "PUBLICADO",
  "INATIVO",
] as const;

export const workflowExecucaoStatusEnum = [
  "EM_ANDAMENTO",
  "CONCLUIDA",
  "CANCELADA",
] as const;

export const workflowHistoricoTipoEnum = [
  "EXECUCAO_INICIADA",
  "ETAPA_CONCLUIDA",
  "ETAPA_REABERTA",
  "OBSERVACAO_ALTERADA",
  "ANEXO_ENVIADO",
  "ANEXO_REMOVIDO",
  "TITULO_EDITADO",
  "MODELO_ATUALIZADO",
  "EXECUCAO_CONCLUIDA",
  "EXECUCAO_CANCELADA",
  "EXECUCAO_REABERTA",
] as const;
```

Tabelas:

- `workflow_categorias`
- `workflow_modelos`
- `workflow_orientacoes`
- `workflow_fases`
- `workflow_etapas`
- `workflow_execucoes`
- `workflow_etapa_progresso`
- `workflow_anexos`
- `workflow_historico`

## Endpoints Alvo

Categorias:

- `GET /workflows/categorias`
- `POST /workflows/categorias`
- `PATCH /workflows/categorias/:id`

Modelos:

- `GET /workflows/modelos`
- `POST /workflows/modelos`
- `GET /workflows/modelos/:id`
- `PATCH /workflows/modelos/:id`
- `POST /workflows/modelos/:id/publicar`
- `POST /workflows/modelos/:id/inativar`
- `POST /workflows/modelos/:id/duplicar`
- `POST /workflows/modelos/:id/testes`

Execucoes:

- `GET /workflows/execucoes`
- `POST /workflows/modelos/:id/execucoes`
- `GET /workflows/execucoes/:id`
- `PATCH /workflows/execucoes/:id/titulo`
- `PATCH /workflows/execucoes/:id/etapas/:etapaId`
- `POST /workflows/execucoes/:id/concluir`
- `POST /workflows/execucoes/:id/cancelar`
- `POST /workflows/execucoes/:id/reabrir`
- `DELETE /workflows/execucoes/:id/teste`

Anexos:

- `POST /workflows/execucoes/:id/anexos`
- `DELETE /workflows/execucoes/:id/anexos/:anexoId`

---

### Task 1: Shared Schemas e Tipos

**Files:**
- Create: `packages/shared/src/schemas/workflows.test.ts`
- Create: `packages/shared/src/schemas/workflows.ts`
- Create: `packages/shared/src/types/workflows.ts`
- Modify: `packages/shared/src/schemas/index.ts`
- Modify: `packages/shared/src/types/index.ts`
- Modify: `packages/shared/package.json`

**Step 1: Write the failing test**

Crie `packages/shared/src/schemas/workflows.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import {
  criarWorkflowModeloSchema,
  iniciarWorkflowExecucaoSchema,
  sugestoesWorkflowPorCategoria,
  atualizarEtapaProgressoSchema,
} from "./workflows";

describe("schemas de workflows", () => {
  it("aceita orientacoes flexiveis e fases com etapas", () => {
    const parsed = criarWorkflowModeloSchema.parse({
      nome: "Evento escolar",
      categoriaId: "11111111-1111-4111-8111-111111111111",
      descricaoCurta: "Passo a passo para eventos",
      orientacoes: [
        { titulo: "Objetivo", conteudo: "Organizar o evento", ordem: 1 },
      ],
      fases: [
        {
          nome: "Preparacao",
          ordem: 1,
          etapas: [
            {
              titulo: "Definir data",
              instrucao: "Confirmar com direcao",
              ordem: 1,
            },
          ],
        },
      ],
    });

    expect(parsed.orientacoes).toHaveLength(1);
    expect(parsed.fases[0]?.etapas[0]?.titulo).toBe("Definir data");
  });

  it("inicia execucao pedindo apenas titulo", () => {
    const parsed = iniciarWorkflowExecucaoSchema.parse({
      titulo: "Evento Dia dos Pais 2027",
    });

    expect(parsed.titulo).toBe("Evento Dia dos Pais 2027");
  });

  it("mantem observacao opcional por etapa", () => {
    const parsed = atualizarEtapaProgressoSchema.parse({
      concluida: true,
      observacao: "Comunicado enviado pela agenda.",
    });

    expect(parsed.concluida).toBe(true);
    expect(parsed.observacao).toContain("Comunicado");
  });

  it("fornece sugestoes fixas para categoria Eventos", () => {
    expect(sugestoesWorkflowPorCategoria.Eventos.fases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nome: "Preparacao" }),
        expect.objectContaining({ nome: "Comunicacao" }),
      ]),
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/shared test -- workflows.test.ts
```

Expected: FAIL porque `./workflows` ainda nao existe.

**Step 3: Write minimal implementation**

Crie `packages/shared/src/schemas/workflows.ts` com schemas Zod para:

- `workflowModeloStatusSchema`
- `workflowExecucaoStatusSchema`
- `workflowHistoricoTipoSchema`
- `workflowOrientacaoInputSchema`
- `workflowEtapaInputSchema`
- `workflowFaseInputSchema`
- `criarWorkflowModeloSchema`
- `atualizarWorkflowModeloSchema`
- `iniciarWorkflowExecucaoSchema`
- `atualizarEtapaProgressoSchema`
- `cancelarWorkflowExecucaoSchema`
- `reabrirWorkflowExecucaoSchema`
- `atualizarTituloWorkflowExecucaoSchema`

Inclua `sugestoesWorkflowPorCategoria` com chaves `Eventos`, `Documentos`, `Matricula`, `Pedagogico`, `Administrativo`.

Crie `packages/shared/src/types/workflows.ts` com tipos inferidos dos schemas e interfaces de resposta:

```typescript
export interface WorkflowCategoria {
  id: string;
  nome: string;
  ativa: boolean;
  ordem: number;
}

export interface WorkflowModeloResumo {
  id: string;
  nome: string;
  descricaoCurta: string;
  status: WorkflowModeloStatus;
  categoria: WorkflowCategoria;
}
```

Exporte os arquivos em `packages/shared/src/schemas/index.ts` e `packages/shared/src/types/index.ts`.

Adicione exports publicos em `packages/shared/package.json`:

```json
"./schemas/workflows": {
  "types": "./dist/schemas/workflows.d.ts",
  "import": "./src/schemas/workflows.ts",
  "require": "./dist/schemas/workflows.js",
  "default": "./dist/schemas/workflows.js"
},
"./types/workflows": {
  "types": "./dist/types/workflows.d.ts",
  "import": "./src/types/workflows.ts",
  "require": "./dist/types/workflows.js",
  "default": "./dist/types/workflows.js"
}
```

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @essencia/shared test -- workflows.test.ts
pnpm --filter @essencia/shared typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/shared/src/schemas/workflows.test.ts packages/shared/src/schemas/workflows.ts packages/shared/src/types/workflows.ts packages/shared/src/schemas/index.ts packages/shared/src/types/index.ts packages/shared/package.json
git commit -m "feat(workflows): adiciona schemas compartilhados"
```

---

### Task 2: Schema Drizzle e Migration

**Files:**
- Create: `services/api/src/quality/workflows-schema.spec.ts`
- Create: `packages/db/src/schema/workflows.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/drizzle/0036_workflows.sql`
- Modify: `packages/db/drizzle/meta/_journal.json`
- Create: `packages/db/drizzle/meta/0036_snapshot.json`

**Step 1: Write the failing test**

Crie `services/api/src/quality/workflows-schema.spec.ts`:

```typescript
import {
  workflowCategorias,
  workflowModelos,
  workflowExecucoes,
  workflowEtapaProgresso,
  workflowHistoricoTipoEnum,
} from "@essencia/db";

describe("schema de workflows", () => {
  it("exporta tabelas principais do modulo", () => {
    expect(workflowCategorias).toBeDefined();
    expect(workflowModelos).toBeDefined();
    expect(workflowExecucoes).toBeDefined();
    expect(workflowEtapaProgresso).toBeDefined();
  });

  it("registra tipos de historico detalhado", () => {
    expect(workflowHistoricoTipoEnum).toContain("ETAPA_CONCLUIDA");
    expect(workflowHistoricoTipoEnum).toContain("ANEXO_REMOVIDO");
    expect(workflowHistoricoTipoEnum).toContain("EXECUCAO_REABERTA");
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/api test -- workflows-schema.spec.ts
```

Expected: FAIL porque os exports ainda nao existem.

**Step 3: Write minimal implementation**

Crie `packages/db/src/schema/workflows.ts` com:

- enums constantes;
- tabelas Drizzle;
- indexes por `schoolId`, `unitId`, `status`, `modeloId`, `execucaoId`;
- relations;
- schemas `createInsertSchema` e `createSelectSchema`.

Campos minimos:

```typescript
workflowCategorias:
  id, schoolId, unitId, nome, ativa, ordem, createdAt, updatedAt

workflowModelos:
  id, schoolId, unitId, categoriaId, nome, descricaoCurta, status,
  criadoPor, publicadoEm, inativadoEm, versao, updatedAt, createdAt

workflowOrientacoes:
  id, modeloId, titulo, conteudo, ordem

workflowFases:
  id, modeloId, nome, ordem

workflowEtapas:
  id, faseId, modeloId, titulo, instrucao, ordem, versao, updatedAt

workflowExecucoes:
  id, schoolId, unitId, modeloId, titulo, status, iniciadaPor,
  teste, modeloAtualizadoEm, avisoAtualizacaoPendente,
  motivoCancelamento, canceladaPor, canceladaEm,
  concluidaPor, concluidaEm, reabertaPor, reabertaEm,
  createdAt, updatedAt

workflowEtapaProgresso:
  id, execucaoId, etapaId, concluida, observacao,
  concluidaPor, concluidaEm, updatedAt

workflowAnexos:
  id, execucaoId, fileName, fileKey, fileUrl, fileType, fileSize,
  enviadoPor, createdAt

workflowHistorico:
  id, execucaoId, tipo, descricao, detalhes, criadoPor, createdAt
```

Use `jsonb("detalhes")` no historico se disponivel no `drizzle-orm/pg-core`; caso contrario use `text("detalhes")` com JSON serializado.

Exporte em `packages/db/src/schema/index.ts`.

Gere migration:

```bash
pnpm --filter @essencia/db build
pnpm db:generate
```

Se o arquivo gerado nao for `0036_workflows.sql`, use o numero criado pela ferramenta e ajuste este plano mentalmente.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @essencia/api test -- workflows-schema.spec.ts
pnpm --filter @essencia/db typecheck
pnpm --filter @essencia/api test -- drizzle-migrations.spec.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/quality/workflows-schema.spec.ts packages/db/src/schema/workflows.ts packages/db/src/schema/index.ts packages/db/drizzle packages/db/drizzle/meta
git commit -m "feat(workflows): adiciona schema de banco"
```

---

### Task 3: API Base, Categorias e Sugestoes

**Files:**
- Create: `services/api/src/modules/workflows/workflows.module.ts`
- Create: `services/api/src/modules/workflows/workflows.controller.ts`
- Create: `services/api/src/modules/workflows/workflows.service.ts`
- Create: `services/api/src/modules/workflows/workflows.service.spec.ts`
- Create: `services/api/src/modules/workflows/dto/workflows.dto.ts`
- Modify: `services/api/src/app.module.ts`

**Step 1: Write the failing test**

Crie `services/api/src/modules/workflows/workflows.service.spec.ts` com testes para categorias:

```typescript
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { DatabaseService } from "../../common/database/database.service";
import { WorkflowsService, type WorkflowUserContext } from "./workflows.service";

describe("WorkflowsService - categorias", () => {
  const dbMock = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    transaction: jest.fn(async (callback: (tx: typeof dbMock) => unknown) =>
      callback(dbMock),
    ),
  };

  const gestao: WorkflowUserContext = {
    userId: "user-1",
    role: "coordenadora_geral",
    schoolId: "school-1",
    unitId: "unit-1",
    stageId: null,
  };

  const professora = { ...gestao, role: "professora" };

  let service: WorkflowsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkflowsService,
        { provide: DatabaseService, useValue: { db: dbMock } },
      ],
    }).compile();

    service = moduleRef.get(WorkflowsService);
    jest.clearAllMocks();
  });

  it("exige unidade na sessao para listar categorias", async () => {
    await expect(
      service.listarCategorias({ ...gestao, unitId: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("impede usuario comum de criar categoria", async () => {
    await expect(
      service.criarCategoria({ nome: "Eventos", ordem: 1 }, professora),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("cria categoria usando schoolId e unitId da sessao", async () => {
    dbMock.returning.mockResolvedValueOnce([
      { id: "cat-1", nome: "Eventos", schoolId: "school-1", unitId: "unit-1" },
    ]);

    const categoria = await service.criarCategoria(
      { nome: "Eventos", ordem: 1 },
      gestao,
    );

    expect(categoria.id).toBe("cat-1");
    expect(dbMock.values).toHaveBeenCalledWith(
      expect.objectContaining({ schoolId: "school-1", unitId: "unit-1" }),
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/api test -- workflows.service.spec.ts
```

Expected: FAIL porque modulo/service nao existem.

**Step 3: Write minimal implementation**

Implemente:

- `GESTAO_WORKFLOWS_ROLES`;
- `TODOS_WORKFLOWS_ROLES`;
- `isGestao(role)`;
- `assertSessaoUnidade(session)`;
- `listarCategorias(session)`;
- `criarCategoria(dto, session)`;
- `atualizarCategoria(id, dto, session)`;
- `garantirCategoriasPadrao(session)` chamado por `listarCategorias` quando a unidade ainda nao tem categorias.

DTOs em `dto/workflows.dto.ts` devem importar schemas compartilhados ou declarar schemas Zod simples para categoria.

Controller:

- `@Controller("workflows")`
- `@UseGuards(AuthGuard, RolesGuard)`
- `GET /categorias`
- `POST /categorias`
- `PATCH /categorias/:id`

Registre `WorkflowsModule` em `AppModule`.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @essencia/api test -- workflows.service.spec.ts
pnpm --filter @essencia/api typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/workflows services/api/src/app.module.ts
git commit -m "feat(workflows): adiciona categorias na api"
```

---

### Task 4: API de Modelos de Workflow

**Files:**
- Modify: `services/api/src/modules/workflows/workflows.service.spec.ts`
- Modify: `services/api/src/modules/workflows/workflows.service.ts`
- Modify: `services/api/src/modules/workflows/workflows.controller.ts`
- Modify: `services/api/src/modules/workflows/dto/workflows.dto.ts`

**Step 1: Write the failing test**

Adicione testes para:

- usuario comum nao cria modelo;
- gestao cria modelo em transacao com orientacoes/fases/etapas;
- modelo publicado aparece para todos;
- rascunho aparece apenas para gestao;
- duplicar modelo cria copia em `RASCUNHO`.

Exemplo de teste minimo:

```typescript
it("cria modelo com orientacoes, fases e etapas em transacao", async () => {
  dbMock.returning
    .mockResolvedValueOnce([{ id: "modelo-1", nome: "Evento" }])
    .mockResolvedValueOnce([{ id: "orientacao-1" }])
    .mockResolvedValueOnce([{ id: "fase-1" }])
    .mockResolvedValueOnce([{ id: "etapa-1" }]);

  await service.criarModelo(
    {
      nome: "Evento",
      categoriaId: "11111111-1111-4111-8111-111111111111",
      descricaoCurta: "Processo de evento",
      orientacoes: [{ titulo: "Objetivo", conteudo: "Organizar", ordem: 1 }],
      fases: [
        {
          nome: "Preparacao",
          ordem: 1,
          etapas: [{ titulo: "Definir data", ordem: 1 }],
        },
      ],
    },
    gestao,
  );

  expect(dbMock.transaction).toHaveBeenCalledTimes(1);
  expect(dbMock.insert).toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/api test -- workflows.service.spec.ts
```

Expected: FAIL por metodos ausentes.

**Step 3: Write minimal implementation**

Implemente no service:

- `criarModelo(dto, session)`;
- `listarModelos(filtros, session)`;
- `obterModelo(id, session)`;
- `atualizarModelo(id, dto, session)`;
- `publicarModelo(id, session)`;
- `inativarModelo(id, session)`;
- `duplicarModelo(id, session)`.

Regras:

- Somente gestao cria/edita/publica/inativa/duplica.
- `RASCUNHO` nao aparece para usuarios comuns.
- `PUBLICADO` aparece para todos da unidade.
- `INATIVO` nao aparece na biblioteca comum, mas pode aparecer para gestao via filtro.
- Todas as queries filtram por `schoolId` e `unitId` da sessao.
- `criarModelo` e `atualizarModelo` devem persistir orientacoes/fases/etapas em transacao.
- `atualizarModelo` deve preservar ids recebidos de fases/etapas existentes quando possivel.

Controller:

- `GET /modelos`
- `POST /modelos`
- `GET /modelos/:id`
- `PATCH /modelos/:id`
- `POST /modelos/:id/publicar`
- `POST /modelos/:id/inativar`
- `POST /modelos/:id/duplicar`

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @essencia/api test -- workflows.service.spec.ts
pnpm --filter @essencia/api typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/workflows
git commit -m "feat(workflows): adiciona modelos de workflow"
```

---

### Task 5: Reset de Progresso Quando Modelo Muda

**Files:**
- Modify: `services/api/src/modules/workflows/workflows.service.spec.ts`
- Modify: `services/api/src/modules/workflows/workflows.service.ts`

**Step 1: Write the failing test**

Adicione teste mostrando que alterar titulo/instrucao de etapa publicada reseta progresso em execucoes abertas:

```typescript
it("reseta etapa concluida em execucoes abertas quando a etapa do modelo muda", async () => {
  dbMock.select.mockReturnValueOnce({
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue([
      { id: "etapa-1", titulo: "Texto antigo", instrucao: "Instrucao antiga" },
    ]),
  });

  await service.sincronizarEtapasAlteradas(
    "modelo-1",
    [{ id: "etapa-1", titulo: "Texto novo", instrucao: "Instrucao nova" }],
    gestao,
  );

  expect(dbMock.update).toHaveBeenCalled();
  expect(dbMock.insert).toHaveBeenCalledWith(expect.anything());
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/api test -- workflows.service.spec.ts
```

Expected: FAIL porque sincronizacao ainda nao existe.

**Step 3: Write minimal implementation**

Implemente helper privado ou publico testavel:

- compara etapas antigas com etapas recebidas por `id`;
- se `titulo` ou `instrucao` mudou:
  - incrementa `workflow_etapas.versao`;
  - atualiza `workflow_etapa_progresso` para `concluida=false`, `concluidaEm=null`, `concluidaPor=null` em execucoes `EM_ANDAMENTO` daquele modelo;
  - marca `workflow_execucoes.avisoAtualizacaoPendente=true`;
  - preenche `workflow_execucoes.modeloAtualizadoEm`;
  - grava historico `MODELO_ATUALIZADO`.

Chame esse helper dentro de `atualizarModelo`.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @essencia/api test -- workflows.service.spec.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/workflows/workflows.service.ts services/api/src/modules/workflows/workflows.service.spec.ts
git commit -m "feat(workflows): sincroniza alteracoes do modelo"
```

---

### Task 6: API de Execucoes e Checklist

**Files:**
- Modify: `services/api/src/modules/workflows/workflows.service.spec.ts`
- Modify: `services/api/src/modules/workflows/workflows.service.ts`
- Modify: `services/api/src/modules/workflows/workflows.controller.ts`
- Modify: `services/api/src/modules/workflows/dto/workflows.dto.ts`

**Step 1: Write the failing test**

Adicione testes para:

- iniciar execucao real exige modelo `PUBLICADO`;
- gestao pode iniciar teste de `RASCUNHO`;
- usuario comum lista apenas proprias execucoes;
- gestao lista todas da unidade;
- concluir etapa cria/atualiza progresso e historico;
- concluir workflow falha com etapas pendentes;
- cancelar exige motivo;
- reabrir concluida exige gestao e motivo.

Teste minimo de conclusao:

```typescript
it("impede concluir workflow com etapas pendentes", async () => {
  dbMock.select.mockReturnValueOnce({
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue([{ total: 3, concluidas: 2 }]),
  });

  await expect(service.concluirExecucao("exec-1", gestao)).rejects.toThrow(
    "Todas as etapas precisam estar concluidas",
  );
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/api test -- workflows.service.spec.ts
```

Expected: FAIL por metodos ausentes.

**Step 3: Write minimal implementation**

Implemente:

- `iniciarExecucao(modeloId, dto, session, options?: { teste?: boolean })`;
- `listarExecucoes(query, session)`;
- `obterExecucao(id, session)`;
- `editarTituloExecucao(id, dto, session)`;
- `atualizarProgressoEtapa(execucaoId, etapaId, dto, session)`;
- `concluirExecucao(id, session)`;
- `cancelarExecucao(id, dto, session)`;
- `reabrirExecucao(id, dto, session)`;
- `descartarExecucaoTeste(id, session)`.

Regras:

- Acesso: gestao ve tudo da unidade; usuario comum apenas execucoes iniciadas por ele.
- Teste de rascunho: apenas gestao, `teste=true`, descartavel.
- Fase atual deve ser calculada no DTO de detalhe/listagem a partir da primeira fase com etapa pendente.
- `concluirExecucao` so passa quando todas as etapas do modelo estao concluidas na execucao.
- `cancelarExecucao` exige motivo e permite gestao ou iniciador.
- `reabrirExecucao` exige motivo e gestao.
- Toda acao grava `workflow_historico`.

Controller:

- `GET /execucoes`
- `POST /modelos/:id/execucoes`
- `POST /modelos/:id/testes`
- `GET /execucoes/:id`
- `PATCH /execucoes/:id/titulo`
- `PATCH /execucoes/:id/etapas/:etapaId`
- `POST /execucoes/:id/concluir`
- `POST /execucoes/:id/cancelar`
- `POST /execucoes/:id/reabrir`
- `DELETE /execucoes/:id/teste`

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @essencia/api test -- workflows.service.spec.ts
pnpm --filter @essencia/api typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/workflows
git commit -m "feat(workflows): adiciona execucoes e checklist"
```

---

### Task 7: API de Anexos Gerais

**Files:**
- Create: `services/api/src/common/upload-limits.ts`
- Modify: `services/api/src/modules/workflows/workflows.controller.ts`
- Modify: `services/api/src/modules/workflows/workflows.service.ts`
- Modify: `services/api/src/modules/workflows/workflows.service.spec.ts`

**Step 1: Write the failing test**

Adicione testes para:

- usuario que ve execucao pode anexar;
- usuario que nao ve execucao recebe `ForbiddenException`;
- remover anexo grava historico;
- remover anexo e permitido para qualquer usuario que ve execucao.

Exemplo:

```typescript
it("remove anexo quando usuario tem acesso a execucao", async () => {
  jest.spyOn(service, "obterExecucao").mockResolvedValue({ id: "exec-1" } as never);

  await service.removerAnexo("exec-1", "anexo-1", professora);

  expect(dbMock.delete).toHaveBeenCalled();
  expect(dbMock.insert).toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/api test -- workflows.service.spec.ts
```

Expected: FAIL por metodos ausentes.

**Step 3: Write minimal implementation**

Crie `services/api/src/common/upload-limits.ts`:

```typescript
export const LIMITE_UPLOAD_PADRAO_BYTES = 100 * 1024 * 1024;
```

No controller, processe multipart com `req.parts()` como em `SuporteController`, mas aceite qualquer mimetype que passe pela protecao do `StorageService`.

Fluxo correto:

1. Validar sessao e acesso a execucao antes de enviar arquivo ao storage.
2. Ler arquivo em memoria.
3. Validar tamanho com `LIMITE_UPLOAD_PADRAO_BYTES`.
4. Chamar `storageService.uploadBuffer(buffer, filename, mimetype, "workflows")`.
5. Persistir `workflow_anexos`.
6. Gravar historico `ANEXO_ENVIADO`.

Implemente no service:

- `registrarAnexo(execucaoId, arquivo, session)`;
- `listarAnexos(execucaoId, session)` se necessario para detalhe;
- `removerAnexo(execucaoId, anexoId, session)`.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @essencia/api test -- workflows.service.spec.ts
pnpm --filter @essencia/api typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/common/upload-limits.ts services/api/src/modules/workflows
git commit -m "feat(workflows): adiciona anexos gerais"
```

---

### Task 8: Smoke de Controller e Guards

**Files:**
- Create: `services/api/src/modules/workflows/workflows.controller.spec.ts`
- Modify: `services/api/src/modules/workflows/workflows.controller.ts`

**Step 1: Write the failing test**

Crie testes de controller para validar envelopes e schema Zod:

```typescript
import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { WorkflowsController } from "./workflows.controller";
import { WorkflowsService } from "./workflows.service";

describe("WorkflowsController", () => {
  const serviceMock = {
    listarCategorias: jest.fn(),
    criarModelo: jest.fn(),
    iniciarExecucao: jest.fn(),
  };

  it("retorna categorias em envelope success", async () => {
    serviceMock.listarCategorias.mockResolvedValue([{ id: "cat-1" }]);
    const moduleRef = await Test.createTestingModule({
      controllers: [WorkflowsController],
      providers: [{ provide: WorkflowsService, useValue: serviceMock }],
    }).compile();

    const controller = moduleRef.get(WorkflowsController);
    await expect(
      controller.listarCategorias({ user: { unitId: "unit-1" } } as never),
    ).resolves.toEqual({ success: true, data: [{ id: "cat-1" }] });
  });

  it("rejeita criar modelo invalido", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WorkflowsController],
      providers: [{ provide: WorkflowsService, useValue: serviceMock }],
    }).compile();

    const controller = moduleRef.get(WorkflowsController);

    await expect(
      controller.criarModelo({ user: {} } as never, { nome: "" } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/api test -- workflows.controller.spec.ts
```

Expected: FAIL ate os metodos/DTOs ficarem alinhados.

**Step 3: Write minimal implementation**

Garanta que todos endpoints retornem envelope:

```typescript
return { success: true, data };
```

Garanta erros de validacao com:

```typescript
throw new BadRequestException({
  code: "VALIDATION_ERROR",
  message: "Dados invalidos",
  errors: parsed.error.errors,
});
```

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @essencia/api test -- workflows.controller.spec.ts
pnpm --filter @essencia/api test -- workflows.service.spec.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/workflows
git commit -m "test(workflows): cobre controller da api"
```

---

### Task 9: App Next `apps/workflows` - Scaffold

**Files:**
- Create: `apps/workflows/package.json`
- Create: `apps/workflows/next.config.js`
- Create: `apps/workflows/tsconfig.json`
- Create: `apps/workflows/tailwind.config.ts`
- Create: `apps/workflows/postcss.config.js`
- Create: `apps/workflows/.eslintrc.cjs`
- Create: `apps/workflows/next-env.d.ts`
- Create: `apps/workflows/app/globals.css`
- Create: `apps/workflows/app/layout.tsx`
- Create: `apps/workflows/app/api/[...path]/route.ts`
- Create: `apps/workflows/app/page.tsx`
- Create: `apps/workflows/app/page.test.tsx`
- Create: `apps/workflows/public/.gitkeep`

**Step 1: Write the failing test**

Crie `apps/workflows/app/page.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import WorkflowsPage from "./page";

vi.mock("@essencia/shared/providers/tenant", () => ({
  useTenant: () => ({
    role: "professora",
    unitId: "unit-1",
    isLoaded: true,
  }),
}));

describe("WorkflowsPage", () => {
  it("renderiza abas principais do modulo", () => {
    render(<WorkflowsPage />);

    expect(screen.getByRole("tab", { name: /Workflows/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Em andamento/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Concluidos/i })).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter workflows test -- page.test.tsx
```

Expected: FAIL porque app/package nao existem.

**Step 3: Write minimal implementation**

Crie app com base em `apps/tarefas`.

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
  }
}
```

Copie dependencias de `apps/calendario` ou `apps/tarefas`, incluindo:

- `@essencia/components`
- `@essencia/shared`
- `@essencia/ui`
- `@essencia/tailwind-config`
- `lucide-react`
- `next`
- `react`
- `react-dom`
- `date-fns`
- dev deps de Vitest/Testing Library.

`next.config.js` deve ter:

```javascript
const nextConfig = {
  basePath: "/workflows",
  output: "standalone",
  transpilePackages: ["@essencia/ui", "@essencia/shared", "@essencia/components"],
};

module.exports = nextConfig;
```

`layout.tsx` deve usar `TenantProvider`, `Shell`, `Toaster` e `lang="pt-BR"`.

`page.tsx` deve renderizar tres abas usando `@essencia/ui/components/tabs`.

`app/api/[...path]/route.ts` deve seguir o proxy de `apps/tarefas`, preservando cookies e multipart.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm install --frozen-lockfile
pnpm --filter workflows test -- page.test.tsx
pnpm --filter workflows typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/workflows pnpm-lock.yaml
git commit -m "feat(workflows): cria app Next"
```

---

### Task 10: Sidebar, Home, Docker e Nginx

**Files:**
- Modify: `packages/components/src/shell/app-sidebar.tsx`
- Modify: `apps/home/app/page.tsx`
- Modify: `apps/home/app/page.test.tsx`
- Modify: `docker-bake.hcl`
- Modify: `docker-compose.prod.yml`
- Modify: `nginx.conf`

**Step 1: Write the failing test**

Atualize `apps/home/app/page.test.tsx` para exigir link de Workflows:

```typescript
{
  nome: /Workflows/i,
  href: "https://www.portalcef.com.br/workflows",
}
```

Se nao houver teste da sidebar, crie `packages/components/src/shell/app-sidebar.test.tsx` verificando que o item `Workflows` aparece para `professora`.

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter home test -- page.test.tsx
```

Expected: FAIL porque link ainda nao existe.

**Step 3: Write minimal implementation**

Sidebar:

- adicione `workflows` em `ActivePage`;
- adicione `workflows: "ALL"` em `MODULE_ACCESS_RULES`;
- detecte path `/workflows`;
- adicione item com icone `Workflow` ou `GitBranch`;
- porta local `3015` deve marcar active page.

Home:

- adicione link de acesso rapido `Workflows`.

Docker:

- adicione target `workflows` em `docker-bake.hcl` no grupo `apps`, com `APP_NAME = "workflows"` e `APP_PORT = "3015"`;
- adicione service `workflows` em `docker-compose.prod.yml`, imagem `essencia-workflows:latest`, container `essencia-workflows`, `PORT: 3015`, healthcheck `http://localhost:3015/workflows`;
- adicione `location /workflows` e `location ^~ /workflows/_next/static/` em `nginx.conf`.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter home test -- page.test.tsx
pnpm --filter @essencia/components typecheck
pnpm turbo typecheck --filter=workflows --filter=home --filter=@essencia/components
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/components/src/shell/app-sidebar.tsx apps/home/app/page.tsx apps/home/app/page.test.tsx docker-bake.hcl docker-compose.prod.yml nginx.conf
git commit -m "feat(workflows): adiciona modulo na navegacao e deploy"
```

---

### Task 11: Cliente HTTP e Hooks do App

**Files:**
- Create: `apps/workflows/lib/api.ts`
- Create: `apps/workflows/features/workflows/hooks/use-workflow-categorias.ts`
- Create: `apps/workflows/features/workflows/hooks/use-workflow-modelos.ts`
- Create: `apps/workflows/features/workflows/hooks/use-workflow-execucoes.ts`
- Create: `apps/workflows/features/workflows/hooks/use-workflow-detalhe.ts`
- Create: `apps/workflows/features/workflows/hooks/use-workflow-mutations.ts`
- Create: `apps/workflows/features/workflows/hooks/use-workflow-mutations.test.ts`

**Step 1: Write the failing test**

Crie `use-workflow-mutations.test.ts` com mock de `clientFetch`:

```typescript
import { describe, expect, it, vi } from "vitest";

import { iniciarWorkflowExecucao } from "@/lib/api";

vi.mock("@essencia/shared/fetchers/client", () => ({
  clientFetch: vi.fn().mockResolvedValue({ id: "exec-1" }),
}));

describe("api de workflows", () => {
  it("inicia execucao enviando apenas titulo", async () => {
    const { clientFetch } = await import("@essencia/shared/fetchers/client");

    await iniciarWorkflowExecucao("modelo-1", {
      titulo: "Evento Dia dos Pais",
    });

    expect(clientFetch).toHaveBeenCalledWith(
      "/workflows/modelos/modelo-1/execucoes",
      {
        method: "POST",
        body: { titulo: "Evento Dia dos Pais" },
      },
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter workflows test -- use-workflow-mutations.test.ts
```

Expected: FAIL porque API client nao existe.

**Step 3: Write minimal implementation**

`apps/workflows/lib/api.ts` deve exportar funcoes:

- `listarCategoriasWorkflow`
- `criarCategoriaWorkflow`
- `atualizarCategoriaWorkflow`
- `listarWorkflowModelos`
- `obterWorkflowModelo`
- `criarWorkflowModelo`
- `atualizarWorkflowModelo`
- `publicarWorkflowModelo`
- `inativarWorkflowModelo`
- `duplicarWorkflowModelo`
- `iniciarWorkflowExecucao`
- `listarWorkflowExecucoes`
- `obterWorkflowExecucao`
- `atualizarTituloWorkflowExecucao`
- `atualizarEtapaWorkflow`
- `concluirWorkflowExecucao`
- `cancelarWorkflowExecucao`
- `reabrirWorkflowExecucao`
- `enviarAnexoWorkflow`
- `removerAnexoWorkflow`

Use `clientFetch` de `@essencia/shared/fetchers/client`.

Hooks devem controlar `isLoading`, `error`, recarregamento e mutacoes sem introduzir TanStack Query.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter workflows test -- use-workflow-mutations.test.ts
pnpm --filter workflows typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/workflows/lib apps/workflows/features/workflows/hooks
git commit -m "feat(workflows): adiciona cliente http do app"
```

---

### Task 12: Biblioteca, Busca e Abas Principais

**Files:**
- Modify: `apps/workflows/app/page.tsx`
- Create: `apps/workflows/app/workflows-page-content.tsx`
- Create: `apps/workflows/features/workflows/components/workflow-card.tsx`
- Create: `apps/workflows/features/workflows/components/workflow-card.test.tsx`
- Create: `apps/workflows/features/workflows/components/workflow-lista-execucoes.tsx`

**Step 1: Write the failing test**

Crie `workflow-card.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WorkflowCard } from "./workflow-card";

describe("WorkflowCard", () => {
  it("mostra nome, categoria e descricao curta", async () => {
    const onIniciar = vi.fn();

    render(
      <WorkflowCard
        workflow={{
          id: "modelo-1",
          nome: "Evento escolar",
          descricaoCurta: "Organizacao de eventos",
          status: "PUBLICADO",
          categoria: { id: "cat-1", nome: "Eventos", ativa: true, ordem: 1 },
        }}
        onIniciar={onIniciar}
      />,
    );

    expect(screen.getByText("Evento escolar")).toBeInTheDocument();
    expect(screen.getByText("Eventos")).toBeInTheDocument();
    expect(screen.getByText("Organizacao de eventos")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Iniciar/i }));
    expect(onIniciar).toHaveBeenCalledWith("modelo-1");
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter workflows test -- workflow-card.test.tsx
```

Expected: FAIL porque componente nao existe.

**Step 3: Write minimal implementation**

Implemente:

- card compacto com nome/categoria/descricao;
- botao `Iniciar`;
- filtros de busca/categoria na pagina principal;
- abas principais `Workflows`, `Em andamento`, `Concluidos`;
- contadores nas abas;
- botao de gestao `Novo workflow` visivel apenas para roles de gestao.

Use componentes existentes de `@essencia/ui`: `Button`, `Card`, `Input`, `Tabs`, `Badge`.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter workflows test -- workflow-card.test.tsx
pnpm --filter workflows test -- page.test.tsx
pnpm --filter workflows typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/workflows/app apps/workflows/features/workflows/components
git commit -m "feat(workflows): cria biblioteca e abas principais"
```

---

### Task 13: Editor de Workflow Modelo

**Files:**
- Create: `apps/workflows/app/modelos/novo/page.tsx`
- Create: `apps/workflows/app/modelos/[id]/editar/page.tsx`
- Create: `apps/workflows/features/workflows/components/workflow-editor.tsx`
- Create: `apps/workflows/features/workflows/components/workflow-editor.test.tsx`
- Create: `apps/workflows/features/workflows/components/categorias-dialog.tsx`

**Step 1: Write the failing test**

Crie teste do editor:

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WorkflowEditor } from "./workflow-editor";

describe("WorkflowEditor", () => {
  it("preenche sugestoes de fases ao selecionar categoria Eventos", async () => {
    render(
      <WorkflowEditor
        categorias={[{ id: "cat-eventos", nome: "Eventos", ativa: true, ordem: 1 }]}
        onSubmit={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("combobox", { name: /Categoria/i }));
    await userEvent.click(screen.getByRole("option", { name: /Eventos/i }));

    expect(screen.getByDisplayValue("Preparacao")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Comunicacao")).toBeInTheDocument();
  });

  it("permite remover etapa sugerida", async () => {
    render(
      <WorkflowEditor
        categorias={[{ id: "cat-eventos", nome: "Eventos", ativa: true, ordem: 1 }]}
        onSubmit={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("combobox", { name: /Categoria/i }));
    await userEvent.click(screen.getByRole("option", { name: /Eventos/i }));
    await userEvent.click(screen.getAllByRole("button", { name: /Remover etapa/i })[0]!);

    expect(screen.queryByDisplayValue("Definir data")).not.toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter workflows test -- workflow-editor.test.tsx
```

Expected: FAIL porque editor nao existe.

**Step 3: Write minimal implementation**

Editor deve:

- editar nome, descricao curta, categoria;
- editar blocos de orientacao;
- adicionar/remover/mover blocos;
- adicionar/remover/mover fases;
- adicionar/remover/mover etapas dentro da fase;
- aplicar sugestoes automaticamente ao selecionar categoria;
- permitir publicar/inativar/duplicar em tela de edicao;
- usar icones lucide em botoes (`Plus`, `Trash2`, `ArrowUp`, `ArrowDown`, `Copy`, `Send`).

Evite drag-and-drop no MVP.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter workflows test -- workflow-editor.test.tsx
pnpm --filter workflows typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/workflows/app/modelos apps/workflows/features/workflows/components/workflow-editor.tsx apps/workflows/features/workflows/components/workflow-editor.test.tsx apps/workflows/features/workflows/components/categorias-dialog.tsx
git commit -m "feat(workflows): adiciona editor de modelos"
```

---

### Task 14: Tela de Execucao com Abas Internas

**Files:**
- Create: `apps/workflows/app/execucoes/[id]/page.tsx`
- Create: `apps/workflows/app/execucoes/[id]/execucao-content.tsx`
- Create: `apps/workflows/features/workflows/components/execucao-header.tsx`
- Create: `apps/workflows/features/workflows/components/checklist-workflow.tsx`
- Create: `apps/workflows/features/workflows/components/checklist-workflow.test.tsx`
- Create: `apps/workflows/features/workflows/components/orientacoes-workflow.tsx`
- Create: `apps/workflows/features/workflows/components/anexos-workflow.tsx`
- Create: `apps/workflows/features/workflows/components/historico-workflow.tsx`

**Step 1: Write the failing test**

Crie `checklist-workflow.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChecklistWorkflow } from "./checklist-workflow";

describe("ChecklistWorkflow", () => {
  const execucao = {
    id: "exec-1",
    status: "EM_ANDAMENTO",
    fases: [
      {
        id: "fase-1",
        nome: "Preparacao",
        etapas: [
          {
            id: "etapa-1",
            titulo: "Definir data",
            instrucao: "Confirmar com direcao",
            concluida: false,
            observacao: "",
          },
        ],
      },
    ],
  };

  it("marca etapa e envia observacao", async () => {
    const onAtualizarEtapa = vi.fn();

    render(
      <ChecklistWorkflow
        execucao={execucao as never}
        onAtualizarEtapa={onAtualizarEtapa}
      />,
    );

    await userEvent.type(screen.getByLabelText(/Observacao/i), "Data confirmada");
    await userEvent.click(screen.getByRole("checkbox", { name: /Definir data/i }));

    expect(onAtualizarEtapa).toHaveBeenCalledWith("etapa-1", {
      concluida: true,
      observacao: "Data confirmada",
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter workflows test -- checklist-workflow.test.tsx
```

Expected: FAIL porque componente nao existe.

**Step 3: Write minimal implementation**

Tela de execucao:

- header com titulo, nome do modelo, status, fase atual e acoes;
- abas internas `Orientacoes`, `Checklist`, `Anexos`, `Historico`;
- aviso de modelo atualizado quando `avisoAtualizacaoPendente=true`;
- edicao de titulo para iniciador e gestao;
- botao `Concluir workflow` habilitado apenas quando todas as etapas estao concluidas;
- botao `Cancelar` com motivo obrigatorio;
- botao `Reabrir` somente para gestao em execucao concluida, com motivo obrigatorio.

Checklist:

- mostra fases agrupadas;
- checkbox por etapa;
- instrucao opcional;
- textarea de observacao por etapa;
- calcula e mostra fase atual.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter workflows test -- checklist-workflow.test.tsx
pnpm --filter workflows typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/workflows/app/execucoes apps/workflows/features/workflows/components
git commit -m "feat(workflows): adiciona tela de execucao"
```

---

### Task 15: Anexos e Historico no App

**Files:**
- Modify: `apps/workflows/features/workflows/components/anexos-workflow.tsx`
- Modify: `apps/workflows/features/workflows/components/historico-workflow.tsx`
- Create: `apps/workflows/features/workflows/components/anexos-workflow.test.tsx`
- Create: `apps/workflows/features/workflows/components/historico-workflow.test.tsx`

**Step 1: Write the failing test**

Crie teste de anexos:

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AnexosWorkflow } from "./anexos-workflow";

describe("AnexosWorkflow", () => {
  it("permite anexar arquivo geral da execucao", async () => {
    const onEnviar = vi.fn();
    render(<AnexosWorkflow anexos={[]} onEnviar={onEnviar} onRemover={vi.fn()} />);

    const arquivo = new File(["conteudo"], "documento.txt", {
      type: "text/plain",
    });

    await userEvent.upload(screen.getByLabelText(/Arquivo/i), arquivo);
    await userEvent.click(screen.getByRole("button", { name: /Enviar anexo/i }));

    expect(onEnviar).toHaveBeenCalled();
  });
});
```

Crie teste de historico:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HistoricoWorkflow } from "./historico-workflow";

describe("HistoricoWorkflow", () => {
  it("mostra eventos detalhados", () => {
    render(
      <HistoricoWorkflow
        eventos={[
          {
            id: "hist-1",
            tipo: "ETAPA_CONCLUIDA",
            descricao: "Etapa Definir data concluida",
            createdAt: "2026-07-02T12:00:00.000Z",
            criadoPorNome: "Isabela",
          },
        ]}
      />,
    );

    expect(screen.getByText(/Etapa Definir data concluida/i)).toBeInTheDocument();
    expect(screen.getByText(/Isabela/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter workflows test -- anexos-workflow.test.tsx historico-workflow.test.tsx
```

Expected: FAIL ate componentes ficarem completos.

**Step 3: Write minimal implementation**

Anexos:

- input de arquivo;
- envia `FormData`;
- lista nome, tipo/tamanho quando houver;
- abre arquivo em link;
- remove anexo com confirmacao.

Historico:

- lista eventos em ordem decrescente;
- mostra tipo traduzido, descricao, usuario e data;
- mostra motivo para cancelamento/reabertura quando vier nos detalhes.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter workflows test -- anexos-workflow.test.tsx historico-workflow.test.tsx
pnpm --filter workflows typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/workflows/features/workflows/components
git commit -m "feat(workflows): adiciona anexos e historico no app"
```

---

### Task 16: Fluxos de Integracao e Regressao

**Files:**
- Create: `services/api/src/modules/workflows/workflows.integration.spec.ts`
- Modify: `services/api/src/modules/workflows/workflows.service.ts`
- Modify: `apps/workflows/app/page.test.tsx`

**Step 1: Write the failing test**

Crie testes cobrindo regras de negocio completas no service com mocks:

```typescript
describe("WorkflowsService - regressao de regras", () => {
  it("usuario comum nao ve execucao de outro usuario", async () => {
    await expect(
      service.obterExecucao("exec-outro", professora),
    ).rejects.toThrow("Voce nao tem permissao");
  });

  it("gestao ve execucao de outro usuario da mesma unidade", async () => {
    await expect(service.obterExecucao("exec-outro", gestao)).resolves.toBeDefined();
  });

  it("execucao cancelada nao permite marcar etapa", async () => {
    await expect(
      service.atualizarProgressoEtapa("exec-cancelada", "etapa-1", {
        concluida: true,
      }, gestao),
    ).rejects.toThrow("execucao cancelada");
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @essencia/api test -- workflows.integration.spec.ts
```

Expected: FAIL ate regras ficarem completas.

**Step 3: Write minimal implementation**

Complete lacunas encontradas:

- validar status antes de atualizar etapa;
- impedir anexar em execucao cancelada, se produto decidir manter coerencia operacional;
- limpar aviso de atualizacao quando usuario abrir detalhe ou marcar etapa, se implementado;
- garantir que execucoes concluidas aparecem em `Concluidos` e canceladas nao aparecem como concluidas.

Se uma regra nova surgir aqui e nao estiver na spec, registre no design antes de implementar.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @essencia/api test -- workflows.integration.spec.ts
pnpm --filter @essencia/api test -- workflows.service.spec.ts workflows.controller.spec.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/src/modules/workflows apps/workflows/app/page.test.tsx
git commit -m "test(workflows): cobre regras de integracao"
```

---

### Task 17: Documentacao de API e Operacao

**Files:**
- Modify: `docs/API.md`
- Modify: `docs/DATABASE.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/plans/2026-07-02-workflows-design.md`

**Step 1: Write the failing test**

Crie ou atualize teste documental simples, se existir padrao local. Se nao houver, use `rg` como verificacao documentada no Step 4.

**Step 2: Run test to verify it fails**

Run:

```bash
rg -n "Workflows|/workflows|workflow_modelos" docs/API.md docs/DATABASE.md docs/DEPLOYMENT.md
```

Expected: FAIL/sem resultados suficientes antes da documentacao.

**Step 3: Write minimal implementation**

Atualize:

- `docs/API.md`: endpoints, permissoes, envelopes e exemplos de payload.
- `docs/DATABASE.md`: tabelas novas e relacoes.
- `docs/DEPLOYMENT.md`: app `workflows`, porta `3015`, container e rota nginx.
- `docs/plans/2026-07-02-workflows-design.md`: se alguma regra mudou durante a implementacao, ajuste a spec.

**Step 4: Run test to verify it passes**

Run:

```bash
rg -n "Workflows|/workflows|workflow_modelos" docs/API.md docs/DATABASE.md docs/DEPLOYMENT.md
```

Expected: encontrar secoes nos tres documentos.

**Step 5: Commit**

```bash
git add docs/API.md docs/DATABASE.md docs/DEPLOYMENT.md docs/plans/2026-07-02-workflows-design.md
git commit -m "docs(workflows): documenta modulo"
```

---

### Task 18: Verificacao Final

**Files:**
- All touched files.

**Step 1: Run targeted tests**

Run:

```bash
pnpm --filter @essencia/shared test -- workflows.test.ts
pnpm --filter @essencia/api test -- workflows
pnpm --filter workflows test
```

Expected: PASS.

**Step 2: Run typechecks targeted**

Run:

```bash
pnpm --filter @essencia/shared typecheck
pnpm --filter @essencia/db typecheck
pnpm --filter @essencia/api typecheck
pnpm --filter workflows typecheck
pnpm --filter @essencia/components typecheck
pnpm --filter home typecheck
```

Expected: PASS.

**Step 3: Run global required pipeline**

Run:

```bash
pnpm turbo lint && pnpm turbo typecheck
```

Expected: PASS. Lint pode manter os avisos preexistentes identificados no baseline, mas nao deve introduzir novos avisos em arquivos de Workflows.

**Step 4: Build affected apps/services**

Run:

```bash
pnpm --filter @essencia/api build
pnpm --filter workflows build
```

Expected: PASS.

**Step 5: Optional local smoke**

Run API and app in local terminals:

```bash
pnpm turbo dev --filter=@essencia/api
pnpm turbo dev --filter=workflows
```

Abra `http://localhost:3015/workflows` com tenant hidratado via `data` ou localStorage e valide:

- abas principais aparecem;
- biblioteca carrega;
- gestao consegue abrir editor;
- usuario comum nao ve acoes de gestao;
- execucao mostra abas internas.

**Step 6: Final commit if needed**

Se houver ajustes finais:

```bash
git add <arquivos>
git commit -m "fix(workflows): ajustes finais"
```

**Step 7: Report final status**

Inclua:

- commits criados;
- comandos executados;
- avisos preexistentes;
- qualquer item fora do MVP que ficou pendente.
