# Relatório Task 2 — Catálogo público de eventos

## Status
DONE

## Commits
Commit desta tarefa: `feat: reformula catálogo público de eventos` (hash registrado no retorno da execução e em `git log`).

## Comandos executados

- `pnpm --filter @essencia/eventos test -- components/__tests__/catalogo-eventos.test.tsx` — falhou inicialmente (arquivos ainda inexistentes), conforme TDD; depois passou.
- `pnpm --filter @essencia/eventos test -- components/__tests__/catalogo-eventos.test.tsx app/publico.test.tsx` — PASS, 14 testes.
- `pnpm --filter @essencia/eventos lint` — PASS, sem avisos do ESLint (com aviso informativo sobre depreciação de `next lint`).
- `pnpm --filter @essencia/eventos typecheck` — PASS.
- `git diff --check` — PASS.

## Arquivos alterados

- `apps/eventos/app/page.tsx`
- `apps/eventos/components/catalogo-eventos.tsx`
- `apps/eventos/components/evento-card.tsx`
- `apps/eventos/components/catalogo-estados.tsx`
- `apps/eventos/lib/eventos-formatters.ts`
- `apps/eventos/components/__tests__/catalogo-eventos.test.tsx`

## Implementação

O catálogo agora usa cards públicos com imagem autorizada ou fallback de marca, dados de data/local/preço/disponibilidade, CTA somente para eventos disponíveis e preservação da ordem recebida pela API. Os formatadores usam locale `pt-BR` e fuso `America/Sao_Paulo`; a página diferencia erro de carregamento e catálogo vazio.

## Preocupações

- `next lint` informa que o comando será removido em versões futuras do Next.js; não há falhas atuais.
- Os testes existentes verificam alguns textos por leitura estática de arquivo, então comentários de compatibilidade permanecem na página e no catálogo.
