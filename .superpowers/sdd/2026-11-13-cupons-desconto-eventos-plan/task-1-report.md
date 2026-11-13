# Relatório da Task 1

## Status
Concluída em 13/11/2026.

## Implementação
- Adicionados contratos de cupons, normalização de código e identidade do comprador.
- Estendido o cálculo sequencial de preços para aplicar oferta e cupom, com rateio determinístico por maior resto, descontos separados, snapshot aplicado e preços finais dos itens.
- Adicionados schemas administrativos e público para cupons e respectivas exportações.
- Atualizados tipos públicos de reserva/pedido com descontos e cupom aplicado.
- Testes unitários cobrindo normalização, identidade, cupons percentual/fixo, cupom de 100%, arredondamento, rateio sequencial e schemas.

## Validação
- `pnpm --filter @essencia/shared test -- src/eventos/cupons.test.ts src/eventos/precos.test.ts src/schemas/eventos-cupom.test.ts`: 18 testes aprovados.
- `pnpm --filter @essencia/shared typecheck`: aprovado.
- `pnpm --filter @essencia/shared lint`: aprovado; apenas 5 avisos preexistentes de `any` em `fetchers/client.ts`.

## Preocupações
A regra de rejeição de pagamentos positivos entre 1 e 99 centavos pertence ao fluxo de checkout; o motor de preços mantém esses totais calculáveis para permitir a validação posterior.

Atualizado em: 2026-11-13

## Correção round 1

- Corrigido o rateio para excluir itens de preço zero dos candidatos ao centavo residual e limitar a alocação ao valor disponível do item.
- Tornados obrigatórios `offerDiscountCents`, `couponDiscountCents` e `appliedCoupon` nos resultados públicos; serviço e fixtures foram ajustados.
- Adicionados testes comportamentais para cupom fixo, distribuição sequencial após oferta e item gratuito.

### Validação da correção
- `pnpm --filter @essencia/shared test -- src/eventos/cupons.test.ts src/eventos/precos.test.ts src/schemas/eventos-cupom.test.ts`: 20 testes aprovados.
- `pnpm --filter @essencia/shared typecheck`: aprovado.
- `pnpm --filter @essencia/shared lint`: aprovado; permanecem apenas 5 avisos preexistentes em `fetchers/client.ts`.
- `pnpm turbo typecheck`: iniciou todos os pacotes, sem erro reportado antes do limite de execução do comando.

Atualizado em: 2026-11-13

## Correção round 2

- Atualizados `reservaResult` e `obterVoucher` para preencher os campos obrigatórios de descontos separados e `appliedCoupon`.
- Cupons continuam nulos em vouchers de cortesia; reservas públicas usam snapshot persistido quando disponível.

### Validação da correção
- `pnpm --filter @essencia/shared test -- src/eventos/cupons.test.ts src/eventos/precos.test.ts src/schemas/eventos-cupom.test.ts`: 20 testes aprovados.
- `pnpm --filter @essencia/api typecheck`: aprovado.

Atualizado em: 2026-11-13
