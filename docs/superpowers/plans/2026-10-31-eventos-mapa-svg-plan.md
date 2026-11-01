# Mapa de assentos SVG interativo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a planta HTML densa por um mapa SVG interativo, acessível e responsivo, mantendo a seleção local até “Continuar” e a reserva temporária somente no checkout.

**Architecture:** `MapaAssentos` continuará orquestrando seleção, lista, resumo e serialização. Um novo `MapaAssentosSvg` será responsável somente pelo renderer visual, controles e gestos de zoom/pan; React continuará sendo a fonte do estado local de seleção. A URL transportará `assentos`, `ticketTypeIds` e um motivo de conflito no retorno do checkout, enquanto a API atual continuará sendo a única fonte de disponibilidade e reserva.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, `d3-zoom` com `d3-selection` como adaptador, Vitest, Testing Library e Playwright.

**Spec:** `docs/superpowers/specs/2026-10-31-eventos-mapa-svg-design.md`

## Global Constraints

- Comunicação, código de domínio, commits, documentação e comentários em Português do Brasil.
- A seleção de assentos permanece apenas no estado local até o clique em “Continuar para checkout”.
- A reserva temporária continua sendo criada pelo backend somente no checkout; nenhum clique no mapa cria hold.
- O contrato `PublicMap`, a seleção `seatId/ticketTypeId`, `assentos`, `ticketTypeIds` e `sessionId` permanece compatível.
- O backend, o banco, o painel administrativo, o Stripe e as regras comerciais não serão alterados.
- A lista por fileira deve estar disponível em desktop, tablet e celular; mapa é a visão inicial no desktop e lista é a visão inicial no celular.
- A camada visual usa SVG e somente os módulos necessários de zoom; não adicionar Canvas, WebGL, Konva, PixiJS ou fornecedor comercial.
- A URL pode transportar apenas IDs de assentos, tipos, sessão e motivo de conflito; nenhum dado pessoal será persistido ou colocado nela.
- Assentos `reserved`, `sold` e `blocked` continuam visíveis, sem ação de seleção.
- A validação obrigatória antes de concluir é `pnpm turbo lint && pnpm turbo typecheck`.

## Review Focus

- Clique ou tecla em assento disponível não pode chamar reserva nem alterar backend — teste unitário com `fetch` monitorado em `mapa-assentos.test.tsx`.
- Assento que muda de disponibilidade durante o checkout deve ser removido da seleção reidratada e identificado no mapa — teste de `reidratarSelecaoAssentos`.
- A lista e o mapa não podem deixar controles duplicados expostos ao leitor de tela quando um modo está oculto — teste de `aria-hidden`, `hidden` e nomes acessíveis.
- Zoom, pan e clique no assento precisam coexistir sem transformar arraste em seleção — smoke Playwright com controle de zoom e seleção após gesto.
- Query malformada, tipos desalinhados, assento inexistente ou mapa vazio não podem quebrar a página nem habilitar checkout — testes de utilidade e estado desabilitado.

---

### Task 1: Dependência de zoom e utilidades de geometria/reidratação

**Files:**
- Modify: `apps/eventos/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/eventos/components/assentos-types.ts`
- Modify: `apps/eventos/components/mapa-assentos-utils.ts`
- Modify: `apps/eventos/components/resumo-assentos.tsx`
- Create: `apps/eventos/components/__tests__/mapa-assentos-utils.test.ts`

