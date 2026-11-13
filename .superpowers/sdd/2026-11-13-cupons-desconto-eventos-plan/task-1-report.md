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
