# Relatório da Task 4

## RED — testes escritos antes da implementação

Foram escritos testes para:

- rejeição de valor divergente antes de vender assentos;
- idempotência de `checkout.session.completed` sem ingressos duplicados;
- falha/expiração liberando somente reservas não vendidas;
- job de expiração executado duas vezes;
- encaminhamento de checkout de Evento pela metadata, mantendo a loja intacta.

Comando tentado conforme plano:

```bash
pnpm exec vitest run services/api/src/modules/eventos/eventos-pagamentos.service.spec.ts services/api/src/modules/eventos/jobs/eventos-expiration.job.spec.ts services/api/src/modules/payments/payments-webhook.controller.spec.ts
```

Saída: falhou antes de executar porque este monorepo não possui `vitest` (`ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "vitest" not found`).

Runner equivalente disponível:

```bash
pnpm --filter @essencia/api test -- --config jest.eventos.config.js --runInBand src/modules/eventos/eventos-pagamentos.service.spec.ts src/modules/eventos/jobs/eventos-expiration.job.spec.ts src/modules/payments/payments-webhook.controller.spec.ts
```

Saída RED esperada e confirmada: 3 suítes falharam antes dos testes, com `TS2307` para os arquivos ainda inexistentes `eventos-pagamentos.service.ts` e `eventos-expiration.job.ts`, e `TS2554` porque o controller ainda recebia somente 3 dependências.

## Implementação

- `EventosPagamentosService` reconcilia somente pagamentos ligados a `eventoPagamentos`/`eventoPedidos`, valida centavos, trata repetições idempotentes, converte reservas em assentos vendidos e ingressos com token HMAC/QR apenas após aprovação, e registra auditoria sem PII/segredos.
- `falharCheckout` marca pagamento/pedido como falho, libera apenas inventário ainda `RESERVADO` pelo próprio pedido e preserva pedidos confirmados.
- `EventosPublicSalesService.iniciarCheckout` usa `PaymentsService.createCheckoutSession` com URLs HTTPS recebidas, metadata `eventOrderId`/`orderNumber`, idempotency key vinculada ao pedido e persiste `eventoPagamentos`; o prazo é estendido ao mínimo aceito pelo Stripe para evitar cobrança após a expiração da reserva.
- `PaymentsWebhookController` encaminha checkout concluído, Pix aprovado, falha, expiração e eventos de PaymentIntent quando existe `eventOrderId`; sem essa metadata o fluxo da loja permanece inalterado.
- `EventosExpirationJob` registra cron de um minuto e delega liberação idempotente de reservas `ATIVA` vencidas; pedidos confirmados/usados/reembolsados não são tocados.
- O shim de testes focado exporta `eventoIngressos`/`inArray` para evitar carregar o cliente ESM do pacote DB.

## Validação final

- `pnpm --filter @essencia/api test -- --config jest.eventos.config.js --runInBand src/modules/eventos/eventos-pagamentos.service.spec.ts src/modules/eventos/jobs/eventos-expiration.job.spec.ts src/modules/payments/payments-webhook.controller.spec.ts src/modules/eventos/eventos-public-sales.service.spec.ts src/modules/eventos/eventos-public.controller.spec.ts` — **PASS**, 5 suítes/12 testes.
- `pnpm --filter @essencia/api typecheck` — **PASS**.
- `pnpm --filter @essencia/api lint` — **PASS**, somente avisos `any` preexistentes/locais.
- `pnpm turbo lint && pnpm turbo typecheck` — **PASS**, 21 tarefas de lint e 22 de typecheck.
- `pnpm turbo test --filter=@essencia/api` — **878 testes PASS**, mas 5 suítes de Eventos/Payments não carregam no Jest global por `Cannot use import statement outside a module` em `packages/db/src/client.js`; a configuração focada acima é a mesma mitigação ESM documentada na Task 3.

## Arquivos

