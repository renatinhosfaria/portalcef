# Remoção de descontos por quantidade de eventos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Arquivar as ofertas de quantidade, retirar sua configuração do workspace e fazer novos pedidos usarem somente cupons, preservando preços e evidências de pedidos antigos.

**Architecture:** A migration marca ofertas ativas como inativas sem remover linhas. O painel e as rotas administrativas de ofertas deixam de existir, e os caminhos públicos calculam novas reservas sem ofertas. Ao alterar um pedido histórico com cupom, o serviço usa o preço líquido gravado em cada item como base, registra uma base anterior ao cupom quando necessário e mantém os campos históricos de oferta no pedido.

**Tech Stack:** NestJS, Next.js, React, TypeScript, Drizzle/PostgreSQL, Jest, Vitest, Turborepo.

**Spec:** `docs/superpowers/specs/2026-11-16-remover-descontos-ofertas-design.md`

## Global Constraints

- Comunicação, código de domínio, commits, documentação e comentários devem permanecer em português do Brasil.
- Apps não acessam o banco diretamente; o acesso continua na API HTTP.
- O escopo da escola continua vindo da sessão e os guards permanecem na ordem `AuthGuard, RolesGuard, TenantGuard` quando aplicável.
- Não apagar tabelas, ofertas, pedidos, snapshots ou colunas históricas.
- Novos pedidos devem ter `offerDiscountCents = 0` e `appliedOffer = null`; cupons continuam sendo aplicados normalmente.
- O backup criado pelo fluxo `./scripts/deploy.sh --migrar` é o rollback operacional da migration.

## Review Focus

- Oferta ativa existente no momento da migration: deve virar inativa sem `DELETE`; teste em `packages/db/src/schema/eventos.test.ts` e na migration.
- Nova reserva com quantidade suficiente para uma oferta antiga: deve ignorar a oferta e manter subtotal igual ao total antes de cupom; teste em `eventos-public-sales.service.spec.ts`.
- Pedido histórico com snapshot percentual ou fixo ao receber cupom: deve conservar o desconto de oferta e calcular o cupom sobre o preço líquido dos itens; teste em `eventos-public-sales.service.spec.ts`.
- Pedido legado sem snapshot de oferta: deve usar o `totalPriceCents` armazenado como base, sem reconstruir uma oferta; teste no mesmo serviço.
- Remoção ou reaplicação do cupom em pedido histórico: deve restaurar a base registrada antes do cupom e não acumular descontos; teste no mesmo serviço.

### Task 1: Arquivar ofertas existentes no banco

**Files:**
- Create: `packages/db/drizzle/0058_arquiva_ofertas_eventos.sql`
- Modify: `packages/db/drizzle/meta/_journal.json`
- Test: `packages/db/src/schema/eventos.test.ts`

**Interfaces:**
- Produces migration idempotente que executa `UPDATE evento_ofertas SET active = false, updated_at = now() WHERE active = true`.
- Não altera a tabela, não apaga linhas e não insere auditorias artificiais.

- [ ] **Step 1: Escrever testes que falham** para verificar que a migration 0058 atualiza somente ofertas ativas, não contém `DELETE`, preserva a tabela e pode ser executada novamente sem reativar linhas.
- [ ] **Step 2: Executar o teste focado e confirmar a falha**

  Run: `pnpm --filter @essencia/db test -- src/schema/eventos.test.ts`

  Expected: FAIL porque a migration 0058 ainda não existe.

- [ ] **Step 3: Criar a migration e registrar o journal** com o SQL de arquivamento não destrutivo, mantendo o padrão das migrations anteriores.
- [ ] **Step 4: Executar o teste focado e confirmar a passagem**

  Run: `pnpm --filter @essencia/db test -- src/schema/eventos.test.ts`

  Expected: PASS.

- [ ] **Step 5: Commitar**

  ```bash
  git add packages/db/drizzle/0058_arquiva_ofertas_eventos.sql packages/db/drizzle/meta/_journal.json packages/db/src/schema/eventos.test.ts
  git commit -m "feat: arquiva ofertas de eventos"
  ```

### Task 2: Remover a configuração administrativa de ofertas

**Files:**
- Modify: `apps/eventos-admin/app/eventos/[id]/ingressos/page.tsx`
- Modify: `apps/eventos-admin/app/eventos/[id]/ingressos/page.test.ts`
- Delete: `apps/eventos-admin/features/eventos/oferta-editor.tsx`
- Delete: `apps/eventos-admin/features/eventos/ofertas-contratos.ts`
- Delete: `apps/eventos-admin/features/eventos/ofertas-contratos.test.ts`
- Modify: `services/api/src/modules/eventos/eventos-admin.controller.ts`
- Modify: `services/api/src/modules/eventos/eventos.module.ts`
- Delete: `services/api/src/modules/eventos/eventos-ofertas.service.ts`
- Delete: `services/api/src/modules/eventos/eventos-ofertas.service.spec.ts`
- Modify: `packages/shared/src/schemas/eventos.ts`
- Modify: `packages/shared/src/schemas/index.ts`
- Modify: `packages/shared/src/types/eventos.ts`

