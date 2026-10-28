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

## Round 1

Corrigido o uso do `basePath` nas chamadas públicas, incluído `schoolId`, controles de sessões múltiplas, ingressos e cinco políticas, revisão de mapa com upload privado e resolução de conflitos, e ações de inventário com motivo obrigatório e tratamento de rejeição. Testes: 7 passaram; typecheck passou; build concluído com avisos de lockfiles/import order.

## Round 2

Proxy preserva prefixo `/api`, uploads multipart encaminham bytes, tenant define `schoolId` sem permitir override do formulário, e páginas de mapa/inventário usam rotas públicas com estados de erro. Testes e typecheck passaram.

## Round 3

Mapa agora inicia por upload e propaga `mapId/importId` às rotas de revisão, detecção e confirmação. Inventário apenas consulta o endpoint GET disponível e mantém ações sem mutação otimista enquanto operações aguardam Task 7. Testes e typecheck passaram.
