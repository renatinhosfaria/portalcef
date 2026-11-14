# Relatório da Task 10 — Integração, regressão e verificação final

## Resultado

Status: DONE_WITH_CONCERNS.

A integração final foi concluída no commit desta task. Fixtures legadas foram atualizadas para preencher os campos públicos obrigatórios `offerDiscountCents`, `couponDiscountCents` e `appliedCoupon`. A documentação de API agora descreve a aplicação pública de cupons e o CRUD administrativo, incluindo payloads, respostas, versionamento e erros principais.

## Arquivos alterados

- `packages/components/src/eventos/pdf-ingresso.test.ts`
- `apps/eventos/components/__tests__/acoes-ingresso.test.tsx`
- `apps/eventos/components/__tests__/checkout.test.tsx`
- `apps/eventos/components/__tests__/escolha-lugares.test.tsx`
- `apps/eventos/components/__tests__/ingressos.test.tsx`
- `docs/API.md`

## Verificações executadas

- `pnpm --filter @essencia/shared test` — PASS (14 arquivos, 82 testes).
- `pnpm --filter @essencia/db test` — PASS (16 testes).
- `pnpm --filter @essencia/api exec jest src/modules/eventos/eventos-cupons.service.spec.ts src/modules/eventos/eventos-public-sales.service.spec.ts src/modules/eventos/eventos-pagamentos.service.spec.ts src/modules/eventos/eventos-confirmacao.service.spec.ts --runInBand` — PASS (4 suites, 117 testes).
- `pnpm --filter @essencia/eventos test` — PASS (23 arquivos, 158 testes).
- `pnpm --filter @essencia/eventos-admin test` — PASS (47 arquivos, 237 testes).
- `pnpm --filter @essencia/components test` — PASS (8 arquivos, 44 testes).
- `pnpm turbo lint` — PASS, com warnings legados já existentes no monorepo.
- `pnpm turbo typecheck` — PASS (22 pacotes).
- `git diff --check` — PASS.
- Rodada de revisão: fixture de checkout, teste focado de `checkout.test.tsx`, `@essencia/components test/typecheck/lint` e `@essencia/eventos typecheck/lint` — PASS; o lint de eventos mantém apenas o warning preexistente de `<img>`.

A execução integral de `pnpm --filter @essencia/api exec jest src/modules/eventos --runInBand` também foi feita. As suítes de cupons, checkout, pagamentos e confirmação passaram; 19 testes legados de `mapas/gerador` falharam com `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG`/`--experimental-vm-modules`, falha preexistente e fora do escopo desta task.

## Banco e segurança

Não houve alteração de schema ou migration nesta task. O ambiente não tinha `DATABASE_URL` nem um banco de desenvolvimento disponível, portanto `pnpm db:migrate` não foi executado e a integração da migration não pode ser considerada validada. `pnpm db:generate` também não foi necessário, pois não houve mudança de schema. A migration 0057 e os checks de cupons foram cobertos pelo teste do pacote `@essencia/db`; isso não substitui a aplicação em banco. A revisão da árvore não encontrou `.env`, segredos, pedidos reais ou mudanças fora do escopo.

## Preocupações

- Os testes do gerador de mapas PDF continuam dependentes da configuração de módulos VM do Jest e permanecem falhando no comando amplo da API. Não foram alterados para evitar ampliar o escopo.
- O lint global mantém warnings preexistentes, sem novos erros introduzidos por esta task.

Atualizado em: 2026-11-13
