# Migração de sessão para novo mapa e exclusão segura — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Migrar atomicamente sessões que ainda usam um mapa antigo para um mapa confirmado, reconstruir o inventário e excluir o mapa antigo apenas quando todas as dependências estiverem ausentes.

**Architecture:** O `MapasService` terá uma operação transacional que bloqueia evento, sessões e mapas, identifica referências explícitas e inventário herdado, valida dependências de venda/operação, troca referências, recria o inventário e exclui o mapa. O controller expõe a operação administrativa; o painel chama a rota quando a substituição do mapa padrão retornar `MAP_IN_USE`, com confirmação e retry idempotente.

**Tech Stack:** NestJS + Fastify, Drizzle/PostgreSQL, Zod, Next.js App Router, React, Vitest, Turborepo e pnpm.

**Spec:** `docs/superpowers/specs/2026-11-02-eventos-migracao-sessao-mapa-design.md`

## Global Constraints

- Toda comunicação, código, documentação, comentários e commits devem ser em Português do Brasil, exceto termos técnicos universais.
- Não alterar o fluxo público de compra, pagamentos, checkout ou as regras existentes de venda.
- Não criar migration: a implementação usa as tabelas e FKs atuais.
- Toda operação de dados deve ocorrer pela API; o painel não acessa o banco diretamente.
- Antes de commitar, executar `pnpm turbo lint && pnpm turbo typecheck`.

## Review Focus

- Sessão com pedido, reserva, ingresso, check-in ou operação administrativa: a transação deve falhar e conservar o mapa/inventário.
- Mapa antigo usado por sessões explícitas e por inventário herdado após troca do padrão: todas as referências devem ser identificadas antes da exclusão.
- Lista `sessionIds` incompleta: retornar `SESSION_SELECTION_INCOMPLETE` sem migração parcial.
- Retry após timeout ou mapa já excluído: retornar auditoria/resultados anteriores sem duplicar inventário.
- Mapa de outro evento, não confirmado, vazio ou igual ao alvo: rejeitar antes de alterar o evento.

### Task 1: Operação transacional no `MapasService`

**Files:**
- Modify: `services/api/src/modules/eventos/mapas/mapas.service.ts`
- Test: `services/api/src/modules/eventos/mapas/mapas.service.spec.ts`

**Interfaces:**
- Consumes: `DatabaseService`, `StorageService`, tabelas `eventos`, `eventoSessoes`, `eventoMapas`, `eventoMapaAssentos`, `eventoInventarioAssentos`, `eventoPedidos`, `eventoReservas`, `eventoIngressos`, `eventoCheckins`, `eventoOperacoesAdministrativas` e `eventoAuditorias`.
- Produces: `MapMigrationResult` e `migrarSessoesEExcluir(eventId: string, mapId: string, input: { targetMapId: string; sessionIds?: string[] }, actor: EventoActor): Promise<MapMigrationResult>`.

- [x] **Step 1: Escrever os testes que falham**
  - Estender os mocks do serviço para pedidos, reservas, ingressos, check-ins e operações administrativas.
  - Cobrir sucesso com uma sessão sem dependências: `mapId` muda, inventário antigo é removido, um registro por assento do alvo é criado, mapa antigo é excluído e a resposta retorna `DELETED`.
  - Cobrir sessões herdadas detectadas por inventário com assentos do mapa antigo e atualização do `defaultMapId` quando aplicável.
  - Cobrir cada dependência com `SESSION_HAS_DEPENDENCIES`, seleção incompleta, mapa de outro evento, alvo não confirmado, mapa vazio, mapas iguais e retry idempotente.

- [x] **Step 2: Executar os testes para confirmar a falha**

  ```bash
  pnpm --filter @essencia/api test -- mapas.service
  ```

  Esperado: FAIL porque a operação e o resultado ainda não existem.

- [x] **Step 3: Implementar `MapMigrationResult` e `migrarSessoesEExcluir`**
  - Adicionar a assinatura e os códigos de domínio definidos na spec.
  - Consultar auditoria de uma operação concluída antes de consultar o mapa, permitindo retry após exclusão física.
  - Dentro de uma transação, travar o evento, todas as sessões do evento e os dois mapas em ordem determinística.
  - Calcular sessões explícitas do mapa antigo e sessões cujo inventário ainda referencia assentos desse mapa; exigir que `sessionIds` enviado contenha o conjunto completo.
  - Validar dependências em pedidos, reservas, ingressos, check-ins e operações administrativas antes de apagar inventário.
  - Atualizar sessões explícitas, trocar o mapa padrão quando necessário, apagar inventário impactado, inserir assentos do alvo e registrar auditoria antes de excluir o mapa antigo.
  - Coletar chaves de storage e removê-las somente depois do commit; não desfazer o resultado se a limpeza do storage falhar.
  - Fazer a exclusão do mapa respeitar as FKs existentes; converter qualquer falha inesperada em `MAP_DELETE_BLOCKED`.

- [x] **Step 4: Executar os testes do serviço**

  ```bash
  pnpm --filter @essencia/api test -- mapas.service
  ```

  Esperado: PASS em todos os testes novos e existentes do serviço de mapas.

### Task 2: Rota administrativa e contrato da API

**Files:**
- Modify: `services/api/src/modules/eventos/mapas/mapas.controller.ts`
- Test: `services/api/src/modules/eventos/mapas/mapas.controller.spec.ts`

**Interfaces:**
- Consumes: `MapasService.migrarSessoesEExcluir`.
- Produces: `POST /eventos/admin/:id/mapas/:versionId/migrar-e-excluir` com `{ targetMapId: string; sessionIds?: string[] }` e envelope `{ success: true, data }`.

