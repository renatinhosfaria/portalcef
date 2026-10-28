# Relatório da Task 5 — checkout público de Eventos

## RED — testes escritos antes da implementação

Foram criados os testes de contrato e comportamento em:

- `apps/eventos/components/__tests__/formulario-checkout.test.tsx`
- `apps/eventos/components/__tests__/consulta-pedido.test.tsx`
- `apps/eventos/lib/eventos-api.test.ts`

Comando executado:

```bash
pnpm --filter @essencia/eventos test
```

Saída RED confirmada: 5 testes falharam porque `reservarAssentos`, `iniciarCheckout` e `aceitesCompletos` ainda não existiam e os componentes continuavam placeholders sem o contrato de checkout/consulta. A falha ocorreu nos comportamentos da Task 5, sem erro de runner.

## GREEN — implementação

- Cliente HTTP público tipado com reserva, finalização, checkout, políticas e consulta; `Idempotency-Key` é gerada no navegador, erros `409` preservam a seleção e nenhum cookie administrativo é enviado.
- Formulário de checkout exige comprador, participantes e cinco políticas ativas com conteúdo/versão; envia `participantIndex`, mantém `orderNumber`/`reservationId` em memória e URL e redireciona exclusivamente para a `checkoutUrl` retornada pela API.
- Consulta aceita somente número do pedido, trata rate limit em português, renderiza resposta mínima e informa “pagamento pendente” até a confirmação do webhook.
- Páginas de sessão, checkout e pedido preservam estados do mapa e consultam o pedido após o retorno do pagamento.

## Validação

```text
pnpm --filter @essencia/eventos test       — PASS (4 arquivos, 13 testes)
pnpm --filter @essencia/eventos lint       — PASS (apenas avisos preexistentes do Next sobre next lint/lockfiles)
pnpm --filter @essencia/eventos typecheck  — PASS
pnpm --filter @essencia/eventos build      — PASS (standalone)
pnpm turbo lint && pnpm turbo typecheck   — PASS (21/21 lint, 22/22 typecheck; avisos preexistentes)
```

## Arquivos

- `apps/eventos/lib/eventos-api.ts` e `apps/eventos/lib/eventos-api.test.ts`
- `apps/eventos/components/formulario-checkout.tsx`
- `apps/eventos/components/consulta-pedido.tsx`
- `apps/eventos/components/mapa-assentos.tsx`
- `apps/eventos/components/__tests__/formulario-checkout.test.tsx`
- `apps/eventos/components/__tests__/consulta-pedido.test.tsx`
- `apps/eventos/app/checkout/page.tsx`
- `apps/eventos/app/evento/[slug]/sessao/[sessionId]/page.tsx`
- `apps/eventos/app/pedido/[orderNumber]/page.tsx`
