# Runbook de incidente de estorno

Use este procedimento quando um pedido pago permanecer com estorno `PENDENTE`,
`PROCESSANDO` ou `ERRO`, ou quando o operador receber falha ao cancelar.

## Regras de segurança

- Não marque o pedido como `CANCELADO` manualmente.
- Não devolva estoque manualmente antes da confirmação do Stripe.
- Não crie outro refund no painel do Stripe sem antes localizar a chave de
  idempotência `shop-order-refund:<id-do-pedido>`.
- Não copie payloads, tokens, cookies ou dados completos do cliente para logs.

## Diagnóstico

1. Registre número e ID do pedido, horário e correlation ID da resposta.
2. Confirme no admin que o pedido continua `PAGO` quando o estorno não estiver
   concluído.
3. Consulte os logs da API pelo correlation ID e procure o evento Stripe sem
   expor o segredo do webhook.
4. Confirme no Stripe se existe refund com a chave idempotente do pedido.
5. Verifique se o webhook `charge.refunded` foi entregue e recebeu HTTP 2xx.

## Recuperação

Se o Stripe não confirmou o estorno, use uma única vez a ação administrativa
que chama `POST /api/shop/admin/orders/:id/refund-retry`. A operação usa a mesma
chave idempotente e pode ser repetida com segurança após timeout.

Se o Stripe já confirmou, reenvie o webhook `charge.refunded`. O reconciliador
deve concluir o registro de estorno, cancelar o pedido e recompor o estoque em
uma única transação, sem duplicar movimentos.

## Validação e encerramento

- Estorno local em `CONCLUIDO`, com o identificador Stripe registrado.
- Pedido em `CANCELADO` somente após a confirmação.
- Estoque recomposto uma única vez e ledger sem movimento duplicado.
- Retry posterior não cria outro refund nem altera o estoque.
- Correlation ID e horário registrados no incidente, sem dados sensíveis.

Se qualquer item divergir, interrompa novas tentativas e escale para análise do
banco e dos eventos Stripe antes de alterar estado manualmente.
