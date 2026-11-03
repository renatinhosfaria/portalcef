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

## Rodada de correção whole-branch (2026-11-02)

### Arquivos alterados

- `services/api/src/modules/eventos/mapas/mapas.service.ts`: após identificar as sessões impactadas, recarrega e bloqueia todo o inventário dessas sessões em ordem por ID; reservas, itens de pedido e transferências usam o inventário completo.
- `services/api/src/modules/eventos/mapas/mapas.service.spec.ts`: regressão com inventário antigo e alvo na mesma sessão, dependência somente no alvo e verificação de `SESSION_HAS_DEPENDENCIES` sem mutação.
- `apps/eventos-admin/app/eventos/[id]/mapa/page.tsx`: alerta de migração preserva o código estável com fallback e a lista de sessões afetadas é limpa após sucesso.
- `apps/eventos-admin/app/eventos/[id]/mapa/page.test.ts`: verifica o código no bloqueio e a ausência do aviso residual após migração bem-sucedida.

### Testes e resultados

| Comando | Resultado |
|---|---|
| `pnpm --filter @essencia/api test -- src/modules/eventos/mapas/mapas.service.spec.ts --runInBand` | PASS — 53 testes |
| `pnpm --filter @essencia/eventos-admin test -- app/eventos/[id]/mapa/page.test.ts` | PASS — 12 testes |
| `pnpm turbo lint` | PASS — 21 tarefas; avisos preexistentes |
| `pnpm turbo typecheck` | PASS — 22 tarefas |
| `git diff --check` | PASS |

### Preocupações

- Nenhuma migration, checkout público ou regra de venda foi alterada.
- O lint mantém avisos preexistentes do monorepo, sem erros.

Atualizado em: 2026-11-02
