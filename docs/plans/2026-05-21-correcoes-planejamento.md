# Correcoes do Modulo Planejamento Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir as falhas de validacao, testes e comportamento incompleto encontradas no modulo `planejamento`.

**Architecture:** A primeira parte torna o `typecheck` do app real e confiavel, incluindo testes no contrato TypeScript. A segunda parte alinha os tipos do front com os dados serializados pela API. A terceira parte corrige os testes Jest da API sem alterar regra de negocio. A ultima parte remove a tela legada vazia de prazos e usa o fluxo dinamico de `plano-aula-periodo`.

**Tech Stack:** Turborepo, pnpm, Next.js App Router, React 19, Vitest, Testing Library, NestJS, Jest, ts-jest, Drizzle, PostgreSQL.

---

## Contexto Obrigatorio

Leia antes de executar:

- `AGENTS.md`
- `apps/planejamento/package.json`
- `apps/planejamento/tsconfig.json`
- `apps/planejamento/vitest.setup.ts`
- `apps/planejamento/features/periodos/hooks/use-periodos.ts`
- `apps/planejamento/features/periodos/components/periodos-list.tsx`
- `apps/planejamento/features/plano-aula/types.ts`
- `apps/planejamento/features/plano-aula/components/documento-list.test.tsx`
- `apps/planejamento/app/configuracoes/prazos/prazos-content.tsx`
- `services/api/jest.config.js`
- `services/api/src/modules/plannings/plannings.service.spec.ts`
- `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts`
- `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.ts`

Regras de execucao:

- Comunicação, comentarios, docs e commits em Portugues do Brasil.
- Rode `git status --short` antes de editar.
- Existem alteracoes locais nao relacionadas em loja e `nginx.conf`. Nao reverta nada que nao fizer parte deste plano.
- Use @superpowers:test-driven-development em cada mudanca de comportamento.
- Use @superpowers:verification-before-completion antes de declarar pronto.
- Faca commits pequenos e stage apenas os arquivos da tarefa atual.

## Task 0: Baseline e Escopo

**Files:**
- Read: `apps/planejamento/package.json`
- Read: `apps/planejamento/tsconfig.json`
- Read: `services/api/jest.config.js`

**Step 1: Conferir estado local**

Run:

```bash
git status --short
```

Expected: listar alteracoes locais existentes. Anote alteracoes nao relacionadas e nao reverta.

**Step 2: Confirmar baseline do app**

Run:

```bash
pnpm --filter planejamento test
pnpm --filter planejamento lint
pnpm --filter planejamento build
pnpm exec tsc --noEmit -p apps/planejamento/tsconfig.json
```

Expected: testes e build passam; lint retorna apenas warnings; `tsc` falha com erros de `jest-dom`, `Periodo` e `PlanoDocumento`.

**Step 3: Confirmar baseline da API**

Run:

```bash
pnpm --filter @essencia/api typecheck
pnpm --filter @essencia/api test -- src/modules/plano-aula src/modules/plano-aula-periodo src/modules/plannings --runInBand
```

Expected: `typecheck` passa; testes filtrados da API falham em `plannings.service.spec.ts` por resolucao de `@essencia/shared/config/quinzenas` e em `plano-aula-periodo.service.spec.ts` por ESM/CommonJS do pacote DB.

**Step 4: Commit**

Nao commitar nesta task.

## Task 1: Habilitar Typecheck Real no App Planejamento

**Files:**
- Modify: `apps/planejamento/package.json`
- Modify: `apps/planejamento/tsconfig.json`

**Step 1: Rodar a verificacao que deve falhar**

Run:

```bash
pnpm exec tsc --noEmit -p apps/planejamento/tsconfig.json
```

Expected: FAIL com erros `toBeInTheDocument`, `toBeDisabled`, `toHaveAttribute`, `Periodo.criadoEm` e `PlanoDocumento.fileName`.

**Step 2: Adicionar script de typecheck**

Em `apps/planejamento/package.json`, adicione:

