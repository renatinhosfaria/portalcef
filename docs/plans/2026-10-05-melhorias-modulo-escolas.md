# Melhorias do Módulo Escolas Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tornar o cadastro e a manutenção de escolas, unidades e etapas consistentes, observáveis e utilizáveis no app `escolas`.

**Architecture:** Centralizar operações compostas no backend com transações Drizzle, validar todos os payloads na borda da API e expor consultas agregadas para evitar N+1 no frontend. Ajustar os formulários para consumir esses contratos, tratar estados assíncronos e manter uma nomenclatura única para diretora geral e gerente de unidade.

**Tech Stack:** NestJS, Drizzle/PostgreSQL, Zod, Next.js App Router, React, Vitest e Jest.

---

### Task 1: Contratos e testes vermelhos do fluxo de etapas

**Files:**
- Create: `services/api/src/modules/stages/stages.service.spec.ts`
- Create: `services/api/src/modules/stages/stages.controller.spec.ts`
- Modify: `packages/shared/src/schemas/index.ts`

**Step 1:** Escrever testes para rejeitar `stageIds` ausente/inválido e preservar as etapas atuais quando uma substituição contém ID inexistente.

**Step 2:** Executar os testes e confirmar falha pela ausência de schema/transação.

**Step 3:** Implementar schema compartilhado e validação no controller.

**Step 4:** Executar novamente os testes e confirmar aprovação.

### Task 2: Transação de etapas e integridade de códigos

**Files:**
- Modify: `services/api/src/modules/stages/stages.service.ts`
- Modify: `packages/db/src/schema/units.ts`
- Create: `packages/db/drizzle/0045_integridade_escolas_unidades.sql`

**Step 1:** Adicionar teste para substituição transacional e unicidade de código de unidade por escola.

**Step 2:** Confirmar falha.

**Step 3:** Validar etapas antes de qualquer update, executar desativação/reativação/inserção na mesma transação e trocar o índice inútil por `(school_id, code)`.

**Step 4:** Executar testes de stages/units e verificar a migration gerada.

### Task 3: Provisionamento de escola

**Files:**
- Create: `services/api/src/modules/schools/schools-provisioning.service.ts`
- Modify: `services/api/src/modules/schools/schools.controller.ts`
- Modify: `services/api/src/modules/schools/schools.module.ts`
- Modify: `packages/shared/src/schemas/index.ts`
- Create: `services/api/src/modules/schools/schools-provisioning.service.spec.ts`

**Step 1:** Escrever teste de rollback quando unidade, etapas ou diretora falharem.

**Step 2:** Confirmar falha.

**Step 3:** Implementar endpoint e serviço transacional para escola, unidade, etapas e diretora.

**Step 4:** Confirmar que o fluxo retorna a escola criada somente após todas as etapas concluírem.

### Task 4: Consumir o provisionamento e corrigir formulários

**Files:**
- Modify: `apps/escolas/components/schools/school-form.tsx`
- Modify: `apps/escolas/components/units/unit-form.tsx`
- Modify: `apps/escolas/components/units/director-form.tsx`
- Create: `apps/escolas/components/schools/school-form.test.tsx`
- Create: `apps/escolas/components/units/director-form.test.tsx`

**Step 1:** Escrever testes para uma única chamada de provisionamento, reset do gerente ao fechar e bloqueio durante carregamento das etapas.

**Step 2:** Confirmar falha.

**Step 3:** Ajustar os formulários, limpar timers/efeitos assíncronos e padronizar `Gerente da Unidade`/`gerente_unidade`.

**Step 4:** Executar os testes do app.

### Task 5: Consultas agregadas, contratos HTTP e ciclo de vida

**Files:**
- Modify: `services/api/src/modules/schools/schools.service.ts`
- Modify: `services/api/src/modules/schools/schools.controller.ts`
- Modify: `apps/escolas/app/schools/page.tsx`
- Modify: `apps/escolas/app/schools/[id]/page.tsx`
- Modify: `apps/escolas/components/schools/school-list.tsx`

**Step 1:** Escrever testes para `404` de escola ausente, contagem agregada de unidades e ausência de N+1.

**Step 2:** Confirmar falha.

**Step 3:** Implementar resposta agregada/paginada, estados vazios explícitos e política de arquivamento ou conflito para exclusão.

**Step 4:** Executar testes de API e frontend.

### Task 6: Shell, acessibilidade e testes de cobertura

**Files:**
- Modify: `apps/escolas/components/ui/sheet.tsx`
- Modify: `apps/escolas/components/shell/top-bar.tsx`
- Modify: `apps/escolas/components/shell/master-sidebar.tsx`
- Create: `apps/escolas/app/error.tsx`
- Create: `apps/escolas/app/loading.tsx`
- Modify: `services/api/jest.config.js`
- Rename/Create: `services/api/test/schools.controller.spec.ts`

**Step 1:** Escrever testes para drawer móvel, busca e semântica do diálogo.

**Step 2:** Confirmar falha.

**Step 3:** Implementar os controles e fazer o Jest executar os testes de escolas.

**Step 4:** Executar lint, typecheck, testes do app e testes direcionados da API.

