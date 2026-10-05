# Melhorias do módulo Workflows Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir inconsistências funcionais e de desempenho observadas no módulo workflows sem alterar regras de segurança.

**Architecture:** Primeiro serão corrigidos os contratos de leitura, separando relações de resumo das relações de detalhe. Em seguida, a atualização de modelos será tornada transacional e só propagará mudanças reais de etapas. Por fim, serão reforçados o ciclo de vida de anexos, os contratos compartilhados e os testes de regressão, sem introduzir uma migração ampla de versionamento nesta rodada.

**Tech Stack:** NestJS, Drizzle ORM, PostgreSQL, Next.js, TypeScript, Jest e Vitest.

---

### Task 1: Preparar baseline e corrigir o ambiente de testes

**Files:**
- Modify: `apps/workflows/vitest.setup.ts`
- Test: suíte existente de `apps/workflows`

**Steps:**
1. Construir os pacotes internos necessários para o worktree.
2. Executar os testes atuais e registrar falhas de ambiente.
3. Escrever teste mínimo que reproduza a ausência/incompatibilidade de `MutationObserver`.
4. Implementar o setup compatível com jsdom.
5. Executar a suíte novamente e confirmar que as falhas de ambiente desapareceram.

### Task 2: Separar payloads de resumo e adicionar paginação

**Files:**
- Modify: `services/api/src/modules/workflows/workflows-modelos.service.ts`
- Modify: `services/api/src/modules/workflows/workflows-execucoes.service.ts`
- Modify: `services/api/src/modules/workflows/dto/workflows.dto.ts`
- Modify: `apps/workflows/lib/api.ts`
- Modify: `apps/workflows/app/page.tsx`
- Modify: `apps/workflows/app/modelos/page.tsx`
- Test: serviços e páginas existentes

**Steps:**
1. Escrever testes que exijam relações mínimas nas listagens e parâmetros de paginação.
2. Executar os testes para confirmar a falha.
3. Criar relações de resumo com apenas categoria/modelo e progresso necessário.
4. Adicionar `limit` e `cursor` ou uma paginação simples compatível com o cliente atual.
5. Adaptar o frontend para consumir a resposta paginada sem quebrar o detalhe.
6. Executar testes de API e frontend.

### Task 3: Corrigir propagação de atualização de modelo

**Files:**
- Modify: `services/api/src/modules/workflows/workflows-modelos.service.ts`
- Test: `services/api/src/modules/workflows/workflows-modelos.service.spec.ts`

**Steps:**
1. Escrever testes para garantir que alterações de nome, descrição, categoria e orientações não marquem execuções como atualizadas.
2. Escrever teste para garantir que alteração de etapa marque somente execuções abertas impactadas.
3. Executar os testes e confirmar a falha.
4. Mover a descoberta das execuções impactadas para dentro da transação.
5. Condicionar histórico, reset e flag a `etapasAlteradas.length > 0`.
6. Executar a suíte do serviço e o typecheck.

### Task 4: Reforçar ciclo de vida de anexos e contratos

**Files:**
- Modify: `services/api/src/modules/workflows/workflows-anexos.service.ts`
- Modify: `services/api/src/modules/workflows/workflows.controller.ts`
- Modify: `packages/shared/src/types/workflows.ts`
- Test: `services/api/src/modules/workflows/workflows-anexos.service.spec.ts`, testes de contrato

**Steps:**
1. Escrever testes para falha de remoção no storage e para bloqueio de anexos fora do ciclo permitido.
2. Executar os testes para confirmar a falha.
3. Tornar a remoção idempotente e registrar falhas de storage para reconciliação sem deixar a API em estado ambíguo.
4. Definir o contrato tipado de metadata do histórico.
5. Executar testes e typecheck.

### Task 5: Verificação final

**Steps:**
1. Executar testes específicos da API e do app.
2. Executar `pnpm turbo lint` e `pnpm turbo typecheck`.
3. Revisar o diff e confirmar que não há alterações de segurança ou arquivos fora do escopo.
4. Commitar cada grupo de mudanças com mensagens em PT-BR.
