# Relatório Task 2 — integração da substituição no painel

## Arquivos

- `apps/eventos-admin/app/eventos/[id]/mapa/page.tsx`
- `apps/eventos-admin/features/eventos/map-review.tsx`
- `apps/eventos-admin/features/eventos/map-review.test.ts`
- `apps/eventos-admin/app/eventos/[id]/mapa/page.test.ts`

## RED/GREEN

- RED da rodada: os testes comportamentais de retry e limpeza falharam com o estado anterior, incluindo status que voltava para `EM_REVISAO` após falha e ausência de garantia para o `mapId` confirmado.
- GREEN da rodada: `features/eventos/map-review.test.ts` e `app/eventos/[id]/mapa/page.test.ts` passaram com 12 testes comportamentais.
- `pnpm --filter @essencia/eventos-admin lint`: passou com avisos preexistentes de importação, Browserslist e raiz do workspace.
- `pnpm --filter @essencia/eventos-admin typecheck`: passou.
- `pnpm --filter @essencia/eventos-admin build`: passou; os avisos de lint/Browserslist e raiz do workspace não impediram o build.

## Decisões

- A confirmação chama `POST /mapa-padrao/substituir` uma única vez com o `mapId` confirmado.
- O resultado aplica `inheritedSessionIds`, `inventorySessionIds`, `inventoryCreatedCount` e `previousMapArchive` no painel.
- Falha na substituição mantém `CONFIRMADO`, marca pendência e oferece retry usando o mesmo `mapId`, sem novo upload.
- O carregamento inicial continua usando a sincronização idempotente existente via `PATCH /mapa-padrao`, evitando arquivamento indevido.
- `MapReview` comunica `ARCHIVED` e `MAP_IN_USE` com os IDs das sessões preservadas, mantendo upload e avisos de inventário.
- O `mapId` confirmado fica separado do mapa em revisão; retry concorrente reutiliza esse ID e respostas inválidas da substituição são rejeitadas antes de aplicar estado.
- Confirmação e substituição compartilham guardas de Promise, e o painel desabilita ações enquanto há operação pendente.
- Novo upload limpa pendência, erro, sessões afetadas, inventário e aviso de arquivamento da troca anterior.

## Commit

Base: `feat: integra substituicao segura no painel de mapas`.
Rodada de correção: commit adicional com as correções P1/P2 e testes comportamentais.
