# Melhorias do Módulo Home Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tornar a home um dashboard autenticado consistente, funcional e testável, removendo navegação quebrada, placeholders enganosos e problemas semânticos.

**Architecture:** A home continuará usando `TenantProvider` e o `Shell` compartilhado. Os widgets de estatísticas e agenda consumirão os contratos HTTP já existentes por meio de um adaptador local; avisos e atividades permanecerão com estado vazio explícito até existir uma fonte de dados no backend. A navegação rápida usará rotas relativas e respeitará o perfil carregado.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library, Tailwind CSS, `@essencia/shared`.

---

### Task 1: Corrigir o contrato e a navegação rápida

**Arquivos:**
- Modificar: `apps/home/app/page.tsx`
- Criar: `apps/home/components/home-greeting.tsx`
- Criar: `apps/home/components/home-module-links.tsx`
- Modificar: `apps/home/app/page.test.tsx`
- Modificar: `docs/MATRIZ_INVARIANTES_TESTES_MODULOS.md`

**Step 1: Write the failing test**

Adicionar casos que exijam rotas relativas, ocultem módulos sem acesso para `professora`, removam `rel="external"` e confirmem que não existe CTA sem destino.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter home exec vitest run app/page.test.tsx --environment jsdom --globals --pool=forks --maxWorkers=1 --fileParallelism=false --testTimeout=20000`

Expected: FAIL porque os links usam domínio fixo, não filtram por perfil e o botão “Ver todos os módulos” não tem destino.

**Step 3: Write minimal implementation**

Separar `page.tsx` como Server Component e mover saudação, tenant e links rápidos para componentes client. Trocar os cinco links para caminhos relativos, aplicar regras de visibilidade compatíveis com a sidebar e remover o botão sem ação. Substituir o `<main>` interno por `<div>` e usar headings semânticos nas seções.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter home exec vitest run app/page.test.tsx --environment jsdom --globals --pool=forks --maxWorkers=1 --fileParallelism=false --testTimeout=20000`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/home/app/page.tsx apps/home/app/page.test.tsx docs/MATRIZ_INVARIANTES_TESTES_MODULOS.md
git commit -m "fix(home): alinha navegação rápida ao perfil"
```

### Task 2: Conectar estatísticas reais da home

**Arquivos:**
- Criar: `apps/home/lib/home-api.ts`
- Modificar: `apps/home/components/quick-stats.tsx`
- Criar: `apps/home/components/quick-stats.test.tsx`

**Step 1: Write the failing test**

Testar carregamento de `totalUsers`, `activeNow`, `administrators` e `sessions24h`, além do fallback de erro e do estado inicial de carregamento.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter home exec vitest run components/quick-stats.test.tsx --environment jsdom --globals --pool=forks --maxWorkers=1 --fileParallelism=false --testTimeout=20000`

Expected: FAIL porque o componente ainda renderiza os placeholders estáticos.

**Step 3: Write minimal implementation**

Criar um adaptador baseado em `clientFetch`, buscar `/stats/dashboard`, renderizar quatro métricas reais, exibir skeleton durante carregamento, mensagem de erro com retry e manter fallback vazio sem dados.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter home exec vitest run components/quick-stats.test.tsx --environment jsdom --globals --pool=forks --maxWorkers=1 --fileParallelism=false --testTimeout=20000`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/home/lib/home-api.ts apps/home/components/quick-stats.tsx apps/home/components/quick-stats.test.tsx
git commit -m "feat(home): exibe estatisticas reais"
```

### Task 3: Conectar a agenda do dia

**Arquivos:**
- Modificar: `apps/home/lib/home-api.ts`
- Modificar: `apps/home/components/calendar-widget.tsx`
- Modificar: `apps/home/components/dashboard-content.test.tsx`

**Step 1: Write the failing test**

Adicionar teste que forneça eventos do mês atual, verifique a exibição dos eventos do dia, o estado vazio e o fallback de falha.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter home exec vitest run components/dashboard-content.test.tsx --environment jsdom --globals --pool=forks --maxWorkers=1 --fileParallelism=false --testTimeout=20000`

Expected: FAIL porque a agenda sempre informa que não há eventos.

**Step 3: Write minimal implementation**

Buscar `/calendar/events` filtrando por ano, mês e unidade da sessão; normalizar datas para `America/Sao_Paulo`; exibir título e horário/dia do evento; manter link para o calendário completo e fallback previsível.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter home exec vitest run components/dashboard-content.test.tsx --environment jsdom --globals --pool=forks --maxWorkers=1 --fileParallelism=false --testTimeout=20000`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/home/lib/home-api.ts apps/home/components/calendar-widget.tsx apps/home/components/dashboard-content.test.tsx
git commit -m "feat(home): exibe eventos da agenda"
```

### Task 4: Reduzir client-side desnecessário e duplicação visual

**Arquivos:**
- Modificar: `apps/home/components/announcement-banner.tsx`
- Modificar: `apps/home/components/system-feed.tsx`
- Modificar: `apps/home/components/calendar-widget.tsx`
- Criar: `apps/home/components/home-greeting.tsx`
- Criar: `apps/home/components/home-module-links.tsx`
- Modificar: `apps/home/app/layout.tsx`
- Modificar: `apps/home/app/globals.css`
- Modificar: `apps/home/app/api/[...path]/route.ts`

**Step 1: Write the failing test**

Ampliar os testes de renderização para confirmar headings, mensagens de vazio e estado de carregamento sem depender de mocks de componentes inteiros.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter home exec vitest run --environment jsdom --globals --pool=forks --maxWorkers=1 --fileParallelism=false --testTimeout=20000`

Expected: FAIL nos novos contratos semânticos/estados.

**Step 3: Write minimal implementation**

Manter client-side apenas os componentes que usam tenant ou fetch (`home-greeting`, `home-module-links`, `quick-stats` e `calendar-widget`); remover `"use client"` de avisos/feed e consolidar a folha global de estilos com o CSS compartilhado. Corrigir a ordem dos imports do proxy e estabilizar a saudação usando o utilitário de data centralizado.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter home exec vitest run --environment jsdom --globals --pool=forks --maxWorkers=1 --fileParallelism=false --testTimeout=20000`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/home/app apps/home/components apps/home/app/api/'[...path]'/route.ts
git commit -m "refactor(home): simplifica renderizacao e estilos"
```

### Task 5: Validação do módulo

**Arquivos:**
- Nenhum arquivo novo; validar o worktree completo.

**Step 1: Run checks**

```bash
pnpm --filter home lint
pnpm --filter home typecheck
pnpm --filter home exec vitest run --environment jsdom --globals --pool=forks --maxWorkers=1 --fileParallelism=false --testTimeout=20000
pnpm --filter home build
```

**Step 2: Review**

Confirmar que não há mudanças fora do escopo, que a documentação reflete a home autenticada e que o worktree está limpo salvo os commits da implementação.