- `services/api/src/modules/eventos/eventos-pagamentos.service.ts`
- `services/api/src/modules/eventos/eventos-pagamentos.service.spec.ts`
- `services/api/src/modules/eventos/jobs/eventos-expiration.job.ts`
- `services/api/src/modules/eventos/jobs/eventos-expiration.job.spec.ts`
- `services/api/src/modules/eventos/eventos-public-sales.service.ts`
- `services/api/src/modules/eventos/eventos.module.ts`
- `services/api/src/modules/payments/payments.service.ts`
- `services/api/src/modules/payments/payments-webhook.controller.ts`
- `services/api/src/modules/payments/payments-webhook.controller.spec.ts`
- `services/api/src/modules/payments/payments.module.ts`
- `services/api/test/db-jest-shim.ts`

## Rodada de correção 1/5

Achados tratados:

- Confirmação agora marca pagamento `PROCESSANDO` com atualização condicional, exige reserva `ATIVA`, inventário `RESERVADO` do próprio pedido e `returning()` com exatamente uma linha antes de vender; qualquer divergência lança erro e a transação desfaz pagamento, inventário e ingressos.
- A mesma serialização impede emissão duplicada em webhooks simultâneos; repetição após `APROVADO`/`CONFIRMADO` retorna sem inserir outro ingresso. O PaymentIntent pode resolver pelo `eventOrderId` quando a referência Stripe ainda não foi persistida.
- Falha e expiração exigem transições condicionais com linha afetada; corrida contra assento vendido desfaz a operação e preserva a reserva/pedido pago.
- Provider de Eventos é obrigatório no webhook; ausência gera `EVENTOS_PAYMENTS_PROVIDER_UNAVAILABLE` em vez de no-op silencioso.
- Token QR exige `EVENTOS_QR_SECRET` dedicado na inicialização, sem fallback previsível.
- URLs de retorno precisam usar a origem HTTPS configurada em `EVENTOS_PUBLIC_URL` (padrão `https://eventos.portalcef.com.br`), rejeitando hosts arbitrários.
- Testes passaram a usar banco falso transacional representativo, verificando conversão, rollback, concorrência, PaymentIntent sem ID, falha protegida e job em duas execuções.

RED contra o commit anterior `07b8142`:

```text
pnpm --filter @essencia/api test -- --config jest.eventos.config.js --runInBand \
  src/modules/eventos/eventos-pagamentos.service.spec.ts \
  src/modules/payments/payments-webhook.controller.spec.ts \
  src/modules/eventos/eventos-public-sales.service.spec.ts
```

Falhou antes da execução completa com `TS2353` para `eventOrderId` inexistente no contrato anterior, além de expectativa de metadata ausente e provider ausente resolvendo em vez de rejeitar.

GREEN:

- Mesmo comando focado, incluindo `eventos-public.controller.spec.ts` — **4 suítes, 19 testes PASS**.
- `src/modules/shop/shop-regressions.spec.ts` — **126 testes PASS**, preservando a loja.
- `pnpm --filter @essencia/api typecheck` — **PASS**.
- `pnpm --filter @essencia/api lint` — **PASS**, somente avisos de `any`.
- `pnpm --filter @essencia/db test -- --test-name-pattern eventos` — **3 testes PASS**.
- `pnpm --filter @essencia/db build` e `pnpm --filter @essencia/shared build` — **PASS**.
- `pnpm turbo lint && pnpm turbo typecheck` após a correção — **PASS**, 21 tarefas de lint e 22 de typecheck.

## Rodada de correção 2/5

- Referências de checkout e PaymentIntent agora usam `AND` quando ambas chegam; o fallback por `eventOrderId` valida que o pedido e as referências persistidas são coerentes e rejeita mistura de pedidos.
- A transição `PROCESSANDO` usa lease de cinco minutos: pagamento stale pode ser retomado condicionalmente, enquanto um processamento ativo permanece serializado pela atualização condicional.
- Falhas/cancelamentos de PaymentIntent também recebem `eventOrderId`, permitindo liberar o pedido quando o PI não existia na persistência inicial.
- `docker-compose.prod.yml` encaminha `EVENTOS_QR_SECRET` e `EVENTOS_PUBLIC_URL` ao serviço API; os valores reais continuam fora do Git.
- O fake transacional respeita predicates de IDs/status/data, e os testes cobrem referências conflitantes, lease stale e falhas/cancelamentos por PI sem ID persistido.

RED contra `d61075a`:

```text
pnpm --filter @essencia/api test -- --config jest.eventos.config.js --runInBand \
  src/modules/eventos/eventos-pagamentos.service.spec.ts \
  src/modules/payments/payments-webhook.controller.spec.ts
```