**Interfaces:**
- A página de ingressos mantém ingressos e cupons, mas não renderiza “Descontos e ofertas”, não chama `/ofertas` e não mantém estado/autosave de ofertas.
- `EventosAdminController` deixa de expor `GET/PATCH /eventos/admin/:id/ofertas`.
- `EventosModule` deixa de registrar/exportar `EventosOfertasService`; schemas e tipos exclusivos de edição administrativa de ofertas são removidos se não houver outro consumidor.
- Tipos históricos `OfertaPrecoPublica` e `appliedOffer` permanecem para respostas de pedidos antigos.

- [ ] **Step 1: Atualizar testes da página e do controller** para exigir ausência da seção, ausência de `/ofertas` e continuidade do editor de cupons, além de verificar que as rotas administrativas de ofertas não existem.
- [ ] **Step 2: Executar os testes focados e confirmar a falha**

  Run: `pnpm --filter @essencia/eventos-admin test -- app/eventos/[id]/ingressos/page.test.ts`
  Run: `pnpm --filter @essencia/api test -- eventos-ofertas.service.spec.ts eventos-admin.controller.spec.ts`

  Expected: FAIL porque a página e a API ainda expõem ofertas.

- [ ] **Step 3: Remover estados, effects, autosave, editor, contratos, serviço, provider e endpoints de ofertas**, sem alterar o carregamento/autosave dos cupons.
- [ ] **Step 4: Executar testes focados e typecheck dos pacotes alterados**

  Run: `pnpm --filter @essencia/eventos-admin test -- app/eventos/[id]/ingressos/page.test.ts`
  Run: `pnpm --filter @essencia/api test -- eventos-admin.controller.spec.ts`
  Run: `pnpm --filter @essencia/eventos-admin typecheck && pnpm --filter @essencia/api typecheck && pnpm --filter @essencia/shared typecheck`

  Expected: PASS; nenhuma importação de `EventosOfertasService`, `OfertaEditor` ou endpoint `/ofertas` permanece no fluxo administrativo.

- [ ] **Step 5: Commitar**

  ```bash
  git add apps/eventos-admin services/api/src/modules/eventos packages/shared/src/schemas packages/shared/src/types
  git commit -m "refactor: remove configuracao de ofertas dos eventos"
  ```

### Task 3: Retirar ofertas do fluxo público de novos pedidos

**Files:**
- Modify: `services/api/src/modules/eventos/eventos.service.ts`
- Modify: `services/api/src/modules/eventos/eventos.service.spec.ts`
- Modify: `services/api/src/modules/eventos/eventos-public-sales.service.ts`
- Modify: `services/api/src/modules/eventos/eventos-public-sales.service.spec.ts`
- Modify: `services/api/src/modules/eventos/eventos-public.controller.spec.ts`
- Modify: `packages/shared/src/types/eventos.ts`
- Modify: `apps/eventos/lib/eventos-api.ts`
- Modify: `apps/eventos/components/__tests__/ingressos.test.tsx`

**Interfaces:**
- `EventosService.listarSessoesPublicas` retorna `offers: []` por compatibilidade de formato, sem consultar serviço/tabela de ofertas.
- `EventosPublicSalesService.reservarAssentos` chama `calcularPrecoPedido` com `offers: []`, não importa/consulta `eventoOfertas` e grava evidência com fonte de preço dos ingressos.
- Novas reservas retornam `offerDiscountCents: 0`, `appliedOffer: null` e calculam cupons somente sobre o subtotal.

- [ ] **Step 1: Escrever testes que falham** para sessão pública com `offers: []`, reserva de dez lugares sem desconto de oferta e reserva com cupom aplicado diretamente ao subtotal.
- [ ] **Step 2: Executar os testes focados e confirmar a falha**

  Run: `pnpm --filter @essencia/api test -- eventos.service.spec.ts eventos.public.controller.spec.ts eventos-public-sales.service.spec.ts`

  Expected: FAIL porque os testes atuais ainda retornam/aplicam ofertas.

- [ ] **Step 3: Remover consultas, imports e filtros de ofertas dos serviços públicos**, mantendo os campos históricos nos resultados de pedido e o caminho de cupons.
- [ ] **Step 4: Executar testes focados e typecheck**

  Run: `pnpm --filter @essencia/api test -- eventos.service.spec.ts eventos.public.controller.spec.ts eventos-public-sales.service.spec.ts`
  Run: `pnpm --filter @essencia/api typecheck && pnpm --filter @essencia/eventos typecheck && pnpm --filter @essencia/shared typecheck`

  Expected: PASS; nenhum novo pedido aplica `offerDiscountCents`.

