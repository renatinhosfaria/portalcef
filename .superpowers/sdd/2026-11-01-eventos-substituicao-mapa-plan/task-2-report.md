# Relatório Task 2 — integração da substituição no painel

## Arquivos

- `apps/eventos-admin/app/eventos/[id]/mapa/page.tsx`
- `apps/eventos-admin/features/eventos/map-review.tsx`
- `apps/eventos-admin/features/eventos/map-review.test.ts`
- `apps/eventos-admin/app/eventos/[id]/mapa/page.test.ts`

## RED/GREEN

- RED: os testes de painel falharam porque a asserção esperava o payload explícito da nova rota, enquanto a implementação ainda não expunha esse contrato no texto verificado.
- GREEN: testes do fluxo de revisão e da página passaram: 2 arquivos, 14 testes.
- `pnpm --filter @essencia/eventos-admin typecheck`: passou.
- `pnpm --filter @essencia/eventos-admin build`: passou; apenas avisos preexistentes de lint/Browserslist e raiz de workspace foram emitidos.

## Decisões

- A confirmação chama `POST /mapa-padrao/substituir` uma única vez com o `mapId` confirmado.
- O resultado aplica `inheritedSessionIds`, `inventorySessionIds`, `inventoryCreatedCount` e `previousMapArchive` no painel.
- Falha na substituição mantém `CONFIRMADO`, marca pendência e oferece retry usando o mesmo `mapId`, sem novo upload.
- O carregamento inicial continua usando a sincronização idempotente existente via `PATCH /mapa-padrao`, evitando arquivamento indevido.
- `MapReview` comunica `ARCHIVED` e `MAP_IN_USE` com os IDs das sessões preservadas, mantendo upload e avisos de inventário.

## Commit

`feat: integra substituicao segura no painel de mapas`.
