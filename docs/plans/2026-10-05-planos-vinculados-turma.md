# Planos Vinculados à Turma Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fazer cada período de uma turma usar um único plano de aula, preservando o plano quando a professora titular for trocada.

**Architecture:** `turmaId + quinzenaId` será a identidade funcional do plano. `userId` continuará registrando a professora que criou o registro ou realizou ações anteriores, mas não será usado para localizar planos nem para impedir a titular atual de continuar o fluxo. A listagem da professora será filtrada pela turma selecionada.

**Tech Stack:** NestJS, Drizzle ORM, PostgreSQL, Next.js, React, Vitest/Jest, migrations SQL.

---

### Task 1: Reproduzir a identidade por turma e período

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.service.spec.ts`
- Test: `services/api/src/modules/plano-aula/plano-aula.service.spec.ts`

**Steps:**
1. Escrever teste falho para reutilizar plano existente da mesma turma/período com outro `userId`.
2. Escrever teste falho para listar somente planos da `turmaId` informada.
3. Executar os testes e confirmar as falhas pela consulta atual filtrada por usuário.

### Task 2: Ajustar criação, listagem e autorização da API

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.service.ts`
- Modify: `services/api/src/modules/plano-aula/plano-aula.controller.ts`
- Modify: `services/api/src/modules/plano-aula/plano-aula.service.spec.ts`

**Steps:**
1. Localizar plano por turma/período e selecionar o registro canônico da titular atual quando houver dados antigos duplicados.
2. Fazer `GET /plano-aula/meus?turmaId=...` listar planos da turma, validando que a sessão é titular daquela turma.
3. Permitir que a titular atual consulte, submeta, recupere e altere documentos de planos da turma mesmo que `userId` seja a professora anterior.
4. Remover a transferência que altera `userId` dos planos durante troca de titular; registrar a troca no histórico da turma quando necessário.
5. Executar os testes da API e corrigir regressões.

### Task 3: Ajustar a tela da professora

**Files:**
- Modify: `apps/planejamento/app/planejamentos/planejamentos-content.tsx`
- Modify: `apps/planejamento/features/plano-aula/types.ts`
- Modify: `apps/planejamento/app/plano-aula/[quinzenaId]/plano-content.tsx`
- Modify: `apps/planejamento/features/periodos/components/plano-aula-grid.tsx`
- Test: `apps/planejamento/features/periodos/components/plano-aula-grid.test.tsx`

**Steps:**
1. Escrever teste falho garantindo que planos de outra turma não influenciem status ou bloqueio.
2. Passar `turmaId` na consulta da listagem.
3. Associar cada plano somente ao período dentro da turma selecionada.
4. Permitir a recuperação visual do plano pela titular atual, deixando a API como autoridade final.
5. Executar os testes do app.

### Task 4: Corrigir o banco sem apagar dados silenciosamente

**Files:**
- Modify: `packages/db/src/schema/plano-aula.ts`
- Create: `packages/db/drizzle/0044_planos_vinculados_turma.sql`

**Steps:**
1. Adicionar índice de consulta por turma/período e remover a dependência do índice antigo na aplicação.
2. Criar preflight de duplicidades e registrar os grupos para revisão.
3. Manter registros antigos duplicados preservados até a decisão de consolidação, sem apagar documentos ou histórico automaticamente.
4. Gerar e revisar a migration.

### Task 5: Verificação

**Steps:**
1. Executar testes direcionados da API e do planejamento.
2. Executar `pnpm turbo lint && pnpm turbo typecheck`.
3. Executar `git diff --check`.
4. Revisar a migration e o diff antes de qualquer deploy.