- [ ] **Step 5: Commitar**

  ```bash
  git add services/api/src/modules/eventos packages/shared/src/types/eventos.ts apps/eventos
  git commit -m "feat: remove ofertas do preco publico de novos pedidos"
  ```

### Task 4: Preservar ofertas históricas durante aplicação e remoção de cupons

**Files:**
- Modify: `services/api/src/modules/eventos/eventos-public-sales.service.ts`
- Modify: `services/api/src/modules/eventos/eventos-public-sales.service.spec.ts`
- Modify: `services/api/src/modules/eventos/eventos-pagamentos.service.spec.ts`
- Modify: `apps/eventos/components/checkout/__tests__/resumo-pedido.test.tsx`

**Interfaces:**
- Adicionar helper privado no serviço, por exemplo `precoBaseHistorico(itemRow): number`, que use `pricingEvidence.couponBaseUnitPriceCents` quando existir e, caso contrário, `item.totalPriceCents`/`item.unitPriceCents` como preço líquido histórico.
- `aplicarCupom` deve chamar `calcularPrecoPedido({ items, offers: [], coupon })` sobre esses preços líquidos, preservar `order.subtotalCents`, `order.offerDiscountCents` e o snapshot histórico, e gravar `couponBaseUnitPriceCents` antes de alterar o item pela primeira vez.
- Remover cupom deve usar a base registrada, zerar somente o desconto do cupom e restaurar os totais/itens anteriores ao cupom; não deve recalcular uma oferta arquivada.
- Snapshots divergentes permanecem por item; `appliedOfferId` é rastreabilidade, não fonte de preço.

- [ ] **Step 1: Escrever testes que falham** para pedido com snapshot percentual, pedido com oferta fixa, pedido legado sem snapshot e aplicação/remoção repetida de cupom.
- [ ] **Step 2: Executar os testes focados e confirmar a falha**

  Run: `pnpm --filter @essencia/api test -- eventos-public-sales.service.spec.ts -t "histórico|cupom"`

  Expected: FAIL porque `aplicarCupom` ainda consulta ofertas ativas e não registra a base anterior ao cupom.

- [ ] **Step 3: Implementar a base histórica por item e atualizar `pricingEvidence`**, sem alterar o algoritmo de ofertas usado apenas por pedidos históricos já persistidos.
- [ ] **Step 4: Executar testes focados e confirmar a passagem**

  Run: `pnpm --filter @essencia/api test -- eventos-public-sales.service.spec.ts -t "histórico|cupom"`

  Expected: PASS; percentuais, valores fixos, ausência de snapshot e remoção/reaplicação preservam os valores históricos.

- [ ] **Step 5: Commitar**

  ```bash
  git add services/api/src/modules/eventos/eventos-public-sales.service.ts services/api/src/modules/eventos/eventos-public-sales.service.spec.ts services/api/src/modules/eventos/eventos-pagamentos.service.spec.ts apps/eventos/components/checkout/__tests__/resumo-pedido.test.tsx
  git commit -m "fix: preserva ofertas historicas ao aplicar cupons"
  ```

### Task 5: Atualizar documentação, fixtures e verificação final

**Files:**
- Modify: `docs/API.md`
- Modify: `docs/DATABASE.md`
- Modify: `apps/eventos/scripts/smoke-publico.mjs`
- Modify: fixtures/testes públicos e administrativos que ainda esperem ofertas novas
- Create: `.superpowers/sdd/2026-11-16-remover-descontos-ofertas-plan/task-*.md` conforme a execução

**Interfaces:**
- Documentar que cupons são o único desconto configurável para novos pedidos e que `offerDiscountCents`/`appliedOffer` representam apenas histórico.
- O smoke público deve verificar que uma sessão não anuncia ofertas e que cupom continua reduzindo o total.

- [ ] **Step 1: Atualizar documentação e fixtures** removendo exemplos que afirmem oferta ativa para novos pedidos e preservando exemplos de pedido histórico.
- [ ] **Step 2: Executar os testes públicos/admin focados e o smoke local**

  Run: `pnpm --filter @essencia/eventos test`
  Run: `pnpm --filter @essencia/eventos-admin test`
  Run: `node apps/eventos/scripts/smoke-publico.mjs`

  Expected: PASS.

- [ ] **Step 3: Executar o pipeline global**

  Run: `pnpm turbo lint && pnpm turbo typecheck && pnpm turbo test`

  Expected: lint sem erros, typecheck sem erros e testes sem falhas novas da feature.

- [ ] **Step 4: Revisar a migration e executar `db:migrate` em ambiente autorizado**, confirmando que ofertas ativas foram arquivadas e nenhum pedido foi removido.
- [ ] **Step 5: Commitar documentação e fixtures**

  ```bash
  git add docs apps/eventos/scripts .superpowers/sdd
  git commit -m "docs: registra remoção de ofertas dos eventos"
  ```
