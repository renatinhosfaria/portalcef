# Ajustes do Review do Planejamento Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir os problemas encontrados no review das correcoes do modulo `planejamento`: cobertura em rota real, remocao de codigo morto e exibicao correta de datas civis.

**Architecture:** A tela oficial para gestao de periodos continua sendo `/gestao/periodos`; `/configuracoes/prazos` permanece como redirect. O componente antigo `PrazosContent` sera removido para evitar falsa cobertura, e os testes passarao a validar o fluxo real em `PeriodosContent`. Datas no formato civil `YYYY-MM-DD` serao normalizadas no utilitario compartilhado antes de formatar em `America/Sao_Paulo`.

**Tech Stack:** Turborepo, pnpm, Next.js App Router, React 19, Vitest, Testing Library, shadcn/ui, TypeScript.

---

## Contexto Obrigatorio

Leia antes de executar:

- `AGENTS.md`
- `docs/plans/2026-05-21-correcoes-planejamento.md`
- `apps/planejamento/app/configuracoes/prazos/page.tsx`
- `apps/planejamento/app/configuracoes/prazos/prazos-content.tsx`
- `apps/planejamento/app/configuracoes/prazos/prazos-content.test.tsx`
- `apps/planejamento/app/gestao/periodos/page.tsx`
- `apps/planejamento/app/gestao/periodos/periodos-content.tsx`
- `apps/planejamento/features/periodos/components/periodos-list.tsx`
- `apps/planejamento/features/periodos/components/periodos-list.test.tsx`
- `apps/planejamento/features/periodos/components/periodo-modal.tsx`
- `apps/planejamento/features/periodos/hooks/use-periodos.ts`
- `packages/shared/src/formatar-data.ts`

Regras de execucao:

- Comunicacao, comentarios, documentacao e commits em Portugues do Brasil.
- Rode `git status --short` antes de editar.
- Existem alteracoes locais nao relacionadas em `apps/loja`, `nginx.conf` e um backup SQL. Nao altere nem reverta esses arquivos.
- Use @superpowers:test-driven-development em cada mudanca de comportamento.
- Use @superpowers:verification-before-completion antes de declarar pronto.
- Faca commits pequenos e stage apenas os arquivos da tarefa atual.

## Decisao Tecnica

Manter `/gestao/periodos` como fonte unica para cadastro e edicao de periodos/prazos.

Justificativa:

- `apps/planejamento/app/configuracoes/prazos/page.tsx` ja redireciona para `/gestao/periodos`.
- `PeriodosContent` ja usa `usePeriodos`, `PeriodoModal` e o endpoint dinamico `plano-aula-periodo`.
- Reativar `PrazosContent` criaria duas telas para o mesmo dominio e aumentaria risco de divergencia.

## Task 0: Baseline e Escopo

**Files:**
- Read: `apps/planejamento/app/configuracoes/prazos/page.tsx`
- Read: `apps/planejamento/app/gestao/periodos/periodos-content.tsx`
- Read: `packages/shared/src/formatar-data.ts`

**Step 1: Conferir estado local**

Run:

```bash
git status --short
```

Expected: listar apenas alteracoes locais fora do escopo em loja, `nginx.conf`, backup SQL, ou outros arquivos ja existentes. Nao revertar.

**Step 2: Confirmar baseline focado**

Run:

```bash
pnpm --filter planejamento test -- app/configuracoes/prazos/prazos-content.test.tsx features/periodos/components/periodos-list.test.tsx
pnpm --filter planejamento lint
pnpm --filter planejamento typecheck
```

Expected: comandos passam no estado atual. O primeiro teste passa apesar de validar um componente que a rota real nao usa; isso sera corrigido nas proximas tasks.

**Step 3: Commit**

Nao commitar nesta task.

## Task 1: Cobrir o Fluxo Real de Gestao de Periodos

**Files:**
- Create: `apps/planejamento/app/gestao/periodos/periodos-content.test.tsx`
- Modify: `apps/planejamento/features/periodos/components/periodos-list.tsx`

**Step 1: Escrever teste que falha por falta de acesso ao botao real**

