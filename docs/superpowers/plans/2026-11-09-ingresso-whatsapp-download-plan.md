# Ações do ingresso: download e WhatsApp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar download individual em PDF e compartilhamento direto pelo WhatsApp aos cartões de ingresso públicos.

**Architecture:** Reutilizar o gerador de PDF existente em `apps/eventos/lib/pdf-ingresso.ts`, acrescentar uma função pura para montar a mensagem e a URL do WhatsApp e manter as ações no componente cliente `AcoesIngresso`. Nenhuma rota de backend ou persistência será alterada.

**Tech Stack:** Next.js, React, TypeScript, Vitest, jsPDF e Web APIs de `window.open`/download.

**Spec:** `docs/superpowers/specs/2026-11-09-ingresso-whatsapp-download-design.md`

## Global Constraints

- Comunicação, textos de interface, testes e comentários devem permanecer em português do Brasil.
- O QR payload nunca entra na mensagem do WhatsApp.
- O download deve usar o PDF já gerado pelo sistema.
- Não alterar webhook, modelo de ingresso ou backend.
- Executar `pnpm turbo lint && pnpm turbo typecheck` antes de concluir.

## Review Focus

- A mensagem do WhatsApp deve codificar acentos, espaços e quebras de linha sem corromper o texto — cobrir no teste da função de URL.
- O QR payload não pode aparecer na URL nem na mensagem — cobrir no teste da função de URL.
- O download deve usar o nome individual e liberar o objeto Blob — cobrir no teste do componente/ação.
- O estado de carregamento deve impedir cliques duplicados nas duas ações — cobrir no teste do componente.
- O cartão deve expor dois botões com nomes acessíveis e distintos — cobrir no teste do cartão.

### Task 1: URL e mensagem do WhatsApp

**Files:**
- Modify: `apps/eventos/lib/pdf-ingresso.ts`
- Test: `apps/eventos/lib/__tests__/pdf-ingresso.test.ts`

**Interfaces:**
- Produces `mensagemWhatsAppIngresso(pedido, ingresso, urlPagina): string` e `urlWhatsAppIngresso(pedido, ingresso, urlPagina): string`.

- [x] **Step 1: Write the failing tests** para mensagem com dados do ingresso, URL codificada e ausência do `qrPayload`.
- [x] **Step 2: Run the focused test** com `pnpm --filter @essencia/eventos exec vitest run lib/__tests__/pdf-ingresso.test.ts` e confirmar a falha pela ausência das funções.
- [x] **Step 3: Implement the minimal pure helpers** em `pdf-ingresso.ts`, usando `encodeURIComponent` somente na URL final.
- [x] **Step 4: Run the focused test** e confirmar aprovação.

### Task 2: Ações visuais do cartão

**Files:**
- Modify: `apps/eventos/components/ingressos/acoes-ingresso.tsx`
- Test: `apps/eventos/components/__tests__/acoes-ingresso.test.tsx`

**Interfaces:**
- O componente continua recebendo `pedido`, `ingresso`, `indice` e `total`.
- O botão `Baixar ingresso` gera o PDF individual e dispara download.
- O botão `Compartilhar no WhatsApp` abre a URL montada pelos helpers.

- [x] **Step 1: Write the failing component tests** para os dois botões, abertura do WhatsApp e download individual.
- [x] **Step 2: Run the focused test** com `pnpm --filter @essencia/eventos exec vitest run components/__tests__/acoes-ingresso.test.tsx` e confirmar a falha.
- [x] **Step 3: Implement the two actions** mantendo estado de carregamento e mensagens acessíveis, sem usar o compartilhamento genérico do navegador.
- [x] **Step 4: Run the focused test** e confirmar aprovação.

### Task 3: Integração e validação

**Files:**
- Modify: `apps/eventos/components/__tests__/ingressos.test.tsx` se necessário para asserções de acessibilidade do cartão.

- [x] **Step 1: Run the eventos test suite** com `pnpm --filter @essencia/eventos test`.
- [x] **Step 2: Run lint e typecheck globais** com `pnpm turbo lint && pnpm turbo typecheck`.
- [x] **Step 3: Run `git diff --check`** e revisar somente os arquivos previstos.
- [ ] **Step 4: Commit** com mensagem em português: `feat: adiciona download e WhatsApp aos ingressos`.
