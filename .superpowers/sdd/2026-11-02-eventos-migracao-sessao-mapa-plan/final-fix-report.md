# Relatório final da rodada de correção

## Correções

- `substituirMapaPadrao` agora consulta assentos e inventário do mapa anterior, une sessões explícitas e herdadas/stale e mantém o mapa anterior em `MAP_IN_USE`.
- O contrato de `EventosService.atualizarMapaPadrao` preserva `previousMapId` e `previousMapArchive`; a página recupera a ação de migração após reload e envia a união completa de sessões.
- A migração bloqueia inventário e dependências em ordem determinística, incluindo `evento_itens_pedido` e `evento_transferencias`, e normaliza falhas de exclusão como `MAP_DELETE_BLOCKED` sem expor a causa do driver.
- A limpeza de storage deduplica chaves, registra falhas em log estruturado e mantém o resultado `DELETED`.
- Foram adicionados cenários TDD para inventário herdado-only, explícito+herdado, reload, FKs adicionais, falha de inventário, log/deduplicação e ausência de `cause`.

## Verificações

| Comando | Resultado |
|---|---|
| `pnpm --filter @essencia/api test -- mapas.service.spec mapas.controller.spec eventos.service.spec` | PASS — 4 suítes, 102 testes |
| `pnpm --filter @essencia/eventos-admin test -- page.test.ts map-review.test.ts` | PASS — 8 arquivos, 40 testes |
| `pnpm turbo lint` | PASS — 21 tarefas; somente avisos preexistentes do repositório |
| `pnpm turbo typecheck` | PASS — 22 tarefas |
| `git diff --check` | PASS |

## Preocupações

- A suíte completa `pnpm turbo test --concurrency=1` não foi executada nesta rodada; a cobertura ficou restrita aos pacotes e cenários solicitados.
- O log estruturado registra a mensagem interna do storage/driver apenas no logger; o payload HTTP mantém somente o código e a mensagem pública estável.

Atualizado em: 2026-11-02
