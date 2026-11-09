# Relatório da Tarefa 21 — Meus ingressos

## RED/GREEN

- **RED:** o teste novo foi escrito antes do componente e falhou por ausência de `../ingressos/meus-ingressos`:
  `Failed to resolve import "../ingressos/meus-ingressos"`.
- **GREEN:** após a implementação, o foco passou com **1 arquivo e 6 testes**. A suíte completa do app passou com **18 arquivos e 120 testes**.

## Implementação

- `MeusIngressos` agora oferece duas abas acessíveis para buscar por número/e-mail ou e-mail/celular.
- Um resultado navega para `/pedido/{n}?acesso={acesso}`; vários resultados exibem título, data, número do pedido e link para cada ingresso.
- Erros 404 e 429 exibem as mensagens públicas exigidas; respostas vazias também usam a mensagem genérica de não encontrado.
- A página `/pedido/consulta` lê `?pedido=` e preenche o número inicial.
- O status legado do pedido foi preservado na rota protegida com o nome `pedido-status.tsx`, enquanto `consulta-pedido.tsx` e os dois testes antigos foram removidos.

## Arquivos

### Criados

- `apps/eventos/components/ingressos/meus-ingressos.tsx`
- `apps/eventos/components/__tests__/meus-ingressos.test.tsx`

### Modificados

- `apps/eventos/app/pedido/consulta/page.tsx`
- `apps/eventos/app/pedido/[orderNumber]/page.tsx`
- `apps/eventos/app/publico.test.tsx`

### Renomeado

- `apps/eventos/components/consulta-pedido.tsx` → `apps/eventos/components/pedido-status.tsx`

### Removidos

- `apps/eventos/components/__tests__/consulta-pedido.test.tsx`
- `apps/eventos/components/__tests__/pedido-consulta.test.tsx`

## Comandos e saídas

- `pnpm --filter @essencia/eventos exec vitest run --environment jsdom components/__tests__/meus-ingressos.test.tsx` — **6/6 testes passaram**.
- `pnpm --filter @essencia/eventos test -- --maxWorkers=1` — **18 arquivos, 120 testes passaram**.
- `pnpm --filter @essencia/eventos lint` — **exit 0**, somente avisos preexistentes (incluindo `<img>` em `checkout/resumo-pedido.tsx`).
- `pnpm --filter @essencia/eventos typecheck` — **exit 0**.
- `pnpm turbo lint && pnpm turbo typecheck` — **21/21 tarefas de lint** e **22/22 tarefas de typecheck** concluídas; apenas warnings históricos do monorepo.
- `git diff --check` — **exit 0**.

## Self-review

- Os campos têm labels associados, foco visível via classes do botão compartilhado, abas com `role="tab"` e `aria-selected`, mensagens com `role="alert"` e resultados anunciados por `aria-live`.
- O token de acesso e o número do pedido são codificados nos links públicos.
- O número inicial é controlado pelo componente e pode ser recebido diretamente da query da página.
- A consulta não exibe mensagens retornadas pela API em 404/429, evitando vazamento de detalhes internos.
- Nenhum deploy foi executado.

## Preocupações

- O endpoint retorna datas como `Date` no contrato compartilhado, mas o formatador aceita também strings serializadas no navegador.
- O lint global continua exibindo avisos históricos do monorepo e o aviso de lockfile adicional do worktree.

Atualizado em: 2026-11-09