```json
"typecheck": "tsc --noEmit"
```

No objeto `scripts`, manter ordem proxima aos outros comandos de qualidade:

```json
"lint": "next lint",
"typecheck": "tsc --noEmit",
"format": "prettier --write \"**/*.{ts,tsx,md,json}\""
```

**Step 3: Registrar tipos globais de teste**

Em `apps/planejamento/tsconfig.json`, adicione em `compilerOptions`:

```json
"types": ["vitest/globals", "@testing-library/jest-dom"]
```

Resultado esperado:

```json
{
  "extends": "@essencia/config/typescript/next",
  "compilerOptions": {
    "types": ["vitest/globals", "@testing-library/jest-dom"],
    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 4: Rodar typecheck filtrado**

Run:

```bash
pnpm --filter planejamento typecheck
```

Expected: FAIL apenas nos contratos reais restantes (`Periodo` e `PlanoDocumento`). Os erros de matchers do Testing Library devem desaparecer.

**Step 5: Commit**

```bash
git add apps/planejamento/package.json apps/planejamento/tsconfig.json
git commit -m "chore: habilita typecheck do planejamento"
```

## Task 2: Alinhar Tipo de Periodo com JSON da API

**Files:**
- Modify: `apps/planejamento/features/periodos/hooks/use-periodos.ts`
- Modify: `apps/planejamento/features/periodos/components/periodos-list.tsx`
- Test: `apps/planejamento/features/periodos/components/periodos-list.test.tsx`

**Step 1: Confirmar falha focada**

Run:

```bash
pnpm --filter planejamento typecheck
```

Expected: FAIL em `periodos-list.test.tsx`, indicando que `criadoEm` e `atualizadoEm` string nao sao atribuiveis a `Date`.

**Step 2: Ajustar contrato do hook**

Em `apps/planejamento/features/periodos/hooks/use-periodos.ts`, altere:

```ts
criadoEm: Date;
atualizadoEm: Date;
```

para:

```ts
criadoEm: string;
atualizadoEm: string;
```

**Step 3: Ajustar contrato do componente**

Em `apps/planejamento/features/periodos/components/periodos-list.tsx`, altere a interface local `Periodo`:

```ts
criadoEm: Date;
atualizadoEm: Date;
```

para:

```ts
criadoEm: string;
atualizadoEm: string;
```

**Step 4: Rodar teste e typecheck**

Run:

```bash
pnpm --filter planejamento test -- features/periodos/components/periodos-list.test.tsx
pnpm --filter planejamento typecheck
```

Expected: teste passa; `typecheck` nao mostra mais erros de `Periodo`.

**Step 5: Commit**

```bash
git add apps/planejamento/features/periodos/hooks/use-periodos.ts apps/planejamento/features/periodos/components/periodos-list.tsx
git commit -m "fix: alinha periodo do planejamento ao JSON da API"
```

## Task 3: Permitir Campos Nulos em Documento de Plano

**Files:**
- Modify: `apps/planejamento/features/plano-aula/types.ts`
- Test: `apps/planejamento/features/plano-aula/components/documento-list.test.tsx`

**Step 1: Confirmar falha focada**

Run:

```bash
pnpm --filter planejamento typecheck
```

Expected: FAIL em `documento-list.test.tsx`, indicando que `fileName: null` e `mimeType: null` nao batem com `PlanoDocumento`.

**Step 2: Ajustar tipo compartilhado do front**

Em `apps/planejamento/features/plano-aula/types.ts`, altere:

```ts
fileName?: string;
mimeType?: string;
```

para:

```ts
fileName?: string | null;
mimeType?: string | null;
```

Se o `typecheck` apontar outros campos vindos do banco como nulos, alinhe somente os campos comprovados pela API/teste, evitando ampliar o contrato sem evidencia.

**Step 3: Rodar teste e typecheck**

Run:

```bash
pnpm --filter planejamento test -- features/plano-aula/components/documento-list.test.tsx
pnpm --filter planejamento typecheck
```

Expected: teste passa; `typecheck` do app passa.

**Step 4: Commit**

```bash
git add apps/planejamento/features/plano-aula/types.ts
git commit -m "fix: aceita documentos sem nome ou mime no planejamento"
```

## Task 4: Corrigir Teste Obsoleto de PlanningsService

**Files:**
- Modify: `services/api/src/modules/plannings/plannings.service.spec.ts`

**Step 1: Rodar teste que deve falhar**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plannings/plannings.service.spec.ts --runInBand
```

