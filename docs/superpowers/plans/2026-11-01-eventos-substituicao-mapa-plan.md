# Substituição segura do mapa de assentos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que um mapa confirmado substitua o mapa padrão de um evento com troca transacional, inventário protegido e arquivamento seguro da versão anterior.

**Architecture:** O upload, a detecção e a confirmação existentes continuam criando uma versão independente do mapa. Uma nova operação de domínio no `MapasService` valida o mapa confirmado, atualiza o `defaultMapId`, bloqueia e sincroniza o inventário das sessões herdadas e arquiva o mapa anterior somente quando não houver referências explícitas. O painel chama essa operação depois da confirmação e exibe o resultado do arquivamento.

**Tech Stack:** NestJS, Fastify multipart, Drizzle/PostgreSQL, Next.js/React, Vitest, Jest, TypeScript e Turborepo.

**Spec:** `docs/superpowers/specs/2026-11-01-eventos-substituicao-mapa-design.md`

## Global Constraints

- A rota aceita somente um mapa `CONFIRMADO` pertencente ao mesmo evento.
- A troca do mapa, o inventário e a auditoria precisam ser transacionais.
- Sessões com `mapId` explícito não são alteradas; referências ativas impedem o arquivamento do mapa anterior.
- Assentos reservados, vendidos ou históricos não são apagados nem transferidos.
- O arquivo original permanece preservado no storage privado; somente o preview pode ser removido após arquivamento.
- O fluxo público de seleção, reserva, checkout, Stripe e regras de compra não será alterado.
- Comunicação, código, comentários e textos da interface permanecem em português do Brasil.
- O pipeline obrigatório antes de commit é `pnpm turbo lint && pnpm turbo typecheck`.

## Review Focus

- Mapa inexistente, de outro evento ou em revisão: a operação deve rejeitar antes de alterar o evento ou o inventário; cobrir na Task 1.
- Falha no meio da transação: `defaultMapId`, inventário e auditoria devem permanecer no estado anterior; cobrir na Task 1.
- Sessão com `mapId` explícito no mapa antigo: a troca pode continuar, mas o mapa anterior precisa permanecer preservado e os IDs das sessões devem voltar na resposta; cobrir na Task 1.
- Novo mapa igual ao mapa atual: a operação deve ser idempotente e não bloquear/recriar inventário; cobrir na Task 1 e na Task 2.
- Falha ao substituir depois de confirmar: o painel deve manter a versão confirmada, informar que a troca está pendente e oferecer retry sem reenviar o upload; cobrir na Task 2.

### Task 1: Operação transacional de substituição na API

**Files:**
- Modify: `services/api/src/modules/eventos/mapas/mapas.service.ts`
- Modify: `services/api/src/modules/eventos/mapas/mapas.controller.ts`
- Test: `services/api/src/modules/eventos/mapas/mapas.service.spec.ts`
- Create: `services/api/src/modules/eventos/mapas/mapas.controller.spec.ts`

**Interfaces:**
- Consumes: `eventoMapas`, `eventos`, `eventoSessoes`, `eventoInventarioAssentos`, `eventoAuditorias`, `sincronizarInventarioMapa` e o ator administrativo existente.
- Produces: `substituirMapaPadrao(eventId: string, mapId: string, actor: EventoActor): Promise<MapReplacementResult>` e `POST /eventos/admin/:id/mapa-padrao/substituir` com corpo `{ mapId: string }`.
- `MapReplacementResult` deve expor `updated`, `previousMapId`, `inheritedSessionIds`, `inventorySessionIds`, `inventoryCreatedCount` e `previousMapArchive` com códigos `ARCHIVED`, `MAP_IN_USE` ou `NO_PREVIOUS_MAP`.

- [ ] **Step 1: Escrever os testes que definem o contrato da operação**
  - Cobrir troca de um mapa confirmado do mesmo evento.
  - Cobrir rejeição de mapa em revisão, inexistente e pertencente a outro evento.
  - Cobrir idempotência quando o novo mapa já é o padrão.
  - Cobrir arquivamento do mapa anterior sem referências.
  - Cobrir preservação do mapa anterior e retorno das sessões quando há `mapId` explícito.
  - Cobrir rollback quando uma etapa de inventário ou atualização falha.
  - Cobrir que a rota do controller existe, exige `{ mapId }` e delega ao serviço.

