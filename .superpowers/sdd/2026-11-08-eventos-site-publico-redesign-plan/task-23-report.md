# Relatório da Tarefa 23 — CSP, smoke e verificação final

## RED/GREEN

- **RED:** adicionado o teste `CSP do eventos libera o checkout embutido da Stripe` em `apps/eventos/app/publico.test.tsx`. A execução direcionada falhou como esperado: **1 teste falhou, 12 ignorados**, porque o bloco HTTPS de `eventos.portalcef.com.br` ainda não tinha `https://js.stripe.com` em `script-src`/`frame-src`.
- **GREEN:** a CSP Report-Only do bloco HTTPS de Eventos passou a liberar Stripe em `script-src`, `frame-src`, `connect-src` e `img-src`; o teste direcionado passou (**1/1**).
- O smoke foi refeito com mock HTTP próprio, interceptação das rotas públicas no navegador, layout do mapa com `PALCO`, fileira `A` e rótulo órfão `X`, reserva sem comprador, finalização com `acesso`, checkout com `clientSecret`, dois ingressos, QR SVG, consulta de “Meus ingressos”, viewports 390×844 e 1440×900, além das verificações de console, rede, overflow e margem do conteúdo.
- Durante o smoke foi encontrada uma falha real de compilação cliente: `@essencia/shared/eventos/ingresso` importava `node:crypto` e quebrava a rota de ingressos. O import foi substituído por Web Crypto compatível com cliente/servidor, mantendo a API de geração e formatação.

## Verificação completa

- `pnpm turbo lint && pnpm turbo typecheck` — **PASS**, 22/22 tarefas em cada etapa. Permanecem warnings preexistentes de ESLint/Next.
- `pnpm turbo test --concurrency=1` — **PASS**, 21/21 tarefas.
  - `@essencia/db`: 9 testes
  - `@essencia/shared`: 47 testes
  - `@essencia/api`: 106 suítes, 1.190 testes
  - `@essencia/lib`: 4 testes
  - `escolas`: 11 testes
  - `login`: 8 testes
  - `@essencia/components`: 32 testes
  - `workflows`: 52 testes
  - `@essencia/calendario`: 35 testes
  - `@essencia/loja`: 103 testes
  - `home`: 8 testes
  - `usuarios`: 1 teste
  - `planejamento`: 219 testes
  - `suporte`: 8 testes
  - `tarefas`: 5 testes
  - `@essencia/loja-admin`: 103 testes
  - `@essencia/eventos`: 142 testes em 21 arquivos
  - `@essencia/eventos-admin`: 181 testes
  - `@essencia/turmas`: 5 testes
  - Total contabilizado: **2.163 testes** (mais 106 suítes Jest da API).
- `pnpm --filter @essencia/eventos build` — **PASS**. Build compilado, páginas estáticas/dinâmicas geradas; warning existente de `<img>` em `components/checkout/resumo-pedido.tsx`.
- `node apps/eventos/scripts/smoke-publico.mjs` — **PASS**:
  - `mobile: PASS (viewport 390x844)`
  - `desktop: PASS (viewport 1440x900)`
- `git diff --check` — **PASS**.

## Self-review

- A CSP continua explicitamente `Content-Security-Policy-Report-Only`; não altera a política bloqueante dos demais hosts.
- O smoke cobre as rotas novas e não depende de API, Stripe ou storage externos; a arte remota é interceptada no navegador para manter o teste determinístico.
- O alias CSS removido foi `--brand-orange`, único alias sem referências no app. Os demais aliases continuam em uso por componentes legados e foram preservados.
- A alteração em `packages/shared/src/eventos/ingresso.ts` é necessária para o bundle cliente da página de ingressos; a implementação usa Web Crypto quando disponível e fallback de `Math.random` apenas em runtimes sem Web Crypto.
- Não houve deploy nem push.

## Round 1 — correções da revisão

- O diagnóstico de overflow horizontal, margem mínima de 16 px e console/rede agora é executado também imediatamente depois da navegação para `/checkout` causada pelo botão `Continuar`, antes de validar o relógio e o formulário.
- O mapa passou a usar `expect(...).toBeVisible()` para `PALCO` e a letra `A`, e `expect(...).toHaveCount(0)` para garantir que o rótulo órfão `X` não existe no DOM renderizado.
- Verificações após a revisão:
  - `node apps/eventos/scripts/smoke-publico.mjs` — **PASS** em 390×844 e 1440×900.
  - `pnpm --filter @essencia/eventos test` — **PASS**, 21 arquivos/142 testes.
  - `pnpm --filter @essencia/eventos lint` — **PASS** com o warning preexistente de `<img>` em `components/checkout/resumo-pedido.tsx`.
  - `pnpm --filter @essencia/eventos typecheck` — **PASS**.