Expected: FAIL com `Could not locate module @essencia/shared/config/quinzenas`.

**Step 2: Remover mock obsoleto**

Em `services/api/src/modules/plannings/plannings.service.spec.ts`, remova o bloco:

```ts
// Mock do módulo @essencia/shared/config/quinzenas
jest.mock("@essencia/shared/config/quinzenas", () => ({
  getQuinzenaById: jest.fn(),
  getCurrentQuinzena2026: jest.fn(),
  isInVacationPeriod: jest.fn(),
  formatQuinzenaDateRange: jest.fn(),
  QUINZENAS_2026: [],
}));
```

Justificativa: `PlanningsService` nao importa mais esse modulo, e o arquivo exportado nem existe em `packages/shared/src/config`.

**Step 3: Rodar teste**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plannings/plannings.service.spec.ts --runInBand
```

Expected: PASS. Se surgir falha de mock do DB, corrigir apenas o mock do teste, sem tocar em regra de producao.

**Step 4: Commit**

```bash
git add services/api/src/modules/plannings/plannings.service.spec.ts
git commit -m "test: remove mock obsoleto de quinzenas"
```

## Task 5: Isolar Teste de PlanoAulaPeriodoService do DB Real

**Files:**
- Modify: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts`

**Step 1: Rodar teste que deve falhar**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts --runInBand
```

Expected: FAIL com `SyntaxError: Cannot use import statement outside a module` vindo de `packages/db/src/client.js`.

**Step 2: Mockar dependencias de banco antes de importar o service**

No topo de `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts`, antes do import de `PlanoAulaPeriodoService`, use um mock local:

```ts
import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

const mockReturning = jest.fn();
const mockValues = jest.fn(() => ({ returning: mockReturning }));
const mockInsert = jest.fn(() => ({ values: mockValues }));

const mockDb = {
  insert: mockInsert,
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockResolvedValue([]),
};

jest.mock("@essencia/db", () => ({
  getDb: jest.fn(() => mockDb),
  eq: jest.fn(),
  and: jest.fn(),
  asc: jest.fn(),
}));

jest.mock("@essencia/db/schema", () => ({
  planoAulaPeriodo: {
    id: "id",
    unidadeId: "unidadeId",
    etapa: "etapa",
    numero: "numero",
    dataInicio: "dataInicio",
    dataFim: "dataFim",
    atualizadoEm: "atualizadoEm",
  },
  turmas: {
    id: "turmas.id",
    unitId: "turmas.unitId",
    stageId: "turmas.stageId",
  },
  educationStages: {
    id: "educationStages.id",
    code: "educationStages.code",
  },
}));

import { PlanoAulaPeriodoService } from "./plano-aula-periodo.service";
```

**Step 3: Atualizar testes validos que esperavam TODO antigo**

Nos casos validos de `criarPeriodo`, nao espere `null`. Configure:

```ts
jest.spyOn(service as any, "verificarSobreposicao").mockResolvedValue([]);
jest.spyOn(service as any, "calcularProximoNumero").mockResolvedValue(1);
jest
  .spyOn(service as any, "renumerarPeriodosSeNecessario")
  .mockResolvedValue(undefined);

mockReturning.mockResolvedValue([
  {
    id: "periodo-id",
    unidadeId: "unidade-id",
    etapa: dto.etapa,
    numero: 1,
    descricao: null,
    dataInicio: dto.dataInicio,
    dataFim: dto.dataFim,
    dataMaximaEntrega: dto.dataMaximaEntrega,
    criadoPor: "user-id",
    criadoEm: new Date("2026-01-01T00:00:00.000Z"),
    atualizadoEm: new Date("2026-01-01T00:00:00.000Z"),
  },
]);

