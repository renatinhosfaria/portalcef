# Relatório da Task 2 — Persistência, índices e migração dos cupons

## Status

Concluída.

## Implementação

- Criadas as tabelas `evento_cupons`, `evento_cupom_retencoes` e `evento_cupom_usos`, incluindo tipos Drizzle de seleção e inserção.
- Adicionadas validações de preço, período, limites e estados operacionais, além dos índices por evento/status e unicidade por evento/código e cupom/pedido.
- `evento_pedidos` agora guarda `offerDiscountCents`, `couponDiscountCents`, `appliedCouponId` e `couponSnapshot`, mantendo checks de valores não negativos e relação do cupom aplicado.
- Adicionadas relações Drizzle entre evento, cupom, pedido, retenções e usos.
- Criada a migration `0057_eventos_cupons.sql` e registrada no journal.
- Testes de schema cobrem contratos, checks, índices, colunas do pedido e migration.

## Verificação

- `pnpm --filter @essencia/db test` — 16 testes passando.
- `pnpm --filter @essencia/db typecheck` — passando.
- `pnpm --filter @essencia/db lint` — passando.
- `git diff --check` — passando.

## Preocupações

A normalização do código do cupom (trim/uppercase) continua sendo responsabilidade da camada de aplicação antes da persistência; o banco garante unicidade do valor persistido por evento.
