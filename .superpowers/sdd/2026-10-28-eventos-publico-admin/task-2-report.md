# Relatório da Task 2 — Vitrine pública de Eventos

## Implementação

- Criado o app Next `@essencia/eventos`, na porta 3014, sem `basePath`, `TenantProvider`, `Shell` ou autenticação obrigatória.
- Criado layout público em pt-BR com catálogo, detalhe de evento, sessões, seleção de assentos, checkout esqueleto e consulta de pedido.
- Criada camada HTTP pública com `API_INTERNAL_URL` no servidor e `/api` no navegador, `cache: "no-store"`, `credentials: "omit"` e propagação de erros HTTP.
- Tipos públicos reutilizados de `@essencia/shared`; nenhum acesso direto a banco, Redis ou MinIO.
- Mapa desabilita assentos `reserved`, `sold` e `blocked`; somente IDs selecionados são enviados ao checkout.
- Assets públicos copiados para `apps/eventos/public`.

## TDD

Os testes foram escritos antes da implementação e a primeira execução falhou porque o pacote ainda não existia. Após a implementação, a suíte passou com 5 testes.

## Validação

- `pnpm --filter @essencia/eventos test` — PASS (5 testes).
- `pnpm --filter @essencia/eventos typecheck` — PASS.
- `pnpm --filter @essencia/eventos lint` — PASS com aviso do Next sobre `<img>` e depreciação de `next lint`.
- `pnpm --filter @essencia/eventos build` — PASS; rotas públicas geradas corretamente.

## Observações

O checkout permanece deliberadamente sem operações de reserva/pagamento, conforme o escopo da Task 2; essas escritas ficam para a Task 5. A página inicial exibe estado vazio quando a API pública está indisponível para manter a vitrine navegável sem login.

Atualizado em: 2026-10-28

## Relatório de correção — revisão P1/P2

- O mapa agora diferencia visualmente `available`, `reserved`, `sold` e `blocked` por classes específicas, inclui legenda visível e mantém botões indisponíveis desabilitados.
- A página de catálogo separa falha HTTP (`role="alert"`) da lista vazia; erros da API não são mais apresentados como ausência de eventos.
- O logotipo do layout foi migrado de `<img>` para `next/image`, removendo o warning de lint.

### Testes e comandos

- Teste RED antes da correção: 2 testes falharam (helper inexistente e ausência da mensagem de erro).
- `pnpm --filter @essencia/eventos test` — PASS (7 testes).
- `pnpm --filter @essencia/eventos lint` — PASS, sem warnings ESLint do app.
- `pnpm --filter @essencia/eventos typecheck` — PASS.
- `pnpm --filter @essencia/eventos build` — PASS.

Atualizado em: 2026-10-28