const result = await service.criarPeriodo("unidade-id", "user-id", dto);
expect(result).toEqual(expect.objectContaining({ id: "periodo-id" }));
```

**Step 4: Limpar mocks entre testes**

No `beforeEach`, adicione:

```ts
jest.clearAllMocks();
mockReturning.mockReset();
mockValues.mockClear();
mockInsert.mockClear();
```

**Step 5: Rodar teste**

Run:

```bash
pnpm --filter @essencia/api test -- src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts --runInBand
```

Expected: PASS.

**Step 6: Commit**

```bash
git add services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts
git commit -m "test: isola periodos de plano do banco real"
```

## Task 6: Substituir Tela Vazia de Prazos por Periodos Dinamicos

**Files:**
- Modify: `apps/planejamento/app/configuracoes/prazos/prazos-content.tsx`
- Create: `apps/planejamento/app/configuracoes/prazos/prazos-content.test.tsx`
- Read: `apps/planejamento/features/periodos/hooks/use-periodos.ts`

**Step 1: Escrever teste de renderizacao dos periodos**

Crie `apps/planejamento/app/configuracoes/prazos/prazos-content.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrazosContent } from "./prazos-content";

const editarPeriodo = vi.fn();
const refetch = vi.fn();

vi.mock("../../../features/periodos/hooks/use-periodos", () => ({
  usePeriodos: () => ({
    periodos: [
      {
        id: "periodo-1",
        unidadeId: "unit-1",
        etapa: "INFANTIL",
        numero: 1,
        descricao: "Adaptacao",
        dataInicio: "2026-03-01",
        dataFim: "2026-03-15",
        dataMaximaEntrega: "2026-02-25",
        criadoEm: "2026-01-01T00:00:00.000Z",
        atualizadoEm: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "periodo-2",
        unidadeId: "unit-1",
        etapa: "INFANTIL",
        numero: 2,
        descricao: "Segundo semestre",
        dataInicio: "2026-08-01",
        dataFim: "2026-08-15",
        dataMaximaEntrega: "2026-07-25",
        criadoEm: "2026-01-01T00:00:00.000Z",
        atualizadoEm: "2026-01-01T00:00:00.000Z",
      },
    ],
    isLoading: false,
    error: null,
    editarPeriodo,
    refetch,
  }),
}));