- [ ] **Step 2: Executar os testes em estado RED**

  Run: `pnpm --filter @essencia/api test -- --runInBand src/modules/eventos/mapas/mapas.service.spec.ts`

  Expected: FAIL porque `substituirMapaPadrao` e a nova rota ainda não existem.

- [ ] **Step 3: Implementar `substituirMapaPadrao` no `MapasService`**
  - Validar o evento e o escopo do ator com `assertEvent`.
  - Ler o mapa novo e rejeitar evento divergente ou status diferente de `CONFIRMADO`.
  - Retornar estado idempotente sem mutação quando `mapId` já for `defaultMapId`.
  - Dentro de uma única transação, capturar o mapa anterior, atualizar o evento, bloquear `DISPONIVEL`/`LIBERADO` das sessões herdadas, sincronizar o inventário do mapa novo e registrar auditoria.
  - Verificar referências explícitas ao mapa anterior antes de alterar seu status.
  - Arquivar o mapa anterior quando não houver referências e retornar `ARCHIVED`; caso contrário, preservar o mapa e retornar `MAP_IN_USE` com as sessões.
  - Remover o preview do storage somente depois do commit, sem desfazer a troca caso essa limpeza falhe.
  - Manter o original privado e nunca remover assentos estruturados de pedidos ou ingressos.

- [ ] **Step 4: Adicionar a rota administrativa**
  - Criar `POST /eventos/admin/:id/mapa-padrao/substituir` no `MapasController` com os mesmos guards e papéis das demais rotas.
  - Validar `mapId` como UUID antes de chamar o serviço e retornar o envelope de sucesso/erro usado pelo módulo.

- [ ] **Step 5: Executar os testes da API em estado GREEN**

  Run: `pnpm --filter @essencia/api test -- --runInBand src/modules/eventos/mapas/mapas.service.spec.ts`

  Expected: todos os testes novos e existentes do mapa passam.

- [ ] **Step 6: Fazer uma verificação de tipos e revisar a transação**

  Run: `pnpm --filter @essencia/api typecheck`

  Expected: saída sem erros de TypeScript; confirmar que nenhuma operação de checkout ou inventário de sessão explícita foi alterada.

- [ ] **Step 7: Commitar a entrega da API**

  ```bash
  git add services/api/src/modules/eventos/mapas/mapas.service.ts services/api/src/modules/eventos/mapas/mapas.controller.ts services/api/src/modules/eventos/mapas/mapas.service.spec.ts services/api/src/modules/eventos/mapas/mapas.controller.spec.ts
  git commit -m "feat: adiciona substituicao segura do mapa de eventos"
  ```

### Task 2: Integrar a substituição no painel administrativo

**Files:**
- Modify: `apps/eventos-admin/app/eventos/[id]/mapa/page.tsx`
- Modify: `apps/eventos-admin/features/eventos/map-review.tsx`
- Test: `apps/eventos-admin/features/eventos/map-review.test.ts`
- Test: `apps/eventos-admin/app/eventos/[id]/mapa/page.test.ts`

**Interfaces:**
- Consumes: `MapReplacementResult` retornado por `POST /eventos-admin/api/eventos/admin/:id/mapa-padrao/substituir`.
- Produces: `MapReview` recebe o estado `previousMapArchive` e callbacks de retry; a confirmação da nova versão chama a substituição uma vez, sem reenviar o arquivo.

- [ ] **Step 1: Escrever os testes de painel que devem falhar**
  - Verificar que a página chama a nova rota `mapa-padrao/substituir` depois de confirmar.
  - Verificar que o resultado `ARCHIVED` informa arquivamento concluído.
  - Verificar que `MAP_IN_USE` informa que o mapa anterior foi preservado e mostra as sessões afetadas.
  - Verificar que falha na substituição mantém a versão confirmada e oferece retry.
  - Verificar que retry usa o `mapId` confirmado existente e não dispara novo upload.

