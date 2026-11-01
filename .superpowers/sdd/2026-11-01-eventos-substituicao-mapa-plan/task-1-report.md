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
