# Geração automática do inventário ao confirmar o mapa — Plano de Implementação

> **Para agentes de implementação:** use `superpowers:subagent-driven-development` ou `superpowers:executing-plans` para executar este plano tarefa por tarefa. Cada tarefa deve seguir RED-GREEN-REFACTOR.

**Objetivo:** gerar automaticamente o inventário das sessões quando um mapa confirmado for aplicado, eliminando a pendência de assentos vendáveis após a revisão do mapa.

**Arquitetura:** a API continuará sendo a autoridade para mapa, sessões, inventário e prontidão. A confirmação do mapa criará ou reconciliará inventário dentro da mesma transação, usando somente os assentos estruturados do mapa confirmado; a interface exibirá o resultado da operação e a prontidão será recalculada pelo workspace.

**Stack:** NestJS, Fastify, Drizzle/PostgreSQL, Next.js, Vitest e Jest.

**Especificação:** `docs/superpowers/specs/2026-10-31-eventos-inventario-automatico-design.md`

## Restrições globais

- A confirmação do mapa não publica o evento nem a sessão.
- Assentos `sellable = true` nascem `DISPONIVEL`; assentos `sellable = false` nascem `BLOQUEADO`.
- A prontidão conta apenas `DISPONIVEL` e `LIBERADO` contra a capacidade da sessão.
- Reprocessamentos não podem duplicar nem sobrescrever assentos vendidos, reservados ou bloqueados operacionalmente.
- Apps continuam acessando o banco somente pela API HTTP.
- Comunicação, domínio, textos, comentários e documentação permanecem em Português do Brasil.

## Foco de revisão

- Confirmação repetida do mesmo mapa não duplica inventário.
- Sessões herdadas e sessões com mapa específico recebem inventário somente quando usam o mapa confirmado.
- Um assento não vendável permanece bloqueado e não satisfaz a capacidade vendável.
- Alterações de mapa não sobrescrevem reservas ou vendas existentes.
- Falhas na transação não deixam mapa confirmado sem inventário parcialmente criado.

### Task 1: Geração transacional e idempotente do inventário

**Arquivos:**
- Modificar: `services/api/src/modules/eventos/mapas/mapas.service.ts`
- Modificar: `services/api/src/modules/eventos/mapas/mapas.service.spec.ts`
- Modificar: `services/api/src/modules/eventos/eventos.service.ts` somente se o helper de inventário precisar ser compartilhado
- Testar: `services/api/src/modules/eventos/eventos.service.spec.ts` quando a propagação do mapa padrão for afetada

**Interfaces:**
- Criar helper privado `sincronizarInventarioMapa(db, eventId, mapId, actor)` no serviço de mapas.
- O helper localiza sessões do evento cujo mapa efetivo seja `mapId`, incluindo sessões que herdam o mapa padrão, e cria os registros ausentes em `eventoInventarioAssentos`.
- O retorno de `confirmar` inclui `inventorySessionIds` e `inventoryCreatedCount` para a interface informar o resultado.

- [ ] **Passo 1: escrever testes que falham** para geração de assentos disponíveis e bloqueados, idempotência, sessões herdadas e específicas, e preservação de estados `RESERVADO`, `VENDIDO` e `BLOQUEADO` existentes.
- [ ] **Passo 2: executar os testes** com `pnpm --filter @essencia/api test -- --runInBand src/modules/eventos/mapas/mapas.service.spec.ts src/modules/eventos/eventos.service.spec.ts`; confirmar falha pela ausência de inventário.
- [ ] **Passo 3: implementar o helper e integrá-lo à mesma transação de `confirmar`**, usando `eventoMapaAssentos` como fonte e `eventoInventarioAssentos` como projeção por sessão; inserir somente combinações ausentes.
- [ ] **Passo 4: executar os testes focados** e confirmar PASS para geração, bloqueio, idempotência e preservação operacional.
- [ ] **Passo 5: executar `pnpm --filter @essencia/api typecheck`**.
- [ ] **Passo 6: commit** `feat: gera inventario ao confirmar mapa`.

### Task 2: Feedback do workspace e prontidão após confirmação

**Arquivos:**
- Modificar: `apps/eventos-admin/app/eventos/[id]/mapa/page.tsx`
- Modificar: `apps/eventos-admin/features/eventos/map-review.tsx`
- Criar ou modificar: `apps/eventos-admin/features/eventos/map-review.test.ts`
- Modificar: `services/api/src/modules/eventos/eventos-readiness.service.spec.ts` se a resposta precisar cobrir a transição confirmada com inventário

**Interfaces:**
- `MapReview` recebe uma mensagem opcional de inventário gerado e a exibe após confirmação.
- A página de mapa interpreta `inventoryCreatedCount` e `inventorySessionIds` da API, recarrega a revisão e informa que a etapa depende apenas das demais pendências.
- Nenhuma regra de prontidão será duplicada no React.

- [ ] **Passo 1: escrever testes que falham** para exibir a confirmação do mapa e a quantidade de inventário criado, além de preservar a mensagem de revisão quando o inventário não puder ser gerado.
- [ ] **Passo 2: executar o teste** com `pnpm --filter @essencia/eventos-admin exec vitest run --environment node features/eventos/map-review.test.ts`; confirmar falha.
- [ ] **Passo 3: implementar o feedback visual** e o recarregamento após a confirmação, sem marcar a prontidão localmente.
- [ ] **Passo 4: executar os testes do app** com `pnpm --filter @essencia/eventos-admin test`.
- [ ] **Passo 5: executar lint, typecheck e build** do app.
- [ ] **Passo 6: commit** `fix: atualiza feedback da confirmacao do mapa`.

### Task 3: Verificação integrada e deploy

- [ ] **Passo 1: executar `pnpm turbo lint && pnpm turbo typecheck`**.
- [ ] **Passo 2: executar `pnpm turbo test`**.
- [ ] **Passo 3: revisar o diff** para tenant, transação, idempotência e ausência de acesso direto ao banco no app.
- [ ] **Passo 4: fazer commit final**, se houver ajustes de integração.
- [ ] **Passo 5: executar `git push origin main`**.
- [ ] **Passo 6: executar `./scripts/deploy.sh`** e confirmar health check externo, containers, PostgreSQL, Redis e MinIO.

