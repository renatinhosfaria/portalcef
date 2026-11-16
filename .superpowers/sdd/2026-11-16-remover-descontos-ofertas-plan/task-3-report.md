# Relatório Task 3 — Remover ofertas do preço público

## Status
Concluída.

## Alterações
- Sessões públicas mantêm `offers: []` e não consultam mais o leitor de ofertas.
- Novas reservas calculam preço com `offers: []`, persistem `offerDiscountCents: 0` e `appliedOfferId: null`, e registram a fonte de preço dos ingressos.
- Aplicação de cupons recalcula somente sobre o subtotal, preservando campos históricos de ofertas em consultas de pedidos antigos.
- Testes públicos foram atualizados para validar reservas sem ofertas e cupons sobre o subtotal.

## Validação
- Testes focados da API: 4 suítes, 145 testes aprovados.
- `pnpm --filter @essencia/api typecheck`: aprovado.
- `pnpm --filter @essencia/eventos typecheck`: aprovado (symlink local de `node_modules` reutilizado).
- `pnpm --filter @essencia/shared typecheck`: aprovado.

## Preocupações
Nenhuma conhecida.
