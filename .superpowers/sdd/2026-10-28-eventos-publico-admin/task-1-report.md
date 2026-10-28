# Relatório da Task 1 — painel administrativo de Eventos

## Implementação

- A árvore `apps/eventos` foi movida para `apps/eventos-admin`.
- O pacote passou a se chamar `@essencia/eventos-admin`.
- O `basePath` passou a ser `/eventos-admin` e os scripts `dev`/`start` usam a porta `3016`.
- O layout mantém `TenantProvider` e `Shell`, com metadados de painel administrativo.
- Chamadas administrativas usam `/eventos-admin/api/eventos/admin/...`.
- Rotas internas usam `/eventos-admin/eventos/...`; o fluxo legado permanece em `/eventos-admin/inscricoes-evento`.
- As chamadas legadas da inscrição (`/api/eventos/:slug/...`) foram preservadas.
- O módulo do Shell aponta para `/eventos-admin` e detecta a porta 3016.
- O teste de regressão do `loja-admin` aponta para `apps/eventos-admin` e verifica a ausência de `apps/eventos`.
- O importer do `pnpm-lock.yaml` foi atualizado para `apps/eventos-admin`.

## TDD

Os testes de fronteira foram escritos antes da implementação e executados em RED. A execução mostrou falhas esperadas para pacote/basePath/URLs antigas. Após a implementação, a suíte passou em GREEN.

## Verificações executadas

- `pnpm --filter @essencia/eventos-admin test` — 6 arquivos, 12 testes aprovados.
- `pnpm --filter loja-admin exec vitest run __tests__/modulo-eventos.test.ts` — 8 testes aprovados.
- `pnpm --filter @essencia/eventos-admin typecheck` — aprovado.
- `pnpm --filter @essencia/eventos-admin lint` — concluído sem erros; há avisos de import order, variável não usada preexistente e lockfiles múltiplos no worktree.
- `git diff --check` — aprovado.

## Preocupações

- `next lint` informa que está depreciado no Next.js 16 e avisa sobre o lockfile do worktree; não há erro bloqueante.
- Configurações de Docker/deploy ainda referenciam o serviço legado `eventos`; elas pertencem às tarefas posteriores de vitrine pública e infraestrutura do plano.

Atualizado em: 2026-10-28
