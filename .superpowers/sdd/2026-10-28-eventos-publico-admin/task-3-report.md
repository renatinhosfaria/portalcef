# Relatório da Task 3

## Implementação

- Adicionados DTOs e schemas compartilhados para reserva, finalização e checkout públicos.
- Adicionado `EventosPublicSalesService` com políticas públicas por maior versão ativa, reserva transacional de inventário, preço calculado no banco, pedido `INICIADO`, idempotência, aceite de políticas, consulta mínima, checkout e liberação de reservas expiradas.
- Adicionadas rotas públicas com `@Public()` e throttling para políticas, reservas, finalização, checkout e consulta.
- O enum de aceites foi ampliado para os cinco tipos de política sem migration estrutural.

## Validação

- `pnpm --filter @essencia/shared build` — passou.
- `pnpm --filter @essencia/api typecheck` — passou.
- `pnpm --filter @essencia/api lint` — passou.
- `pnpm --filter @essencia/db test -- --run packages/db/src/schema/eventos.test.ts` — passou (3 testes).
- Suíte Jest focada da API foi iniciada, mas o runner existente falha ao carregar `packages/db/src/client.js` como ESM (`Cannot use import statement outside a module`) antes de executar os testes.

## Pontos de atenção

- A integração Stripe concreta permanece delegada à Task 4; a rota grava o pagamento pendente e retorna a URL de sucesso como placeholder de contrato.
- A suíte Jest da API precisa da configuração ESM já conhecida do monorepo para executar os testes novos.