- [x] **Step 1: Escrever os testes que falham**
  - Verificar que o controller repassa `id`, `versionId`, corpo parseado e ator ao serviço.
  - Verificar que corpo inválido retorna `VALIDATION_ERROR` e não chama o serviço.

- [x] **Step 2: Executar os testes para confirmar a falha**

  ```bash
  pnpm --filter @essencia/api test -- mapas.controller
  ```

  Esperado: FAIL porque a rota ainda não existe.

- [x] **Step 3: Implementar a rota**
  - Usar os mesmos guards, papéis e padrão de validação das rotas existentes.
  - Validar UUID de `targetMapId` e cada item opcional de `sessionIds` com Zod.
  - Retornar erro de validação no contrato existente e delegar autorização/negócio ao serviço.

- [x] **Step 4: Executar os testes do controller**

  ```bash
  pnpm --filter @essencia/api test -- mapas.controller
  ```

  Esperado: PASS.

### Task 3: Contratos e experiência no painel de mapas

**Files:**
- Modify: `apps/eventos-admin/features/eventos/map-review.tsx`
- Modify: `apps/eventos-admin/app/eventos/[id]/mapa/page.tsx`
- Test: `apps/eventos-admin/features/eventos/map-review.test.ts`
- Test: `apps/eventos-admin/app/eventos/[id]/mapa/page.test.ts`

**Interfaces:**
- Consumes: `previousMapId` da substituição do mapa padrão e a nova rota de migração.
- Produces: ação `onMigrateAndDelete`, código visual `DELETED`, estado de carregamento/erro e confirmação antes da chamada.

- [x] **Step 1: Escrever os testes que falham**
  - `MapReview` deve exibir a ação de migração somente para `MAP_IN_USE` quando houver callback e mostrar a mensagem de `DELETED` após sucesso.
  - `MapaPage` deve enviar `targetMapId`, `sessionIds` e `previousMapId` para a rota nova, sem reenviar upload.
  - Confirmar cancelamento não deve chamar a API; confirmação deve atualizar o aviso para mapa excluído.
  - Falha por dependência deve manter `CONFIRMADO`, preservar o aviso de mapa em uso e mostrar o erro.

- [x] **Step 2: Executar os testes para confirmar a falha**

  ```bash
  pnpm --filter @essencia/eventos-admin test -- map-review page.test
  ```

  Esperado: FAIL porque os contratos e callback ainda não existem.

- [x] **Step 3: Implementar os contratos e o fluxo**
  - Estender `PreviousMapArchive` com `DELETED` e o resultado de substituição com `previousMapId` opcional para manter compatibilidade dos mocks.
  - Adicionar botão com texto **“Migrar sessões e excluir mapa anterior”** em `MAP_IN_USE`.
  - Solicitar confirmação explícita, impedir duplo clique, chamar `POST /mapas/:previousMapId/migrar-e-excluir` e enviar a lista de sessões retornada.
  - Validar a resposta, atualizar inventário/estado local e mostrar quantidade migrada; em erro, manter a versão confirmada e a possibilidade de retry.

- [x] **Step 4: Executar os testes do painel**

  ```bash
  pnpm --filter @essencia/eventos-admin test -- map-review page.test
  ```

  Esperado: PASS.

### Task 4: Verificação integrada e documentação do resultado

**Files:**
- Modify: `docs/superpowers/plans/2026-11-02-eventos-migracao-sessao-mapa-plan.md` para marcar os passos concluídos
- Modify: `docs/superpowers/specs/2026-11-02-eventos-migracao-sessao-mapa-design.md` somente se o contrato implementado exigir ajuste explícito

**Interfaces:**
- Consumes: implementação das Tasks 1–3.
- Produces: branch verificável, sem migration nova e com cobertura dos códigos de segurança.

- [x] **Step 1: Rodar a suíte específica**

  ```bash
  pnpm --filter @essencia/api test -- mapas.service mapas.controller
  pnpm --filter @essencia/eventos-admin test -- map-review page.test
  ```

- [x] **Step 2: Rodar lint, typecheck e diff-check**

  ```bash
  pnpm turbo lint && pnpm turbo typecheck
  git diff --check
  ```

- [x] **Step 3: Rodar os testes completos em série**

  ```bash
  pnpm turbo test --concurrency=1
  ```

  Esperado: todas as 21 tarefas concluídas com sucesso.

- [x] **Step 4: Revisar o diff e confirmar limites**
  - Confirmar que não há migration, acesso direto ao banco no painel, alteração do checkout público ou arquivos fora do escopo.
  - Confirmar que a remoção de storage ocorre somente após commit e que erros de dependência preservam o mapa antigo.

- [x] **Step 5: Commitar a implementação**

  ```bash
  git add services/api/src/modules/eventos/mapas/mapas.service.ts services/api/src/modules/eventos/mapas/mapas.service.spec.ts services/api/src/modules/eventos/mapas/mapas.controller.ts services/api/src/modules/eventos/mapas/mapas.controller.spec.ts apps/eventos-admin/features/eventos/map-review.tsx apps/eventos-admin/features/eventos/map-review.test.ts 'apps/eventos-admin/app/eventos/[id]/mapa/page.tsx' 'apps/eventos-admin/app/eventos/[id]/mapa/page.test.ts' docs/superpowers/specs/2026-11-02-eventos-migracao-sessao-mapa-design.md docs/superpowers/plans/2026-11-02-eventos-migracao-sessao-mapa-plan.md
  git commit -m "feat: migra sessoes para novo mapa com exclusao segura"
  ```