**Interfaces:**
- `calcularBoundsMapa(seats: PublicSeat[]): Bounds` continua retornando limites seguros para mapas vazios ou com dimensões zero.
- `calcularBoundsFileira(seats: PublicSeat[], rowLabel: string): Bounds | null` calcula a região ocupada por uma fileira para foco programático.
- `calcularViewBoxMapa(bounds: Bounds): string` retorna `"minX minY width height"` para o atributo `viewBox` do SVG.
- `type AssentoSelecionado = { seatId: string; ticketTypeId: string; label?: string; accessible?: boolean }` vive em `assentos-types.ts`; `resumo-assentos.tsx` o reexporta para preservar os imports existentes.
- `type RehidratacaoSelecao = { selection: AssentoSelecionado[]; unavailableSeatIds: string[]; invalid: boolean }`.
- `reidratarSelecaoAssentos(map: PublicMap, seatIds: string[], ticketTypeIds: string[]): RehidratacaoSelecao` alinha tipos por índice, aceita um único tipo para vários assentos, seleciona somente lugares ainda disponíveis e identifica os que mudaram de estado.
- `serializarSelecaoAssentos(selection)` mantém a ordem atual de assentos e tipos.

- [ ] **Step 1: Escrever os testes que falham**

  - Testar `calcularViewBoxMapa` com limites normais e limites mínimos.
  - Testar `calcularBoundsFileira` para uma fileira existente e para uma fileira sem assentos.
  - Testar reidratação de dois assentos disponíveis, preservando rótulo, acessibilidade e tipos na mesma ordem.
  - Testar um único `ticketTypeId` aplicado a todos os IDs.
  - Testar assento reservado/vendido/bloqueado retornado em `unavailableSeatIds`, sem entrar em `selection`.
  - Testar ID inexistente ou listas de tipos desalinhadas marcados como `invalid` sem lançar exceção.

- [ ] **Step 2: Rodar os testes para confirmar a falha**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/mapa-assentos-utils.test.ts`

  Expected: FAIL porque `calcularViewBoxMapa` e `reidratarSelecaoAssentos` ainda não existem.

- [ ] **Step 3: Adicionar dependências e implementar as utilidades**

  - Adicionar `d3-zoom` e `d3-selection` às dependências de `@essencia/eventos` e os tipos correspondentes às dependências de desenvolvimento, sem instalar o pacote completo `d3`.
  - Mover `AssentoSelecionado` para o arquivo neutro de tipos e reexportá-lo a partir de `resumo-assentos.tsx`, permitindo que páginas Server Component usem a reidratação sem importar um componente client.
  - Implementar `calcularViewBoxMapa` a partir de `Bounds` já calculado.
  - Implementar `reidratarSelecaoAssentos` sem fazer chamadas de rede; a função deve tratar entradas inválidas como resultado controlado.
  - Preservar as funções públicas já importadas pelos testes existentes.

- [ ] **Step 4: Rodar os testes para confirmar o verde**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/mapa-assentos-utils.test.ts components/__tests__/mapa-assentos.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/eventos/package.json pnpm-lock.yaml apps/eventos/components/mapa-assentos-utils.ts apps/eventos/components/__tests__/mapa-assentos-utils.test.ts
  git commit -m "feat: prepara geometria e reidratação do mapa de assentos"
  ```

### Task 2: Renderer SVG acessível com zoom e pan

**Files:**
- Create: `apps/eventos/components/mapa-assentos-svg.tsx`
- Create: `apps/eventos/components/__tests__/mapa-assentos-svg.test.tsx`

**Interfaces:**
- `MapaAssentosSvg({ map, selection, focusRow, onToggleSeat }: { map: PublicMap; selection: AssentoSelecionado[]; focusRow?: string; onToggleSeat: (seat: PublicSeat) => void }): React.JSX.Element` renderiza a planta sem possuir estado de checkout.
- O componente expõe controles com os nomes acessíveis `Aumentar zoom`, `Reduzir zoom` e `Centralizar mapa`.
- Assentos disponíveis possuem `data-seat-id`, nome acessível, foco visível e ativação por clique, Enter e Espaço.
- Assentos indisponíveis são somente informativos e expõem estado, categoria e acessibilidade sem ação.

