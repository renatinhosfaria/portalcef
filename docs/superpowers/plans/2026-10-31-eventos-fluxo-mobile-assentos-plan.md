# Fluxo mobile de compra e seleção de assentos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma seleção de assentos legível no mobile, um resumo fixo com total e checkout e um CTA mobile que preserve o contexto do evento.

**Architecture:** A página de evento continuará apontando para a seção de sessões. A tela de sessão manterá a planta proporcional como visão desktop e adicionará uma visão mobile agrupada por fileira, compartilhando o mesmo estado de seleção. O resumo detalhado e o resumo fixo usarão o mesmo cálculo de tipos e total, mantendo a serialização atual para o checkout.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-31-eventos-fluxo-mobile-assentos-design.md`

## Global Constraints

- Comunicação, código de domínio, commits, documentação e comentários em Português do Brasil.
- Apps não acessam banco diretamente; nenhuma chamada de backend será alterada.
- O contrato de checkout (`assentos`, `ticketTypeIds` e `sessionId`) permanece compatível.
- Estados `reserved`, `sold` e `blocked` continuam sem ação de seleção.
- O mapa e o resumo devem manter labels acessíveis e suporte a teclado.
- A validação obrigatória antes do commit é `pnpm turbo lint && pnpm turbo typecheck`.

## Review Focus

- CTA mobile que mantém o usuário na página do evento e rola para `#sessoes` — teste de renderização em `detalhe-evento-ingresso.test.tsx`.
- Sessão aberta sem `ticketTypeId` que apresenta cards acionáveis e mantém preço/eligibilidade — teste de `EscolhaTipoIngresso`.
- Mobile com centenas de assentos, fileiras vazias e estados indisponíveis — testes de seleção e filtro em `mapa-assentos.test.tsx`.
- Assento selecionado sem tipo definido e troca de tipo no resumo — testes de serialização, total e estado desabilitado.
- Barra fixa que não encobre o conteúdo e mantém o link de checkout alinhado com os assentos selecionados — teste de markup e smoke Chromium em 390px.

---

### Task 1: CTA mobile e escolha de tipo de ingresso

**Files:**
- Modify: `apps/eventos/components/detalhe-evento.tsx`
- Create: `apps/eventos/components/escolha-tipo-ingresso.tsx`
- Modify: `apps/eventos/app/evento/[slug]/sessao/[sessionId]/page.tsx`
- Modify: `apps/eventos/components/__tests__/detalhe-evento-ingresso.test.tsx`
- Create: `apps/eventos/components/__tests__/escolha-tipo-ingresso.test.tsx`

**Interfaces:**
- `EscolhaTipoIngresso({ eventSlug, sessionId, ticketTypes })` renderiza cards com nome, preço, descrição, elegibilidade e link com `ticketTypeId`.
- `DetalheEvento` mantém o CTA desktop e o CTA mobile com `href="#sessoes"`; `data-destino-compra` continua registrando a primeira sessão vendável.

- [ ] **Step 1: Escrever os testes que falham**

  - Atualizar o teste do CTA para exigir dois links visíveis no markup, ambos apontando para `#sessoes`, e manter o destino de compra somente como metadado do hero.
  - Criar teste que renderiza `EscolhaTipoIngresso` com tipos inteira e meia e exige dois cards, preços formatados, elegibilidade e links com os respectivos IDs.
  - Criar caso de tipo sem descrição/eligibilidade e exigir que o card não invente texto.

- [ ] **Step 2: Rodar os testes para confirmar a falha**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/detalhe-evento-ingresso.test.tsx components/__tests__/escolha-tipo-ingresso.test.tsx`

  Expected: FAIL porque o CTA mobile ainda navega para a rota da sessão e o componente de cards não existe.

- [ ] **Step 3: Implementar o componente e ajustar as rotas**

  - Criar o componente de cards usando `Link` do Next, formatação monetária existente e classes responsivas.
  - Substituir a lista de links simples da página de sessão por `EscolhaTipoIngresso`.
  - Alterar somente o `href` da barra mobile para `#sessoes`; preservar a seleção explícita de tipo nos cards da página do evento.

- [ ] **Step 4: Rodar os testes para confirmar o verde**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/detalhe-evento-ingresso.test.tsx components/__tests__/escolha-tipo-ingresso.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add -- apps/eventos/components/detalhe-evento.tsx apps/eventos/components/escolha-tipo-ingresso.tsx 'apps/eventos/app/evento/[slug]/sessao/[sessionId]/page.tsx' apps/eventos/components/__tests__/detalhe-evento-ingresso.test.tsx apps/eventos/components/__tests__/escolha-tipo-ingresso.test.tsx
  git commit -m "fix: preserva contexto no CTA mobile de eventos"
  ```

### Task 2: Resumo de seleção, total e checkout fixo

**Files:**
- Modify: `apps/eventos/components/resumo-assentos.tsx`
- Modify: `apps/eventos/components/mapa-assentos.tsx`
- Modify: `apps/eventos/components/__tests__/mapa-assentos.test.tsx`

**Interfaces:**
- `calcularTotalSelecao(selection, ticketTypes): number` retorna o total em centavos, ignorando seleções sem tipo.
- `ResumoAssentosFixo({ selection, ticketTypes, checkoutHref, onChangeTicketType })` renderiza quantidade, total e ação de checkout com `aria-disabled` coerente.
- `MapaAssentos` continua produzindo o mesmo `checkoutHref` serializado e passa o estado de seleção para os dois resumos.

- [ ] **Step 1: Escrever os testes que falham**

  - Testar total de dois assentos com tipos inteira e meia.
  - Testar resumo fixo com nenhum assento: total zerado e checkout desabilitado.
  - Testar resumo fixo com assentos selecionados e tipos completos: quantidade, valor formatado e link para checkout presentes.
  - Testar que uma seleção sem tipo mantém o checkout desabilitado.

- [ ] **Step 2: Rodar os testes para confirmar a falha**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/mapa-assentos.test.tsx`

  Expected: FAIL porque o cálculo e o resumo fixo ainda não existem.

