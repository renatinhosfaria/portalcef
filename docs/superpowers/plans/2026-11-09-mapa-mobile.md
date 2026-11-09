# Enquadramento mobile do mapa público — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iniciar o mapa público de assentos focado nos lugares em telas mobile, preservando o enquadramento desktop e os controles atuais.

**Architecture:** `MapaPublico` calcula uma caixa de foco a partir dos lugares públicos. Um hook de viewport simples determina se a renderização está em mobile; somente nesse caso a caixa é passada à prop `foco` já suportada por `MapaEstiloB`, que aplica `transformParaFoco` via d3-zoom.

**Tech Stack:** Next.js/React, TypeScript, Tailwind CSS, Vitest Testing Library, d3-zoom.

**Spec:** `docs/superpowers/specs/2026-11-09-mapa-mobile-design.md`

## Global Constraints

- Não alterar dados, coordenadas ou geração do mapa.
- Não cortar palco, entrada ou fileiras ao aplicar o foco inicial.
- Não mudar o comportamento inicial em desktop.
- Manter navegação por toque, acessibilidade e testes existentes.

## Review Focus

- Mapa sem assentos: não deve gerar foco inválido nem quebrar a renderização.
- Viewport desktop: deve manter transformação identidade.
- Viewport mobile: deve aplicar foco apenas quando houver lugares.
- Redimensionamento entre mobile e desktop: deve atualizar o foco sem prender o usuário em uma transformação antiga.
- Botão “Ver tudo”: deve continuar restaurando a visão completa após o foco mobile.

---

### Task 1: Foco responsivo do mapa público

**Files:**
- Create: `apps/eventos/components/mapa/use-viewport-mobile.ts`
- Modify: `apps/eventos/components/mapa/mapa-publico.tsx`
- Test: `apps/eventos/components/__tests__/mapa-publico.test.tsx`

**Interfaces:**
- Produz `useViewportMobile(): boolean`, baseado em `window.matchMedia("(max-width: 767px)")`, com atualização no evento `change` e fallback seguro para SSR.
- `MapaPublico` calcula a caixa de foco `{ x, y, largura, altura }` a partir dos lugares públicos e passa `foco={ehMobile && lugares.length > 0 ? caixa : null}` para `MapaEstiloB`.

- [ ] **Step 1: Write the failing tests**

  Em `mapa-publico.test.tsx`, adicione testes que mockem `matchMedia` e renderizem o mapa em mobile e desktop. Exponha/inspecione a transformação aplicada pelo SVG e verifique que mobile com lugares recebe uma transformação com `k > 1`, desktop recebe `k === 1`, e mapa sem lugares não recebe foco. Adicione um teste de mudança do media query que verifica a atualização após o evento `change`.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/mapa-publico.test.tsx --run`

  Expected: FAIL porque `MapaPublico` ainda não observa viewport nem passa foco inicial.

- [ ] **Step 3: Implement `useViewportMobile` and responsive focus**

  Criar o hook com estado inicial seguro para SSR e listener removível. Em `MapaPublico`, calcular os limites mínimos/máximos dos lugares usando centro e dimensões, acrescentar margem suficiente para não cortar os lugares e passar `null` fora do mobile. Não duplicar a lógica de zoom; reutilizar a prop `foco` de `MapaEstiloB`.

- [ ] **Step 4: Run focused tests**

  Run: `pnpm --filter @essencia/eventos test -- components/__tests__/mapa-publico.test.tsx --run`

  Expected: PASS, incluindo os testes existentes de clique, legenda e minimapa.

- [ ] **Step 5: Run module validation**

  Run: `pnpm --filter @essencia/eventos test`

  Expected: PASS sem regressões.

- [ ] **Step 6: Commit**

  ```bash
  git add apps/eventos/components/mapa/use-viewport-mobile.ts apps/eventos/components/mapa/mapa-publico.tsx apps/eventos/components/__tests__/mapa-publico.test.tsx docs/superpowers/specs/2026-11-09-mapa-mobile-design.md docs/superpowers/plans/2026-11-09-mapa-mobile.md
  git commit -m "melhora enquadramento mobile do mapa de eventos"
  ```