- [ ] **Step 1: Escrever os testes que falham**

  - Renderizar um SVG com `viewBox` derivado dos assentos e um elemento identificável para cada assento.
  - Exigir que somente assentos disponíveis tenham foco/ativação e que os demais tragam estado indisponível.
  - Disparar clique, Enter e Espaço em um assento disponível e exigir uma chamada a `onToggleSeat` por ativação.
  - Exigir os três controles de zoom com `aria-label` e foco de teclado.
  - Exigir que assentos selecionados tenham indicação visual e `aria-pressed` coerente quando o modo mapa estiver ativo.

- [ ] **Step 2: Rodar os testes para confirmar a falha**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/mapa-assentos-svg.test.tsx`

  Expected: FAIL porque o renderer SVG ainda não existe.

- [ ] **Step 3: Implementar `MapaAssentosSvg`**

  - Criar o SVG com `viewBox`, grupo de transformação e formas proporcionais para cada assento.
  - Inicializar `d3-zoom` em uma referência do SVG, aplicar o transform somente no grupo interno e limitar escala/translation para a planta não desaparecer.
  - Implementar aumentar, reduzir e centralizar usando a mesma instância de zoom.
  - Aceitar `focusRow?: string` e, quando a fileira ativa mudar ou o mapa ficar visível, aplicar zoom enquadrando `calcularBoundsFileira` sem perder a possibilidade de resetar para a planta completa.
  - Filtrar estados não disponíveis antes de chamar `onToggleSeat`.
  - Tratar Enter e Espaço com `preventDefault` para não rolar a página ao ativar um assento.
  - Manter a semântica acessível dentro do SVG; o componente pai controlará `aria-hidden` quando a lista estiver ativa para não duplicar controles.

- [ ] **Step 4: Rodar os testes para confirmar o verde**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/mapa-assentos-svg.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/eventos/components/mapa-assentos-svg.tsx apps/eventos/components/__tests__/mapa-assentos-svg.test.tsx
  git commit -m "feat: adiciona mapa SVG acessível com zoom"
  ```

### Task 3: Integração responsiva do mapa, lista e resumo

**Files:**
- Modify: `apps/eventos/components/mapa-assentos.tsx`
- Modify: `apps/eventos/components/resumo-assentos.tsx`
- Modify: `apps/eventos/components/__tests__/mapa-assentos.test.tsx`
- Modify: `apps/eventos/app/evento/[slug]/sessao/[sessionId]/page.tsx`

**Interfaces:**
- `MapaAssentos` aceita `initialSelection?: AssentoSelecionado[]` e `unavailableSeatIds?: string[]` além das props atuais.
- `MapaAssentos` mantém seleção, troca de tipo, serialização e `checkoutHref`; não faz `fetch` ao alternar assentos.
- O modo de visualização é `"mapa" | "lista"`, com mapa inicial em desktop, lista inicial em celular e alternador disponível em todos os breakpoints.
- Somente o modo ativo fica exposto à árvore de acessibilidade; o outro recebe simultaneamente `hidden` e `aria-hidden="true"`, removendo seus controles focáveis da navegação.

- [ ] **Step 1: Escrever os testes que falham**

  - Exigir mapa SVG, lista por fileira e alternador `Mapa`/`Lista`.
  - Exigir que o modo lista funcione em qualquer viewport lógico, filtrando pela fileira escolhida, e que o modo mapa oculte a lista da árvore acessível.
  - Exigir seleção e desmarcação sincronizadas entre mapa e lista, incluindo troca de tipo e total.
  - Exigir reidratação de uma seleção inicial e mensagem nomeando assentos indisponíveis recebidos do retorno do checkout.
  - Exigir que trocar a fileira atualize o foco solicitado ao renderer SVG quando o modo mapa estiver ativo.
  - Espionar `globalThis.fetch`, clicar em assento e exigir zero chamadas de reserva.
  - Manter cobertura dos estados reservado, vendido e bloqueado sem botões acionáveis.

