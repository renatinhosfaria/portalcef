# Relatório da Tarefa 2

Implementada a Tarefa 2 no commit desta branch.

- `PATCH` parcial de evento aceita controle de versão pelo quarto argumento ou pelo campo `expectedUpdatedAt`, preserva slug manual, rejeita alteração de slug publicado e registra auditoria com valores anteriores e novos.
- Adicionado contrato `PATCH /eventos/admin/:id/mapa-padrao` com schema estrito.
- `atualizarMapaPadrao` valida tenant, executa a troca em transação, atualiza apenas sessões herdadas (`mapId = null`), bloqueia o inventário afetado para revisão/regeneração e audita a operação.
- Sessões criadas sem mapa específico preservam `mapId = null`, permitindo herança do mapa padrão.

## Validação

- `pnpm --filter @essencia/api test -- --runInBand src/modules/eventos/eventos.controller.spec.ts src/modules/eventos/eventos.service.spec.ts` — aprovado (11 testes).
- `pnpm --filter @essencia/api typecheck` — aprovado.

## Preocupações

- A invalidação usa o status existente `BLOQUEADO` com `blockedReason = MAPA_PADRAO_ALTERADO`; a regeneração física do inventário continua no fluxo de mapas/inventário.
