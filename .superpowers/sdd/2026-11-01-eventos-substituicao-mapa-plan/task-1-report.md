# Relatório final da Task 1 — substituição segura do mapa

## Estado entregue

A operação `substituirMapaPadrao` permanece como o fluxo transacional único: valida evento/ator e mapa confirmado do mesmo evento, bloqueia somente `DISPONIVEL`/`LIBERADO` das sessões herdadas, sincroniza o inventário novo, preserva sessões com `mapId` explícito, arquiva o mapa anterior somente quando não há referência e registra auditoria. A limpeza de preview ocorre depois do commit e falhas do storage não desfazem a troca.

`arquivar` passou a ler evento, referências de sessão e mapa dentro da mesma transação, com `FOR UPDATE` no evento, nas sessões e no mapa. Assim, arquivamento e substituição compartilham o lock do evento e não podem cruzar uma referência de sessão criada pelos caminhos administrativos serializados.

## Arquivos cumulativos da Task 1

- `services/api/src/modules/eventos/mapas/mapas.service.ts`
- `services/api/src/modules/eventos/mapas/mapas.controller.ts`
- `services/api/src/modules/eventos/mapas/mapas.service.spec.ts`
- `services/api/src/modules/eventos/mapas/mapas.controller.spec.ts`
- `services/api/src/modules/eventos/eventos.service.ts`
- `services/api/src/modules/eventos/eventos.service.spec.ts`

O painel não foi alterado nesta task.

## Rodada TDD 2/5

### RED

- O teste `serializa arquivamento pelo lock do evento e das sessões` foi executado antes da correção de `arquivar`:
  `pnpm --filter @essencia/api test -- --runInBand src/modules/eventos/mapas/mapas.service.spec.ts -t 'serializa arquivamento'`.
- Falha observada: o fake registrou 2 locks (`evento` e `mapa`), mas o contrato exigia 3 incluindo `eventoSessoes`.

Os cenários de rollback, sessões explícitas, estados de inventário e preview foram escritos contra um fake inicialmente sequencial; a implementação do fake foi então fortalecida para executar as mutações reais e restaurar o snapshot em erro. O teste de auditoria falha depois do bloqueio, da sincronização e do arquivamento, garantindo que a verificação não depende de `update` não ter sido chamado.

### GREEN

- `mapas.service.spec.ts`: **26/26** passando.
- `mapas.controller.spec.ts` + `eventos.service.spec.ts`: **37/37** passando.
- `pnpm --filter @essencia/api typecheck`: sem erros.
- `pnpm turbo typecheck`: **22/22** tarefas passando.
- `pnpm turbo lint`: **21/21** tarefas passando; somente avisos preexistentes, sem erros.
- `git diff --check`: sem problemas.

A suíte de mapas agora verifica explicitamente:

- sessão explícita apontando para o mapa novo sem sincronização ou mutação;
- estados `RESERVADO`, `VENDIDO` e histórico preservados;
- rollback de evento, mapa, inventário e auditoria em falha posterior;
- auditoria persistida antes da limpeza e preview removido apenas após commit;
- falha de limpeza do storage sem rollback;
- lock transacional compartilhado por evento, sessões e mapa em `arquivar`.

## Commits

- `11d14fb feat: adiciona substituicao segura do mapa de eventos`
- `b4124b2 test: cobre substituicao segura do mapa`
- `7b80a90 fix: torna substituicao de mapa fluxo unico`
- commit adicional desta rodada: `test: fecha evidencias da substituicao transacional` (hash informado após o commit).

## Preocupações

- O lint global mantém avisos já existentes no monorepo (`no-explicit-any`, `import/order` e avisos do Next); não há erro novo introduzido pela task.
- A remoção do preview é uma limpeza eventual: se o storage falhar, o registro do mapa continua arquivado e a operação já confirmada.