- [ ] **Step 3: Implementar cálculo e resumo compacto**

  - Extrair a formatação monetária e calcular o total a partir dos `ticketTypeId`.
  - Criar uma versão compacta com `position: fixed` apenas em `md:hidden`, incluindo `pb` adicional no contêiner principal.
  - Reutilizar a mesma condição de seleção completa usada na serialização atual para evitar links inválidos.

- [ ] **Step 4: Integrar e rodar os testes**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/mapa-assentos.test.tsx`

  Expected: PASS, incluindo os testes existentes de ordem de assentos, tipos e estados indisponíveis.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/eventos/components/resumo-assentos.tsx apps/eventos/components/mapa-assentos.tsx apps/eventos/components/__tests__/mapa-assentos.test.tsx
  git commit -m "feat: fixa resumo de assentos no fluxo mobile"
  ```

### Task 3: Visão híbrida do mapa e seleção por fileira

**Files:**
- Modify: `apps/eventos/components/mapa-assentos.tsx`
- Modify: `apps/eventos/components/__tests__/mapa-assentos.test.tsx`
- Modify: `apps/eventos/app/evento/[slug]/sessao/[sessionId]/page.tsx`

**Interfaces:**
- O mapa desktop continua usando `estiloAssento` e `calcularBoundsMapa`.
- A visão mobile oferece `Lista` e `Mapa`, um `select` `Escolha uma fileira` e renderiza somente os assentos da fileira ativa.
- O primeiro valor do seletor é a primeira fileira com assento disponível; se nenhuma fileira estiver disponível, a lista informa o estado sem liberar ações.

- [ ] **Step 1: Escrever os testes que falham**

  - Exigir o seletor de fileira e as opções únicas em ordem de aparição.
  - Alterar a fileira e exigir que somente os assentos daquela fileira apareçam na lista mobile.
  - Exigir controles `Lista` e `Mapa` e texto orientando o mapa rolável.
  - Exigir que estados indisponíveis apareçam como informação, mas não como botões selecionáveis.
  - Exigir `aria-live` com quantidade selecionada e uma mensagem de lista vazia quando a fileira não tiver lugares disponíveis.

- [ ] **Step 2: Rodar os testes para confirmar a falha**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/mapa-assentos.test.tsx`

  Expected: FAIL porque hoje só existe a planta e a lista completa de assentos.

- [ ] **Step 3: Implementar a visão híbrida**

  - Derivar fileiras e assentos filtrados com `useMemo`.
  - Renderizar a lista mobile agrupada, mantendo botões somente para assentos disponíveis e permitindo alternar a seleção.
  - Renderizar o mapa visual em um contêiner rolável, com a lista como modo inicial em telas pequenas e a planta como modo padrão em desktop.
  - Remover a lista completa duplicada que gera 784 itens de acessibilidade; manter apenas a fileira ativa no mobile e a planta sem duplicação no desktop.
  - Manter labels, `aria-pressed`, informação de acessibilidade e classes de estado já cobertas pelos testes.

- [ ] **Step 4: Rodar os testes para confirmar o verde**

  Run: `pnpm --filter @essencia/eventos test -- apps/eventos/components/__tests__/mapa-assentos.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add -- apps/eventos/components/mapa-assentos.tsx apps/eventos/components/__tests__/mapa-assentos.test.tsx 'apps/eventos/app/evento/[slug]/sessao/[sessionId]/page.tsx'
  git commit -m "feat: melhora seleção de assentos no mobile"
  ```

### Task 4: Verificação integrada da experiência pública

**Files:**
- Modify: `apps/eventos/components/__tests__/detalhe-evento-ingresso.test.tsx` only if assertions de integração precisarem de ajuste.
- Modify: `apps/eventos/app/publico.test.tsx` only if a regra pública nova precisar ser fixada no teste de fonte.

- [ ] **Step 1: Rodar a suíte da app**

  Run: `pnpm --filter @essencia/eventos test`

  Expected: todos os testes da app passam.

- [ ] **Step 2: Rodar lint, typecheck e build da app**

  Run: `pnpm --filter @essencia/eventos lint && pnpm --filter @essencia/eventos typecheck && pnpm --filter @essencia/eventos build`

  Expected: exit code 0.

- [ ] **Step 3: Executar smoke Playwright em 390px e 1440px**

  Validar na página pública do ballet:

  - CTA mobile chega a `#sessoes`.
  - Tela de escolha de ingresso sem query exibe cards.
  - Mobile inicia na lista, filtra fileira, seleciona assento e mostra resumo fixo com total.
  - Desktop mantém mapa proporcional e resumo acionável.
  - Não há sobreposição, overflow horizontal inesperado ou erro de console.

- [ ] **Step 4: Rodar o pipeline obrigatório do repositório**

  Run: `pnpm turbo lint && pnpm turbo typecheck`

  Expected: exit code 0; avisos preexistentes devem ser registrados sem mascarar erros novos.

- [ ] **Step 5: Commit final de ajustes de validação**

  ```bash
  git add apps/eventos
  git commit -m "test: valida fluxo responsivo de compra de eventos"
  ```

