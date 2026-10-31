# CTA e opções de ingresso na página pública — Implementation Plan

> **Para agentes de implementação:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa por tarefa. Os passos usam caixas de seleção (`- [ ]`) para acompanhamento.

**Goal:** Tornar a compra visível e acionável na página pública de detalhe do evento, com CTA no hero, cards de ingresso e ação fixa no mobile.

**Architecture:** Manter as rotas e contratos atuais. O detalhe continuará sendo Server Component; a âncora de compra e os cards serão renderizados com links existentes para a sessão, e o CTA móvel usará apenas CSS sticky/fixed sem alterar reserva ou checkout.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Vitest, Testing Library e `next/image`.

**Spec:** `docs/superpowers/specs/2026-10-31-eventos-publico-reformulacao-design.md`

## Global Constraints

- Alterar somente a aplicação pública em `apps/eventos` e seus testes/configurações diretamente necessários.
- Manter backend, `apps/eventos-admin`, banco, Stripe, contratos HTTP, idempotência e regras comerciais atuais.
- Toda interface e mensagem nova deve estar em Português do Brasil.
- Preservar os `ticketTypeId` atuais nos links de sessão.
- O frontend não pode inventar disponibilidade, preço, elegibilidade ou status comercial.
- Antes de cada commit, executar `pnpm --filter @essencia/eventos lint` e `pnpm --filter @essencia/eventos typecheck`.

## Review Focus

- Evento sem sessões: não renderizar CTA de compra enganoso; cobrir no teste de detalhe.
- Sessão não vendável/esgotada: não renderizar card ou CTA que leve a uma compra impossível; preservar as mensagens atuais.
- Mais de um tipo de ingresso: cada card deve manter seu próprio `ticketTypeId` e preço; cobrir os links.
- Layout mobile: CTA fixo não pode cobrir conteúdo nem criar overflow horizontal; cobrir classes e smoke visual.
- Acessibilidade: CTA e cards devem ter nomes acionáveis e foco visível; cobrir texto/HTML renderizado.

### Task 1: Cards de ingresso com ação explícita

**Files:**
- Modify: `apps/eventos/components/sessoes-evento.tsx`
- Modify: `apps/eventos/components/__tests__/detalhe-evento-ingresso.test.tsx`

**Interfaces:**
- Mantém `SessoesEvento({ eventSlug, sessions })` e os URLs existentes.
- Cada tipo de ingresso vendável será apresentado como card com nome, preço, elegibilidade/descrição e link `Escolher assentos`.

- [ ] **Step 1: Escrever testes falhando**

  Adicionar casos que exijam cards identificáveis por tipo, preço visível, texto `Escolher assentos` e preservação de cada `ticketTypeId`; garantir que sessão esgotada ou não vendável não tenha o CTA.

- [ ] **Step 2: Rodar os testes para confirmar a falha**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/detalhe-evento-ingresso.test.tsx`

  Expected: FAIL nos novos contratos de card e ação.

- [ ] **Step 3: Implementar os cards**

  Substituir os links sublinhados por uma grade responsiva de cards dentro da sessão. Usar `formatarPrecoPublico` sem o prefixo “A partir de”, manter os dados de elegibilidade e apontar cada ação para o mesmo URL já existente.

- [ ] **Step 4: Rodar os testes da tarefa**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/detalhe-evento-ingresso.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Commitar a tarefa**

  ```bash
  git add apps/eventos/components/sessoes-evento.tsx apps/eventos/components/__tests__/detalhe-evento-ingresso.test.tsx
  git commit -m "feat: destaca opções de ingresso na vitrine pública"
  ```

### Task 2: CTA de compra no hero e CTA fixo no mobile

**Files:**
- Modify: `apps/eventos/components/detalhe-evento.tsx`
- Modify: `apps/eventos/components/__tests__/detalhe-evento-ingresso.test.tsx`
- Modify: `apps/eventos/app/globals.css` (somente se necessário para safe-area ou utilitário global)

**Interfaces:**
- `DetalheEvento` continua recebendo apenas `event` e `sessions`.
- O CTA do hero aponta para a primeira sessão vendável e usa uma âncora local para a seção de sessões.
- O CTA móvel usa `position: sticky` ou `fixed` apenas em telas pequenas, com espaço inferior para não ocultar o rodapé/conteúdo.

- [ ] **Step 1: Escrever testes falhando**

  Adicionar casos para: CTA `Comprar ingressos` no hero quando existir sessão vendável; ausência do CTA quando nenhuma sessão for vendável; âncora `#sessoes`; CTA móvel com texto `Comprar ingressos` e classes/atributos que indiquem comportamento responsivo.

- [ ] **Step 2: Rodar os testes para confirmar a falha**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/detalhe-evento-ingresso.test.tsx`

  Expected: FAIL porque o detalhe ainda não possui esses CTAs.

- [ ] **Step 3: Implementar CTA do hero e CTA móvel**

  Calcular a primeira sessão vendável no componente, adicionar botão/link destacado no bloco inicial e marcar a seção de sessões com `id="sessoes"`. Renderizar uma barra inferior somente em `md:hidden`, usando o mesmo destino da primeira sessão e padding inferior suficiente no conteúdo.

- [ ] **Step 4: Rodar testes, lint e typecheck**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/detalhe-evento-ingresso.test.tsx`

  Run: `pnpm --filter @essencia/eventos lint && pnpm --filter @essencia/eventos typecheck`

  Expected: PASS sem warnings novos.

- [ ] **Step 5: Commitar a tarefa**

  ```bash
  git add apps/eventos/components/detalhe-evento.tsx apps/eventos/components/__tests__/detalhe-evento-ingresso.test.tsx apps/eventos/app/globals.css
  git commit -m "feat: adiciona CTAs de compra ao detalhe do evento"
  ```

### Verificação final

- [ ] Rodar `pnpm --filter @essencia/eventos test`.
- [ ] Rodar `pnpm --filter @essencia/eventos lint && pnpm --filter @essencia/eventos typecheck`.
- [ ] Rodar `pnpm --filter @essencia/eventos build`.
- [ ] Abrir a página em Chromium em 1440 px e 390 px, confirmar CTA, cards, ausência de overflow e navegação para a sessão.
- [ ] Rodar `git diff --check` e registrar o resultado no relatório final.