- [ ] **Step 2: Rodar os testes para confirmar a falha**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/mapa-assentos.test.tsx`

  Expected: FAIL porque o componente ainda renderiza a planta HTML antiga e não recebe seleção inicial/conflitos.

- [ ] **Step 3: Integrar o renderer e a visão híbrida**

  - Substituir a renderização visual HTML por `MapaAssentosSvg` no modo mapa.
  - Manter a lista por fileira em um componente compartilhado, tornando-a disponível em desktop, tablet e celular.
  - Inicializar o modo com lista durante SSR e trocar para mapa em telas `min-width: 768px` após montagem, evitando erro de hidratação.
  - Reaproveitar `ResumoAssentos` e `ResumoAssentosFixo` com a mesma seleção local e manter o espaço inferior necessário no mobile.
  - Exibir um alerta de conflito sem apagar assentos ainda disponíveis; o assento indisponível fica fora da seleção e pode ser substituído.
  - Fazer a página de sessão ler os parâmetros de seleção da URL, calcular a reidratação depois de obter o mapa atual e repassar os resultados ao componente.

- [ ] **Step 4: Rodar os testes para confirmar o verde**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/mapa-assentos.test.tsx components/__tests__/mapa-assentos-svg.test.tsx components/__tests__/mapa-assentos-utils.test.ts`

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/eventos/components/mapa-assentos.tsx apps/eventos/components/resumo-assentos.tsx apps/eventos/components/__tests__/mapa-assentos.test.tsx 'apps/eventos/app/evento/[slug]/sessao/[sessionId]/page.tsx'
  git commit -m "feat: integra mapa SVG e lista acessível de assentos"
  ```

### Task 4: Retorno ao mapa após conflito de disponibilidade

**Files:**
- Modify: `apps/eventos/lib/checkout-utils.ts`
- Create: `apps/eventos/lib/__tests__/checkout-utils.test.ts`
- Modify: `apps/eventos/app/checkout/page.tsx`
- Modify: `apps/eventos/components/formulario-checkout.tsx`
- Modify: `apps/eventos/components/__tests__/formulario-checkout.test.tsx`
- Modify: `apps/eventos/app/evento/[slug]/sessao/[sessionId]/page.tsx`

**Interfaces:**
- `montarHrefRetornoMapa({ slug, sessionId, seatIds, ticketTypeIds, motivo }: { slug: string; sessionId: string; seatIds: string[]; ticketTypeIds: string[]; motivo?: "disponibilidade" }): string` gera a rota pública da sessão com `assentos`, `ticketTypeIds` e `conflito`, sem incluir dados pessoais.
- `FormularioCheckout` recebe `mapHref?: string` e, para `EventosApiError` com código `SEAT_UNAVAILABLE`, renderiza o alerta atual mais um link `Revisar assentos` para `mapHref`.
- A página de sessão interpreta `conflito=disponibilidade`, consulta o mapa atual e calcula quais IDs da seleção deixaram de estar disponíveis.

- [ ] **Step 1: Escrever os testes que falham**

  - Testar a montagem da URL com IDs na ordem original, tipos alinhados, sessão e motivo de conflito.
  - Testar que a URL não contém nome, e-mail, telefone ou qualquer dado do formulário.
  - Renderizar o checkout com `mapHref`, simular erro `SEAT_UNAVAILABLE` e exigir mensagem de conflito e link `Revisar assentos`.
  - Testar que erros 409 de outro código não exibem retorno ao mapa automaticamente.
  - Testar que a página de sessão aceita os parâmetros de retorno sem quebrar quando eles estão ausentes.

- [ ] **Step 2: Rodar os testes para confirmar a falha**

  Run: `pnpm --filter @essencia/eventos test -- lib/__tests__/checkout-utils.test.ts components/__tests__/formulario-checkout.test.tsx`

  Expected: FAIL porque o checkout ainda não conhece uma rota de retorno ao mapa.

- [ ] **Step 3: Implementar o retorno explícito ao mapa**

  - Construir `mapHref` na página de checkout usando `slug`, `sessionId`, `assentos` e `ticketTypeIds` já recebidos na URL.
  - No conflito de disponibilidade, manter o formulário e seus dados somente no estado atual da página, exibir o erro e oferecer o link explícito `Revisar assentos`; não redirecionar automaticamente nem salvar dados pessoais.
  - Passar a seleção pela URL ao voltar e marcar `conflito=disponibilidade`.
  - Na página de sessão, reidratar apenas assentos que continuam disponíveis, mostrar os nomes dos conflitantes e manter o resumo desabilitado até a seleção ser corrigida.

- [ ] **Step 4: Rodar os testes para confirmar o verde**

  Run: `pnpm --filter @essencia/eventos test -- lib/__tests__/checkout-utils.test.ts components/__tests__/formulario-checkout.test.tsx components/__tests__/mapa-assentos-utils.test.ts`

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/eventos/lib/checkout-utils.ts apps/eventos/lib/__tests__/checkout-utils.test.ts apps/eventos/app/checkout/page.tsx apps/eventos/components/formulario-checkout.tsx apps/eventos/components/__tests__/formulario-checkout.test.tsx 'apps/eventos/app/evento/[slug]/sessao/[sessionId]/page.tsx'
  git commit -m "feat: recupera seleção após conflito de assento"
  ```

