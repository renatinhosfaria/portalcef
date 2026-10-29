# Cartões guiados para sessões e local — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o formulário técnico de sessões por cartões guiados, com seleções visuais de local/mapa, herança explícita, campos avançados ocultos e feedback claro de pendências.

**Architecture:** A API fornecerá um contrato específico de opções da sessão, limitado ao evento e à escola do usuário, contendo locais e mapas disponíveis e os padrões atuais. O painel manterá o autosave existente, mas separará o estado visual da sessão do payload persistido; `SessionEditor` será responsável por cartões, validação local e seleção de exceções.

**Tech Stack:** Next.js App Router, React 19, TypeScript, NestJS/Fastify, Drizzle, Vitest, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-10-29-eventos-sessoes-ux-design.md`

## Global Constraints

- Toda comunicação, código de domínio, commits, documentação e comentários devem permanecer em Português do Brasil.
- Apps não acessam banco diretamente; opções de local e mapa devem vir pela API HTTP.
- O escopo escolar deve ser obtido da sessão e validado no serviço, nunca do payload do cliente.
- O autosave não deve enviar sessão incompleta ao servidor.
- A regra de capacidade vendável e o fluxo de inventário permanecem inalterados.
- Antes de commit/PR, executar `pnpm turbo lint && pnpm turbo typecheck`.

## Review Focus

- Uma sessão nova, sem ID persistido, deve poder ser removida localmente sem chamada à API; cobrir em teste do editor.
- Ao trocar de herança para exceção e voltar, os valores visuais e o payload devem continuar coerentes; cobrir em teste de contrato/editor.
- Mapas em revisão ou arquivados não devem aparecer como opção de mapa utilizável; cobrir no teste do serviço de opções.
- Locais de outra escola não podem aparecer na resposta; cobrir no teste do serviço de opções.
- Uma sessão com apenas um campo ausente deve mostrar a pendência específica e permanecer local; cobrir em teste do editor e da página.

### Task 1: Contrato de opções de sessão na API

**Files:**
- Modify: `services/api/src/modules/eventos/eventos.service.ts`
- Modify: `services/api/src/modules/eventos/eventos-admin.controller.ts`
- Test: `services/api/src/modules/eventos/eventos.service.spec.ts`
- Test: `services/api/src/modules/eventos/eventos.controller.spec.ts`

**Interfaces:**
- Produces `GET /eventos/admin/:id/sessoes/opcoes`.
- Response data: `{ defaultLocation: { id: string; name: string; address: string; room: string | null } | null; locations: Array<{ id: string; name: string; address: string; room: string | null }>; defaultMap: { id: string; version: number; status: "CONFIRMADO"; originalFileName: string | null } | null; maps: Array<{ id: string; version: number; status: "CONFIRMADO"; originalFileName: string | null }> }`.

- [ ] **Step 1: Write failing service tests** for school scoping, default selection and filtering of maps to `CONFIRMADO`.
- [ ] **Step 2: Run the focused API tests** and confirm the new method/route is missing.
- [ ] **Step 3: Implement `listarOpcoesSessoes(eventId, actor)`** using the event’s `schoolId`, `eventoLocais` filtered by school, the event’s default location/map and confirmed maps for the event.
- [ ] **Step 4: Add `GET :id/sessoes/opcoes`** in the admin controller and preserve the existing `GET :id/sessoes` route.
- [ ] **Step 5: Run focused API tests** and confirm all pass.
- [ ] **Step 6: Commit** with `feat: expor opcoes visuais para sessoes de eventos`.

### Task 2: Contratos e validação visual do cartão

**Files:**
- Modify: `apps/eventos-admin/features/eventos/etapas-contratos.ts`
- Create: `apps/eventos-admin/features/eventos/session-card-contracts.ts`
- Test: `apps/eventos-admin/features/eventos/session-card-contracts.test.ts`

**Interfaces:**
- `type SessionOptions` com locais/mapas e padrões da API.
- `type SessionDraftState` com `locationMode: "default" | "custom"` e `mapMode: "default" | "custom"`.
- `validarSessao(draft): { ok: boolean; errors: Partial<Record<"startsAt" | "endsAt" | "capacity" | "salesStartsAt" | "salesEndsAt" | "location" | "map", string>> }`.
- `construirPayloadSessao(draft)` continua produzindo `locationId`/`mapId` nulos quando a herança está ativa.

- [ ] **Step 1: Write failing tests** para validação de cada campo ausente, datas invertidas, capacidade inválida e conversão de modos visuais para IDs.
- [ ] **Step 2: Run the focused contract test** and confirm failure.
- [ ] **Step 3: Implement the types and pure functions** without coupling them to React.
- [ ] **Step 4: Run the focused contract test** and confirm pass.
- [ ] **Step 5: Commit** with `feat: adiciona contrato guiado para cartoes de sessao`.

### Task 3: Refatorar `SessionEditor` para cartões guiados

**Files:**
- Modify: `apps/eventos-admin/features/eventos/session-editor.tsx`
- Test: `apps/eventos-admin/features/eventos/session-editor.test.tsx`

**Interfaces:**
- `SessionEditor({ initialValue, options, onChange, onRemove })` recebe `SessionOptions` e continua emitindo `SessionValue[]` compatível com o autosave.
- Cada cartão deve renderizar `Sessão N`, estado textual (`Pronta`, `Falta ...`), blocos “Quando acontece”, “Capacidade e vendas”, “Local” e “Mapa de assentos”.

- [ ] **Step 1: Write failing component tests** para rótulos visíveis, opções com nomes legíveis, herança inicial, expansão de exceção, mensagem de pendência e remoção local.
- [ ] **Step 2: Run the focused component tests** and confirm failure.
- [ ] **Step 3: Implement the card layout** with native labeled date/number controls, visual radio/select controls for local/mapa, and advanced exception selectors rendered only in custom mode.
- [ ] **Step 4: Implement card-level feedback** using `validarSessao`, preserving incomplete values locally and emitting changes through `onChange`.
- [ ] **Step 5: Run the focused component tests** and confirm pass.
- [ ] **Step 6: Commit** with `feat: guia preenchimento de sessoes em cartoes`.

### Task 4: Integrar opções, autosave e readiness na página

**Files:**
- Modify: `apps/eventos-admin/app/eventos/[id]/sessoes/page.tsx`
- Modify: `apps/eventos-admin/features/eventos/use-evento-autosave.ts` (reuse existing `onSaved` callback)
- Test: `apps/eventos-admin/app/eventos/[id]/sessoes/page.test.ts`

**Interfaces:**
- A página buscará `/eventos-admin/api/eventos/admin/:id/sessoes/opcoes` junto com `/sessoes`.
- A página passará as opções ao `SessionEditor`, exibirá carregamento/erro específico e chamará `router.refresh()` após autosave bem-sucedido.

- [ ] **Step 1: Write failing page/source tests** para a rota de opções, `router.refresh`, estados de carregamento/erro e bloqueio de envio quando houver sessão incompleta.
- [ ] **Step 2: Run the focused page tests** and confirm failure.
- [ ] **Step 3: Integrate the options request** and normalize API responses into `SessionOptions`.
- [ ] **Step 4: Conectar o `SessionEditor` ao autosave existente** preservando os IDs retornados para sessões novas e evitando chamadas para rascunhos locais inválidos.
- [ ] **Step 5: Add readiness refresh** after successful save and clear local error state only after the server accepts the payload.
- [ ] **Step 6: Run focused page and panel tests** and confirm pass.
- [ ] **Step 7: Commit** with `feat: integra cartoes guiados ao workspace de sessoes`.

### Task 5: Verificação final da experiência

**Files:**
- Modify: `apps/eventos-admin/features/eventos/session-editor.test.tsx` only if review gaps appear.
- Modify: `apps/eventos-admin/app/eventos/[id]/sessoes/page.test.ts` only if review gaps appear.

- [ ] **Step 1: Run `pnpm --filter @essencia/eventos-admin test`.** Expected: all panel tests pass, including the new session tests.
- [ ] **Step 2: Run `pnpm turbo lint && pnpm turbo typecheck`.** Expected: 22 tasks successful; existing warnings may remain.
- [ ] **Step 3: Manually verify the event workspace** with one inherited session, one custom location/map session and one incomplete session; confirm the next action is explicit and no UUID is shown.
- [ ] **Step 4: Commit any test-only adjustments** with a focused message.
- [ ] **Step 5: Report the branch, commits, tests and any remaining UI limitation.**