describe("PrazosContent", () => {
  beforeEach(() => {
    editarPeriodo.mockReset();
    refetch.mockReset();
  });

  it("lista periodos dinamicos do semestre selecionado", () => {
    render(<PrazosContent />);

    expect(screen.getByText("1o Plano de Aula - INFANTIL")).toBeInTheDocument();
    expect(screen.queryByText("2o Plano de Aula - INFANTIL")).not.toBeInTheDocument();
  });

  it("salva prazo editando dataMaximaEntrega do periodo", async () => {
    const user = userEvent.setup();
    editarPeriodo.mockResolvedValue({ id: "periodo-1" });

    render(<PrazosContent />);

    await user.click(screen.getByRole("button", { name: /editar prazo/i }));
    await user.clear(screen.getByLabelText(/novo prazo de entrega/i));
    await user.type(screen.getByLabelText(/novo prazo de entrega/i), "2026-02-20");
    await user.click(screen.getByRole("button", { name: /^salvar$/i }));

    expect(editarPeriodo).toHaveBeenCalledWith("periodo-1", {
      dataMaximaEntrega: "2026-02-20",
    });
  });
});
```

**Step 2: Rodar teste para verificar falha**

Run:

```bash
pnpm --filter planejamento test -- app/configuracoes/prazos/prazos-content.test.tsx
```

Expected: FAIL porque a tela ainda usa `useDeadlines` e `quinzenasFiltradas` sempre retorna `[]`.

**Step 3: Trocar fonte de dados**

Em `prazos-content.tsx`, substitua:

```ts
import { useDeadlines } from "../../../features/plano-aula";
```

por:

```ts
import { usePeriodos } from "../../../features/periodos/hooks/use-periodos";
```

No componente, substitua o uso de `useDeadlines` por:

```ts
const {
  periodos,
  isLoading: isLoadingPeriodos,
  error: periodosError,
  editarPeriodo,
  refetch,
} = usePeriodos();
```

**Step 4: Mapear periodos para a UI existente**

Substitua `QuinzenaFiltrada` por:

```ts
interface PeriodoFiltrado {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  deadline: string;
}
```

Substitua `quinzenasFiltradas` por:

```ts
const periodosFiltrados = useMemo<PeriodoFiltrado[]>(() => {
  return periodos
    .filter((periodo) => {
      const mes = new Date(`${periodo.dataInicio}T00:00:00`).getMonth() + 1;
      return selectedSemester === 1 ? mes <= 6 : mes >= 7;
    })
    .map((periodo) => ({
      id: periodo.id,
      label: `${periodo.numero}o Plano de Aula - ${periodo.etapa}`,
      startDate: periodo.dataInicio,
      endDate: periodo.dataFim,
      deadline: periodo.dataMaximaEntrega,
    }));
}, [periodos, selectedSemester]);
```

Remova `deadlinesMap`, `obterPrazoAtual` e `isPrazoPersonalizado`.

**Step 5: Salvar prazo via periodo dinamico**

Altere `salvarPrazo` para gravar em `plano-aula-periodo`:

```ts
await editarPeriodo(periodoId, {
  dataMaximaEntrega: extrairDataIso(editState.deadline),
});
await refetch();
```

Use `periodoId`/`periodo` nos nomes internos novos, mas mantenha compatibilidade visual se quiser reduzir diff.

**Step 6: Ajustar input para data**

Troque:

```tsx
<Input type="datetime-local" ... />
```

por:

```tsx
<Input
  id={`prazo-${periodo.id}`}
  type="date"
  value={extrairDataIso(editState.deadline)}
  onChange={(e) => atualizarEdicao(periodo.id, e.target.value)}
  disabled={editState.isSaving}
  className="mt-1"
/>
```

E associe o label:

```tsx
<label htmlFor={`prazo-${periodo.id}`} className="text-sm font-medium text-muted-foreground">
  Novo prazo de entrega:
</label>
```

**Step 7: Atualizar mensagens**

Troque textos de migracao por mensagens reais:

```tsx
<p className="font-medium">Nenhum periodo configurado</p>
<p className="text-sm">
  Cadastre periodos em Gestao de Planos de Aula para editar os prazos.
</p>
```

Troque "quinzena" por "periodo" onde a tela agora estiver usando periodos dinamicos.

**Step 8: Rodar teste**

Run:

```bash
pnpm --filter planejamento test -- app/configuracoes/prazos/prazos-content.test.tsx
```

Expected: PASS.

**Step 9: Rodar validacoes focadas**

Run:

```bash
pnpm --filter planejamento typecheck
pnpm --filter planejamento lint
```

Expected: `typecheck` passa; lint sem novos warnings nessa tela.

**Step 10: Commit**

```bash
git add apps/planejamento/app/configuracoes/prazos/prazos-content.tsx apps/planejamento/app/configuracoes/prazos/prazos-content.test.tsx
git commit -m "fix: usa periodos dinamicos na tela de prazos"
```

## Task 7: Limpar Warnings de Lint Restantes

**Files:**
- Modify: `apps/planejamento/app/gestao/periodos/page.tsx`
- Modify: `apps/planejamento/app/gestao/periodos/periodos-content.tsx`
- Modify: `apps/planejamento/app/configuracoes/prazos/prazos-content.tsx` se ainda houver warning

**Step 1: Rodar lint para confirmar warnings**

Run:

```bash
pnpm --filter planejamento lint
```

Expected: warnings de `import/order`, `consistent-type-imports` e possivelmente dependencia desnecessaria de hook.

**Step 2: Corrigir import type em page**

Em `apps/planejamento/app/gestao/periodos/page.tsx`, altere:

```ts
import { Metadata } from "next";
import { PeriodosContent } from "./periodos-content";
```

para:

```ts
import type { Metadata } from "next";