Crie `apps/planejamento/app/gestao/periodos/periodos-content.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PeriodosContent } from "./periodos-content";

const mocks = vi.hoisted(() => ({
  criarPeriodo: vi.fn(),
  editarPeriodo: vi.fn(),
  excluirPeriodo: vi.fn(),
}));

vi.mock("@essencia/ui/toaster", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

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
        planosVinculados: 0,
        criadoEm: "2026-01-01T00:00:00.000Z",
        atualizadoEm: "2026-01-01T00:00:00.000Z",
      },
    ],
    isLoading: false,
    error: null,
    criarPeriodo: mocks.criarPeriodo,
    editarPeriodo: mocks.editarPeriodo,
    excluirPeriodo: mocks.excluirPeriodo,
  }),
}));

describe("PeriodosContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editarPeriodo.mockResolvedValue({
      id: "periodo-1",
      dataMaximaEntrega: "2026-02-20",
    });
  });

  it("edita o prazo de entrega pela tela oficial de gestao de periodos", async () => {
    const user = userEvent.setup();

    render(<PeriodosContent />);

    await user.click(screen.getByRole("tab", { name: "INFANTIL" }));
    await user.click(
      screen.getByRole("button", { name: /editar 1o plano de aula/i }),
    );

    const prazoInput = screen.getByLabelText(/prazo de entrega/i);
    expect(prazoInput).toHaveValue("2026-02-25");

    await user.clear(prazoInput);
    await user.type(prazoInput, "2026-02-20");
    await user.click(screen.getByRole("button", { name: "Atualizar" }));

    await waitFor(() => {
      expect(mocks.editarPeriodo).toHaveBeenCalledWith(
        "periodo-1",
        expect.objectContaining({
          dataMaximaEntrega: "2026-02-20",
        }),
      );
    });
  });
});
```

Observacao: use `1o` no nome acessivel para manter ASCII. Se preferir manter `1º` na UI, ajuste o teste para o texto real.

**Step 2: Rodar teste para verificar falha**

Run:

```bash
pnpm --filter planejamento test -- app/gestao/periodos/periodos-content.test.tsx
```

Expected: FAIL porque os botoes de editar/excluir de `PeriodosList` usam apenas icones e nao tem nome acessivel estavel.

**Step 3: Adicionar nomes acessiveis aos botoes**

Em `apps/planejamento/features/periodos/components/periodos-list.tsx`, altere o botao de editar:

```tsx
<Button
  variant="ghost"
  size="sm"
  aria-label={`Editar ${periodo.numero}o Plano de Aula`}
  onClick={() => onEdit(periodo)}
>
  <Pencil className="h-4 w-4" />
</Button>
```

Altere tambem o botao de excluir:

```tsx
<Button
  variant="ghost"
  size="sm"
  aria-label={`Excluir ${periodo.numero}o Plano de Aula`}
  onClick={() => onDelete(periodo.id)}
  disabled={!!(periodo.planosVinculados && periodo.planosVinculados > 0)}
>
  <Trash2 className="h-4 w-4" />
</Button>
```

**Step 4: Rodar teste focado**

Run:

```bash
pnpm --filter planejamento test -- app/gestao/periodos/periodos-content.test.tsx
```

Expected: PASS. O teste deve provar que a rota oficial permite alterar `dataMaximaEntrega` via `editarPeriodo`.

**Step 5: Rodar lint e typecheck focados**

Run:

```bash
pnpm --filter planejamento lint
pnpm --filter planejamento typecheck
```

Expected: PASS sem warnings novos no `planejamento`.

**Step 6: Commit**

```bash
git add apps/planejamento/app/gestao/periodos/periodos-content.test.tsx apps/planejamento/features/periodos/components/periodos-list.tsx
git commit -m "test: cobre edicao de prazo na tela real de periodos"
```

## Task 2: Remover Componente Orfao de Prazos

**Files:**
- Delete: `apps/planejamento/app/configuracoes/prazos/prazos-content.tsx`
- Delete: `apps/planejamento/app/configuracoes/prazos/prazos-content.test.tsx`
- Read: `apps/planejamento/app/configuracoes/prazos/page.tsx`

**Step 1: Confirmar que o componente nao e usado**

Run:

```bash
rg -n "PrazosContent|prazos-content" apps/planejamento
```

Expected: referencias apenas em `prazos-content.tsx` e `prazos-content.test.tsx`.

**Step 2: Remover arquivos orfaos**

Remova:

```bash
apps/planejamento/app/configuracoes/prazos/prazos-content.tsx
apps/planejamento/app/configuracoes/prazos/prazos-content.test.tsx
```

Mantenha `apps/planejamento/app/configuracoes/prazos/page.tsx` como redirect para `/gestao/periodos`.

**Step 3: Rodar busca novamente**

Run:

```bash
rg -n "PrazosContent|prazos-content" apps/planejamento
```

Expected: nenhum resultado.

**Step 4: Rodar testes do planejamento**

Run:

```bash
pnpm --filter planejamento test
pnpm --filter planejamento typecheck
```

Expected: PASS. A contagem total de arquivos de teste deve reduzir em 1 se o teste antigo for removido.

**Step 5: Commit**

```bash
git add apps/planejamento/app/configuracoes/prazos
git commit -m "chore: remove tela antiga de prazos"
```

## Task 3: Corrigir Formatacao de Datas Civis

**Files:**
- Modify: `apps/planejamento/features/periodos/components/periodos-list.test.tsx`
- Modify: `packages/shared/src/formatar-data.ts`

**Step 1: Escrever teste que falha para datas `YYYY-MM-DD`**

Em `apps/planejamento/features/periodos/components/periodos-list.test.tsx`, no teste `"deve renderizar períodos da etapa"`, adicione expectativas para as datas:

