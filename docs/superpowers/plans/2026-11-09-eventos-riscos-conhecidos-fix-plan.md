# Correção dos riscos conhecidos da venda pública de eventos

## Objetivo

Eliminar os três riscos encontrados na revisão final da venda pública de eventos:

1. tornar determinística a ordem dos locks de pedido, inventário, reserva e pagamento;
2. liberar integralmente todas as reservas de um pedido antigo quando um takeover expira qualquer assento, incluindo inventário `LIBERADO` tratado como livre;
3. rejeitar uma nova chave de finalização quando o pedido já foi finalizado com outra chave.

## Restrições globais

- Código e mensagens do domínio em português brasileiro.
- Cada correção deve começar por um teste que falhe pelo motivo do risco.
- Preservar idempotência da mesma chave e as transições existentes.
- Não alterar fluxos fora do módulo de eventos sem teste que demonstre necessidade.
- Executar os testes do módulo e `pnpm turbo lint && pnpm turbo typecheck` antes da integração.

## Tarefas

### Tarefa 1 — Ordem determinística de locks

Ordenar por identificador estável todos os itens, reservas e inventários antes de adquirir locks nos fluxos de confirmação, falha e expiração. Adicionar testes que verifiquem a ordem observável.

### Tarefa 2 — Takeover multiassento e `LIBERADO`

Ao retomar qualquer assento expirado, identificar o pedido antigo, bloquear e liberar todos os inventários e reservas ativos desse pedido, expirar o pedido e seu pagamento pendente somente depois de liberar o conjunto completo. Adicionar regressão para pedido antigo com dois assentos e para inventário `LIBERADO`.

### Tarefa 3 — Chave de finalização concorrente

Quando `finalizationIdempotencyKey` já existir no pedido, retornar sucesso apenas para a mesma chave; chaves diferentes devem produzir conflito independentemente do status `RESERVADO` ou `AGUARDANDO_PAGAMENTO`. Adicionar regressões para ambos os estados.