import { PeriodosContent } from "./periodos-content";
```

**Step 3: Corrigir imports em periodos-content**

Em `apps/planejamento/app/gestao/periodos/periodos-content.tsx`, ordene imports conforme o lint exigir. Mantenha grupos claros:

```ts
"use client";

import { Button } from "@essencia/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@essencia/ui/components/tabs";
import { toast } from "@essencia/ui/toaster";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";

import { PeriodoModal } from "../../../features/periodos/components/periodo-modal";
import { PeriodosList } from "../../../features/periodos/components/periodos-list";
import { usePeriodos } from "../../../features/periodos/hooks/use-periodos";
import type { Periodo } from "../../../features/periodos/hooks/use-periodos";
```

No `catch`, evite variavel nao usada:

```ts
} catch {
```

**Step 4: Rodar lint**

Run:

```bash
pnpm --filter planejamento lint
```

Expected: sem warnings no app `planejamento`.

**Step 5: Commit**

```bash
git add apps/planejamento/app/gestao/periodos/page.tsx apps/planejamento/app/gestao/periodos/periodos-content.tsx apps/planejamento/app/configuracoes/prazos/prazos-content.tsx
git commit -m "chore: limpa warnings do planejamento"
```

## Task 8: Verificacao Final

**Files:**
- Read: `apps/planejamento/package.json`
- Read: `services/api/jest.config.js`

**Step 1: Rodar suite focada do app**

Run:

```bash
pnpm --filter planejamento typecheck
pnpm --filter planejamento test
pnpm --filter planejamento lint
pnpm --filter planejamento build
```

Expected: todos passam; lint sem warnings novos.

**Step 2: Rodar suite focada da API**

Run:

```bash
pnpm --filter @essencia/api typecheck
pnpm --filter @essencia/api test -- src/modules/plano-aula src/modules/plano-aula-periodo src/modules/plannings --runInBand
```

Expected: todos passam.

**Step 3: Rodar pipeline obrigatorio**

Run:

```bash
pnpm turbo lint && pnpm turbo typecheck
```

Expected: pipeline passa. Se falhar em modulo nao relacionado a planejamento, documente a falha com arquivo e comando, sem alterar escopo.

**Step 4: Conferir diff**

Run:

```bash
git status --short
git diff --stat
git diff -- apps/planejamento services/api/src/modules/plannings services/api/src/modules/plano-aula-periodo
```

Expected: diff limitado aos arquivos do plano.

**Step 5: Commit final se necessario**

Se houver ajustes de verificacao ainda nao commitados:

```bash
git add <arquivos-do-plano>
git commit -m "chore: finaliza correcoes do planejamento"
```

## Ordem Recomendada de Execucao

1. Task 0 para congelar o baseline.
2. Tasks 1-3 para tornar o app `planejamento` verificavel.
3. Tasks 4-5 para estabilizar testes da API.
4. Task 6 para corrigir comportamento visivel da tela de prazos.
5. Task 7 para remover warnings.
6. Task 8 antes de qualquer PR ou deploy.

## Riscos e Observacoes

- A tela de prazos deve usar `plano-aula-periodo` como fonte unica. Evite manter `quinzena_config` nessa tela, porque hoje ela representa o fluxo antigo.
- Se `pnpm turbo typecheck` passar sem executar algum pacote, confirme que cada app tocado tem script `typecheck`.
- Os testes de API devem mockar banco em unidade. Nao conecte PostgreSQL real para testar regras simples de data.
- Nao alterar `nginx.conf` nem arquivos da loja durante este plano, porque ja existem mudancas locais nao relacionadas.
