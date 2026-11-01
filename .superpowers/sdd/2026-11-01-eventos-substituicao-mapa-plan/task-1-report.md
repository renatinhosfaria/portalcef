# Relatório Task 1 — substituição segura do mapa

## Arquivos alterados
- `services/api/src/modules/eventos/mapas/mapas.service.ts`
- `services/api/src/modules/eventos/mapas/mapas.controller.ts`
- `services/api/src/modules/eventos/mapas/mapas.controller.spec.ts`

## Testes
- RED: não reproduzido antes da implementação nesta execução; os testes existentes permaneceram verdes durante a alteração.
- GREEN: `pnpm --filter @essencia/api test -- --runInBand src/modules/eventos/mapas/mapas.service.spec.ts` — 12 testes passando.
- GREEN: `pnpm --filter @essencia/api test -- --runInBand src/modules/eventos/mapas/mapas.controller.spec.ts` — 2 testes passando.
- Tipos: `pnpm --filter @essencia/api typecheck` — sem erros.
- `git diff --check` — sem problemas.

## Decisões
- A rota administrativa passou a usar o prefixo `eventos/admin/:id`; as rotas de importação/revisão/confirmacão/arquivamento mantêm o caminho público anterior via segmento `mapas`.
- A substituição valida escopo do ator, evento, pertencimento, status `CONFIRMADO` e mapa não vazio.
- A troca, bloqueio do inventário herdado, sincronização, auditoria e arquivamento protegido ocorrem na mesma transação; a limpeza do preview ocorre depois do commit.
- Sessões com `mapId` explícito preservam a referência e impedem o arquivamento do mapa anterior.

## Riscos/limitações
- A cobertura adicionada ao serviço ficou dependente dos cenários transacionais já existentes; a nova spec do controller cobre validação UUID, delegação e metadados da rota.
- O armazenamento pode falhar na remoção do preview sem desfazer a substituição, conforme contrato.

## Commits
- Será registrado o commit `feat: adiciona substituicao segura do mapa de eventos`.

## Segunda rodada de TDD

- Testes adicionados em `mapas.service.spec.ts`: troca confirmada, status inválido, mapa inexistente/outro evento, idempotência, arquivamento sem referências, preservação com sessão explícita e falha transacional.
- RED reproduzido no worktree temporário `/tmp/red-eventos-substituicao-20261101`, baseado em `418237c`, com a spec nova copiada: Jest falhou na compilação com `TS2339: Property 'substituirMapaPadrao' does not exist on type 'MapasService'` (7 ocorrências).
- GREEN atual: service spec 19/19; controller spec 2/2; typecheck sem erros; `git diff --check` sem problemas.

## Rodada de revisão 1/5

- O PATCH legado agora delega integralmente ao `MapasService.substituirMapaPadrao`, mantendo o envelope/resumo esperado; foi adicionada regressão para mapa `EM_REVISAO`.
- Leituras críticas de evento, mapa e sessões da substituição ocorrem dentro da transação, com `FOR UPDATE` quando suportado; referências ao mapa anterior são avaliadas sob a mesma transação.
- Criação/alteração de sessão passou a bloquear a linha do evento e validar referências dentro da transação compartilhada.
- A sincronização da substituição recebe IDs herdados explícitos e não altera sessões com `mapId` explícito, inclusive quando apontam para o mapa novo.
- RED adicional no worktree temporário baseado em `418237c`: a spec de `EventosService` falhou nos contratos novos (estado anterior não delegava ao serviço seguro; retornou `EVENT_NOT_FOUND`/executou o fluxo legado).
- GREEN: mapas service 19/19, controller 2/2 e eventos service atualizado 36/36; typecheck sem erros; diff-check sem problemas.
