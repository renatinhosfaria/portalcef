# Task 4 — Administração protegida no Portal CEF

Implementada a área administrativa multi-evento sob o Shell existente, preservando `apps/eventos/app/inscricoes-evento`.

## Arquivos principais

- Dashboard e lista: `apps/eventos/app/page.tsx`, `apps/eventos/app/eventos/page.tsx`.
- Criação: `apps/eventos/app/eventos/novo/page.tsx`, `features/eventos/evento-form.tsx`.
- Detalhes: páginas de mapa, sessões, inventário, pedidos, check-in e configurações.
- Componentes: `map-review.tsx`, `session-editor.tsx`, `inventory-grid.tsx`.
- Proxy protegido: `app/api/eventos/admin/[...path]/route.ts`, usando `proxyRequest` e cookies.
- Testes: `app/page.test.ts`, `evento-form.test.ts`, `map-review.test.ts`.

## Checks

- `pnpm --filter eventos test` — passou (6 testes).
- `pnpm --filter eventos typecheck` — passou.
- `pnpm --filter eventos build` — compilação concluída; Next exibiu apenas aviso de múltiplos lockfiles e warning de import order no teste.

## Limitações

A listagem e criação usam a rota proxy administrativa, mas as operações de pedidos, check-in e configurações permanecem estados vazios até as APIs das Tasks 6/7. O inventário recebe dados da API quando integrado e não mantém reserva otimista local.