- [ ] **Step 2: Executar os testes em estado RED**

  Run: `pnpm --filter @essencia/eventos-admin test -- features/eventos/map-review.test.ts`

  Expected: FAIL porque a página ainda chama somente `PATCH /mapa-padrao` e não exibe `previousMapArchive`.

- [ ] **Step 3: Atualizar `MapaPage` para usar a operação de substituição**
  - Após `confirmar`, chamar `POST /mapa-padrao/substituir` com o `version` confirmado.
  - Armazenar `inheritedSessionIds`, `inventorySessionIds`, `inventoryCreatedCount` e `previousMapArchive`.
  - Em erro, manter `status="CONFIRMADO"`, marcar `mapaPadraoPendente` e oferecer retry com o mesmo `version`.
  - No carregamento inicial, preservar a sincronização idempotente do mapa atual sem arquivar versões por engano.

- [ ] **Step 4: Atualizar `MapReview` para comunicar o resultado**
  - Exibir mensagem de arquivamento concluído quando `ARCHIVED`.
  - Exibir mensagem de preservação e os IDs/quantidade de sessões quando `MAP_IN_USE`.
  - Manter os avisos existentes de inventário afetado e o botão de retry da troca.
  - Garantir que o upload continue disponível para criar outra versão em revisão.

- [ ] **Step 5: Executar os testes do painel em estado GREEN**

  Run: `pnpm --filter @essencia/eventos-admin test -- features/eventos/map-review.test.ts`

  Expected: todos os testes novos e existentes do fluxo de mapa passam.

- [ ] **Step 6: Executar typecheck e build do painel**

  Run: `pnpm --filter @essencia/eventos-admin typecheck && pnpm --filter @essencia/eventos-admin build`

  Expected: typecheck e build concluídos sem erros.

- [ ] **Step 7: Commitar a integração do painel**

  ```bash
  git add -- 'apps/eventos-admin/app/eventos/[id]/mapa/page.tsx' apps/eventos-admin/features/eventos/map-review.tsx apps/eventos-admin/features/eventos/map-review.test.ts -- 'apps/eventos-admin/app/eventos/[id]/mapa/page.test.ts'
  git commit -m "feat: integra substituicao segura no painel de mapas"
  ```

### Task 3: Verificação integrada e revisão final

**Files:**
- Modify: `docs/superpowers/plans/2026-11-01-eventos-substituicao-mapa-plan.md` para acompanhar as tarefas, se necessário
- Test: comandos globais do monorepo e testes focados da API e do painel

**Interfaces:**
- Consumes: rota administrativa, operação transacional e feedback do painel das Tasks 1 e 2.
- Produces: evidência de que o fluxo completo continua compatível com publicação, inventário e mapa público.

- [ ] **Step 1: Rodar a suíte focada completa**

  Run: `pnpm --filter @essencia/api test -- --runInBand src/modules/eventos` e `pnpm --filter @essencia/eventos-admin test`

  Expected: suites de eventos e painel passam sem falhas.

- [ ] **Step 2: Rodar o pipeline global obrigatório**

  Run: `pnpm turbo lint && pnpm turbo typecheck`

  Expected: todas as tarefas concluem com código zero; avisos preexistentes podem permanecer, sem novos erros.

- [ ] **Step 3: Rodar testes e build do monorepo afetado**

  Run: `pnpm turbo test --concurrency=1` e `pnpm --filter @essencia/eventos-admin build`

  Expected: testes globais passam e o painel gera build de produção.

- [ ] **Step 4: Revisar o diff e os contratos de segurança**

  Run: `git diff --check`, `git status --short` e inspeção do diff.

  Expected: nenhum whitespace inválido, somente arquivos previstos e nenhum acesso direto de app ao banco.

- [ ] **Step 5: Commitar somente após todas as verificações**

  ```bash
  git status --short
  git log --oneline --decorate -5
  ```

  Expected: branch limpa após os commits das tarefas e pronta para revisão/integração.
