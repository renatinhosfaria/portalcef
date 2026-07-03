# Correção Relatórios Semestrais Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir o módulo Relatórios da educação infantil para usar domínio semestral, não semanal.

**Architecture:** Renomear o período configurável de `semana_relatorio` para `semestre_relatorio`, com `anoLetivo` e `semestre` como identidade do período. Atualizar API, frontend, rotas e textos para `SemestreRelatorio`/`semestreId`, mantendo aliases temporários para endpoints e URLs antigas durante a transição. Criar migration idempotente que renomeia tabelas, colunas, índices e constraints sem perda de dados.

**Tech Stack:** Turborepo, pnpm, Drizzle/PostgreSQL, NestJS, Next.js App Router, Vitest, Jest.

---

### Task 1: Provar o bug com testes semestrais

**Files:**
- Modify: `apps/planejamento/app/page.test.tsx`
- Modify: `apps/planejamento/app/relatorios/relatorios-pages.test.tsx`
- Create: `services/api/src/modules/semestre-relatorio/semestre-relatorio.service.spec.ts`

**Step 1:** Ajustar testes de UI para esperar "Relatórios semestrais" e "Relatórios Semestrais".

**Step 2:** Criar teste mínimo do service `SemestreRelatorioService` garantindo payload com `anoLetivo` e `semestre`.

**Step 3:** Rodar testes focados e confirmar falha pelo domínio ainda semanal.

### Task 2: Renomear schema e migration

**Files:**
- Move: `packages/db/src/schema/semana-relatorio.ts` -> `packages/db/src/schema/semestre-relatorio.ts`
- Modify: `packages/db/src/schema/relatorio.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/drizzle/0036_relatorios_semestrais.sql`
- Modify: `packages/db/drizzle/meta/_journal.json`

**Step 1:** Renomear tipos/tabelas para `semestreRelatorio`, `semestreId`, `semestreRelatorioId`.

**Step 2:** Trocar `numero` por `semestre` e adicionar `anoLetivo`.

**Step 3:** Criar migration que renomeia tabela/colunas/índices/constraints e preenche `ano_letivo`.

### Task 3: Renomear API e manter compatibilidade

**Files:**
- Move: `services/api/src/modules/semana-relatorio/` -> `services/api/src/modules/semestre-relatorio/`
- Modify: `services/api/src/app.module.ts`
- Modify: `services/api/src/modules/relatorio/*`

**Step 1:** Criar `SemestreRelatorioService`, DTOs, controller e module.

**Step 2:** Expor endpoint principal `/semestre-relatorio`.

**Step 3:** Manter controller de compatibilidade `/semana-relatorio` delegando para o service novo.

**Step 4:** Atualizar `RelatorioService` para `semestreId` e `semestreRelatorioId`.

### Task 4: Renomear frontend

**Files:**
- Move: `apps/planejamento/features/relatorio/hooks/use-semanas-relatorio.ts` -> `use-semestres-relatorio.ts`
- Move: `apps/planejamento/app/relatorios/[semanaId]/` -> `[semestreId]/`
- Move: `apps/planejamento/app/relatorios/gestao/semanas/` -> `semestres/`
- Modify: `apps/planejamento/app/page.tsx`
- Modify: `apps/planejamento/app/relatorios/**`
- Modify: `apps/planejamento/features/relatorio/**`

**Step 1:** Atualizar tipos e hooks para `SemestreRelatorio`.

**Step 2:** Atualizar telas para linguagem semestral e endpoint `/semestre-relatorio`.

**Step 3:** Manter redirect da rota antiga `/relatorios/gestao/semanas` para `/relatorios/gestao/semestres`.

### Task 5: Verificação e deploy

**Step 1:** Rodar testes focados de API e planejamento.

**Step 2:** Rodar `pnpm turbo lint && pnpm turbo typecheck`.

**Step 3:** Rodar `pnpm turbo test --concurrency=1` e `pnpm turbo build`.

**Step 4:** Aplicar migration em produção via script com backup.

**Step 5:** Rebuild/restart de `api` e `planejamento`; validar health e rotas públicas.