### Task 5: Validação integrada de UI, acessibilidade e regressão

**Files:**
- Modify: `apps/eventos/scripts/smoke-publico.mjs`
- Modify: `apps/eventos/components/__tests__/mapa-assentos.test.tsx` only if an integration assertion is missing.
- Modify: `apps/eventos/app/publico.test.tsx` only if a public-surface assertion needs to be fixed.

- [ ] **Step 1: Atualizar o smoke Playwright**

  Cobrir em 390×844 e 1440×900:

  - mapa SVG carregado sem erro de console;
  - lista e mapa alternáveis em ambos os tamanhos;
  - lista inicia no celular e mapa inicia no desktop;
  - zoom aumentar, reduzir e centralizar alteram/restauram o transform do SVG;
  - trocar a fileira e abrir o mapa enquadra a região correspondente;
  - assento disponível pode ser focado e selecionado, e assentos indisponíveis não são acionáveis;
  - clicar em assento não gera requisição `POST /api/eventos/public/reservas`;
  - o resumo mantém `sessionId`, assentos e tipos alinhados;
  - a página aberta com `conflito=disponibilidade` retorna ao mapa com seleção reidratada e nomeia o assento que mudou de estado;
  - não há overflow horizontal nem sobreposição do resumo fixo.

- [ ] **Step 2: Executar a suíte da app**

  Run: `pnpm --filter @essencia/eventos test`

  Expected: todos os testes passam.

- [ ] **Step 3: Executar lint, typecheck e build da app**

  Run: `pnpm --filter @essencia/eventos lint && pnpm --filter @essencia/eventos typecheck && pnpm --filter @essencia/eventos build`

  Expected: exit code 0.

- [ ] **Step 4: Executar o smoke Playwright**

  Run: `pnpm --filter @essencia/eventos exec node scripts/smoke-publico.mjs`

  Expected: saídas `mobile: PASS` e `desktop: PASS`, sem erros de console, rede ou encerramento de servidor.

- [ ] **Step 5: Executar o pipeline obrigatório do repositório**

  Run: `pnpm turbo lint && pnpm turbo typecheck`

  Expected: exit code 0.

- [ ] **Step 6: Verificar diff e registrar a entrega**

  Run: `git diff --check && git status --short`

  Expected: nenhuma falha de whitespace; somente arquivos previstos no plano alterados. Commit final de ajustes, se necessário:

  ```bash
  git add apps/eventos docs/superpowers/specs/2026-10-31-eventos-mapa-svg-design.md docs/superpowers/plans/2026-10-31-eventos-mapa-svg-plan.md
  git commit -m "test: valida mapa interativo de eventos"
  ```
