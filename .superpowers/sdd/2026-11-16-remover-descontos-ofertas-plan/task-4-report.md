# Relatório da Task 4

## Implementação

- O preço-base usado ao aplicar ou remover cupom agora vem de `pricingEvidence.couponBaseUnitPriceCents` quando já registrado; pedidos legados usam o preço líquido persistido do item (`totalPriceCents` ou `unitPriceCents`).
- A primeira operação de cupom registra `couponBaseUnitPriceCents` no item e mantém esse valor para substituições e remoções posteriores.
- `subtotalCents`, `offerDiscountCents`, `appliedOfferId` e os snapshots históricos de oferta permanecem intactos. A rotina de cupom continua chamando `calcularPrecoPedido` com `offers: []`, sem reconstruir ofertas percentuais ou fixas arquivadas.
- A remoção zera somente o desconto do cupom e restaura o preço líquido histórico de cada item.

## Fix round 1

- Finding corrigido: registros de produção podem guardar a alocação do desconto da oferta em `allocatedDiscountCents`, sem o campo derivado `allocatedOfferDiscountCents`. Ao aplicar ou remover cupom, o serviço agora recupera essa parcela histórica pela diferença entre o preço bruto e o preço-base do cupom, ou pela diferença entre os descontos alocado e do cupom, preservando a oferta arquivada.
- Foi adicionada uma regressão cobrindo o formato histórico sem `allocatedOfferDiscountCents`, incluindo aplicação e remoção do cupom e a persistência do campo derivado.
- Verificação real:
  - `pnpm --filter @essencia/api test -- eventos-public-sales.service.spec.ts --runInBand` — **PASS**; 1 suíte, 81 testes, 0 snapshots.
  - `pnpm --filter @essencia/api typecheck` — **PASS** (`tsc --noEmit`, código de saída 0).

## Testes TDD

- RED confirmado antes da implementação: os testes de oferta percentual histórica e pedido legado falharam porque o serviço recalculava a partir do preço bruto e apagava a rastreabilidade da oferta.
- GREEN confirmado após a implementação:
  - `pnpm --filter @essencia/api test -- eventos-public-sales.service.spec.ts --runInBand` — 80 testes passando.
  - `pnpm --filter @essencia/api test -- eventos-pagamentos.service.spec.ts --runInBand` — 25 testes passando.
  - `pnpm --filter @essencia/eventos test -- resumo-pedido.test.tsx` — 3 testes passando.
  - `pnpm --filter @essencia/api typecheck` — passou.
  - `pnpm --filter @essencia/api lint` — passou sem erros; o repositório mantém 1.325 avisos preexistentes de `no-explicit-any`/`no-unused-vars`.

## Arquivos alterados

- `services/api/src/modules/eventos/eventos-public-sales.service.ts`
- `services/api/src/modules/eventos/eventos-public-sales.service.spec.ts`

Os testes de pagamentos e do resumo de checkout já cobrem os contratos afetados e não precisaram de alteração.

## Preocupações

- Para pedidos legados que já tinham cupom aplicado antes da introdução de `couponBaseUnitPriceCents`, sem qualquer evidência de preço anterior, a remoção só consegue usar o preço líquido atualmente persistido, conforme o fallback definido no brief.