```tsx
expect(screen.getByText("01/03/2026")).toBeInTheDocument();
expect(screen.getByText("15/03/2026")).toBeInTheDocument();
expect(screen.getByText("25/02/2026")).toBeInTheDocument();
```

**Step 2: Rodar teste para verificar falha**

Run:

```bash
pnpm --filter planejamento test -- features/periodos/components/periodos-list.test.tsx
```

Expected: FAIL mostrando que `2026-03-01` aparece como `28/02/2026` ou que `2026-02-25` aparece como `24/02/2026`, por causa de interpretacao UTC de `YYYY-MM-DD`.

**Step 3: Corrigir normalizacao no utilitario compartilhado**

Em `packages/shared/src/formatar-data.ts`, altere `toDate`:

```ts
function toDate(data: DataInput): Date {
  if (typeof data !== "string") {
    return data;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return new Date(`${data}T00:00:00`);
  }

  return new Date(data);
}
```

Justificativa: `YYYY-MM-DD` representa data civil, nao instante UTC. Adicionar `T00:00:00` faz o JavaScript interpretar a data no timezone local antes de aplicar o formatador com `America/Sao_Paulo`.

**Step 4: Rodar teste focado**

Run:

```bash
pnpm --filter planejamento test -- features/periodos/components/periodos-list.test.tsx
```

Expected: PASS com `01/03/2026`, `15/03/2026` e `25/02/2026`.

**Step 5: Rodar verificacoes do pacote compartilhado**

Run:

```bash
pnpm --filter @essencia/shared lint
pnpm --filter @essencia/shared typecheck
pnpm --filter @essencia/shared build
```

Expected: PASS. Nao stagear `packages/shared/dist`, porque `dist` nao esta versionado neste repositorio.

**Step 6: Rodar verificacoes do planejamento**

Run:

```bash
pnpm --filter planejamento test -- features/periodos/components/periodos-list.test.tsx app/gestao/periodos/periodos-content.test.tsx
pnpm --filter planejamento typecheck
pnpm --filter planejamento lint
```

Expected: PASS sem warnings novos.

**Step 7: Commit**

```bash
git add apps/planejamento/features/periodos/components/periodos-list.test.tsx packages/shared/src/formatar-data.ts
git commit -m "fix: preserva datas civis na formatacao"
```

## Task 4: Verificacao Final

**Files:**
- Read: `apps/planejamento/package.json`
- Read: `packages/shared/package.json`
- Read: `turbo.json`

**Step 1: Rodar suite focada do planejamento**

Run:

```bash
pnpm --filter planejamento typecheck
pnpm --filter planejamento test
pnpm --filter planejamento lint
pnpm --filter planejamento build
```

Expected: todos passam.

**Step 2: Rodar suite focada do shared**

Run:

```bash
pnpm --filter @essencia/shared lint
pnpm --filter @essencia/shared typecheck
pnpm --filter @essencia/shared build
```

Expected: todos passam. O lint pode manter warnings antigos em `fetchers/client.ts` somente se ja existiam antes; nao introduzir warnings novos.

**Step 3: Rodar pipeline obrigatorio**

Run:

```bash
pnpm turbo lint && pnpm turbo typecheck
```

Expected: pipeline passa. Se warnings antigos aparecerem fora do escopo, documentar no resumo final com arquivo e comando.

**Step 4: Conferir diff**

Run:

```bash
git status --short
git diff --stat
git diff -- apps/planejamento/app/gestao/periodos apps/planejamento/app/configuracoes/prazos apps/planejamento/features/periodos packages/shared/src/formatar-data.ts
```

Expected:

- Sem diff pendente nos arquivos do plano, se todos os commits foram feitos.
- Alteracoes locais fora do escopo em loja, `nginx.conf` e backup SQL continuam intocadas.

**Step 5: Commit final se necessario**

Se houver ajustes de verificacao ainda nao commitados:

```bash
git add <arquivos-do-plano>
git commit -m "chore: finaliza ajustes do review do planejamento"
```

## Ordem Recomendada de Execucao

1. Task 0 para confirmar baseline e escopo.
2. Task 1 para garantir teste na rota oficial acessivel ao usuario.
3. Task 2 para remover o componente/teste que davam falsa confianca.
4. Task 3 para corrigir a regressao de datas civis.
5. Task 4 para validar app, pacote compartilhado e pipeline global.

## Riscos e Observacoes

- Se o produto quiser manter uma tela dedicada em `/configuracoes/prazos`, pare antes da Task 2 e alinhe a decisao: nesse caso o plano deve ser refeito para renderizar `PrazosContent` na rota em vez de remove-lo.
- A alteracao em `packages/shared/src/formatar-data.ts` afeta todos os consumidores do utilitario. O comportamento desejado e restrito a strings `YYYY-MM-DD`; strings com horario continuam seguindo `new Date(data)`.
- O teste de `PeriodosContent` deve validar o fluxo real, nao apenas renderizar um componente isolado sem rota util.
- Nao incluir `packages/shared/dist` no commit, porque os arquivos `dist` nao estao versionados.