Falhou com confirmação indevida da referência conflitante e falha no cenário `PROCESSANDO` stale.

GREEN da rodada:

- Suíte focada de Eventos/Payments/Public — **4 suítes, 22 testes PASS**.
- Regressões da loja — **126 testes PASS**.
- `pnpm --filter @essencia/api typecheck` — **PASS**.
- `pnpm --filter @essencia/db test -- --test-name-pattern eventos` — **3 testes PASS**.
- `pnpm --filter @essencia/db build` e `pnpm --filter @essencia/shared build` — **PASS**.

## Rodada de correção 3/5

- O teste de concorrência deixou de serializar artificialmente o fake: duas transações iniciam sobre o mesmo estado compartilhado, uma conclui a emissão e a outra recebe `PAYMENT_IN_PROGRESS`; há também casos separados para `PROCESSANDO` ativo e stale recuperável.
- Adicionado teste comportamental do serviço para falha de PaymentIntent sem ID persistido, resolvida por `eventOrderId`, verificando liberação do inventário, reserva `LIBERADA`, pagamento `EXPIRADO` e pedido `CANCELADO`.
- O shim DB agora marca cada tabela e coluna (`__table`/`__column`), e o fake avalia `eq`, `and`, `or`, `lte` e `inArray` pela coluna correta; referências conflitantes falham se o marcador não coincidir.

RED contra o fake anterior de `fdb9452`:

```text
pnpm --filter @essencia/api test -- --config jest.eventos.config.js --runInBand \
  src/modules/eventos/eventos-pagamentos.service.spec.ts
```

Falhou porque o fake anterior serializava a corrida, não distinguia colunas e deixava a expiração/falha protegida sem os estados esperados.

GREEN:

- Focused Eventos/Payments/Public — **4 suítes, 24 testes PASS**.
- Regressões da loja — **126 testes PASS**.
- API typecheck/lint, DB schema (3 testes), DB build e shared build — **PASS**.
- Pipeline global `pnpm turbo lint && pnpm turbo typecheck` — **PASS**, 21 tarefas de lint e 22 de typecheck.

## Rodada de correção 4/5

- O fake transacional passou a resolver cada marcador pelo par `__table`/`__column`, rejeitando referências de tabela errada em `eq`, `and`, `or`, `lte` e `inArray`, tanto em filtros simples quanto em atualizações condicionais.
- A seleção conjunta de `eventoPagamentos`/`eventoPedidos` agora avalia o predicado contra o contexto correto do `innerJoin`; deixou de aceitar um predicado de pedido apenas porque o mesmo nome de coluna/valor existe no pagamento.
- Adicionado teste regressivo com IDs/datas coincidentes e valor presente apenas na entidade errada; o teste falha com o fake anterior e passa após a correção.

RED antes da correção:

```text
pnpm --filter @essencia/api test -- --config jest.eventos.config.js --runInBand \
  src/modules/eventos/eventos-pagamentos.service.spec.ts -t "predicado de tabela errada"
```

Falhou no primeiro `expect`: `matches(eq(eventoPedidos.id, ...), payment)` retornava `true` porque o fake ignorava `marker.__table`; a seleção `payment/order` também usava `OR` entre as duas entidades.

GREEN:

- Suíte focada de Eventos/Payments/Public — **5 suítes, 26 testes PASS**.
- `src/modules/shop/shop-regressions.spec.ts` — **126 testes PASS**.
- `pnpm --filter @essencia/api typecheck` e `pnpm --filter @essencia/api lint` — **PASS** (lint com avisos `any` preexistentes).
- `pnpm --filter @essencia/db test -- --test-name-pattern eventos` — **3 testes PASS**.
- `pnpm --filter @essencia/db build` e `pnpm --filter @essencia/shared build` — **PASS**.
- Pipeline global `pnpm turbo lint && pnpm turbo typecheck` — **PASS**, 22 tarefas de lint e 22 de typecheck.

Arquivos desta rodada:

- `services/api/src/modules/eventos/eventos-pagamentos.service.spec.ts`
- `.superpowers/sdd/2026-10-28-eventos-publico-admin/task-4-report.md`
