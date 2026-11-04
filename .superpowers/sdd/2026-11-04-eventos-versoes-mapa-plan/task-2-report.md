# Relatório da Tarefa 2 — Trava de venda

## Implementação

- Criados `trava-venda.ts` e `trava-venda.spec.ts` em `services/api/src/modules/eventos/mapas`.
- `classificarTrava` aplica a precedência `VENDA_CONFIRMADA` > `OPERACAO_ATIVA` > `COMPRA_EM_ANDAMENTO` > `LIVRE`.
- Exportados os tipos, mensagens e listas de status definidos no brief.
- `carregarTrava` consulta pedidos do evento, ingressos e check-ins das sessões e operações administrativas ativas; aceita `lockRows` para leitura dos pedidos com bloqueio.
- `exigirMapaLivre` lança `BadRequestException` com código e mensagem de domínio exatos.

## TDD

- RED confirmado em 2026-11-04: a suíte falhou porque `./trava-venda` ainda não existia.
- GREEN confirmado após a implementação: 12 testes passaram.

## Verificações

- `pnpm --filter @essencia/api test -- src/modules/eventos/mapas/trava-venda.spec.ts` — 12 testes passando.
- `pnpm --filter @essencia/api test` — 101 suítes e 1103 testes passando.
- `pnpm turbo lint` — 21 tarefas concluídas; apenas avisos preexistentes.
- `pnpm turbo typecheck` — 22 tarefas concluídas.

## Observações

- Nenhuma migration foi criada.
- O lint reporta avisos já existentes no monorepo, sem erros.
