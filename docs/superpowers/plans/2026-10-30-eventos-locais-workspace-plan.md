# Cadastro de locais no Workspace de eventos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir cadastrar locais, editar seus dados e definir o local padrão diretamente no Workspace do evento.

**Architecture:** Reutilizar `eventoLocais` e `eventos.defaultLocationId`. A API terá rotas administrativas próprias para listar/criar/editar locais e definir o padrão, sempre validando a escola do evento. A interface adicionará um gerenciador de locais antes dos cartões de sessão e atualizará os seletores e a prontidão após cada mutação.

**Tech Stack:** NestJS, Drizzle, Zod, Next.js App Router, React, Vitest, Jest, Turborepo.

**Spec:** `docs/superpowers/specs/2026-10-30-eventos-locais-workspace-design.md`

## Global Constraints

- Comunicação, código de domínio, commits e documentação em Português do Brasil.
- Apps acessam dados apenas pela API HTTP.
- Escopo da escola sempre vem da sessão autenticada.
- Mutação concorrente do evento usa `expectedUpdatedAt` e preserva a edição local em conflito.
- Executar `pnpm turbo lint && pnpm turbo typecheck` antes de concluir.

## Review Focus

- Local de outra escola enviado por ID: rejeitar com código de escopo e não alterar o evento.
- Definição de padrão para local inexistente ou removido: rejeitar sem perder o padrão atual.
- Edição de local usado por sessão: preservar referências e atualizar apenas os dados descritivos.
- Troca de padrão com sessões herdadas e exceções: herdadas passam a usar o novo padrão; exceções permanecem inalteradas.
- Falha de rede/conflito durante cadastro ou definição do padrão: manter formulário e indicar erro acionável.

### Task 1: API e contratos de locais

**Files:**
- Modify: `packages/shared/src/schemas/eventos.ts`
- Modify: `services/api/src/modules/eventos/eventos-admin.controller.ts`
- Modify: `services/api/src/modules/eventos/eventos.service.ts`
- Test: `services/api/src/modules/eventos/eventos.service.spec.ts`
- Test: `services/api/src/modules/eventos/eventos.controller.spec.ts`

**Interfaces:**
- `localEventoSchema`: `{ name: string; address: string; room?: string | null; instructions?: string | null; accessibility?: string | null }`.
- `GET /eventos/admin/:id/locais` retorna `{ success: true, data: { items: EventoLocalOption[]; defaultLocationId: string | null; updatedAt: string } }`.
- `POST /eventos/admin/:id/locais` retorna o local criado.
- `PATCH /eventos/admin/:id/locais/:locationId` atualiza campos descritivos.
- `PATCH /eventos/admin/:id/local-padrao` recebe `{ locationId: string | null; expectedUpdatedAt?: string }` e retorna o evento resumido com `defaultLocationId`.

- [ ] **Step 1: Write failing API tests** para CRUD, escopo de escola, local padrão inválido, auditoria e conflito de versão.
- [ ] **Step 2: Run focused API tests and confirm failure.**
- [ ] **Step 3: Implement schemas, service methods and controller routes**, usando `assertSchoolScope`, validando pertencimento do local e mantendo `defaultLocationId` quando a mutação falhar.
- [ ] **Step 4: Run focused API/controller tests and confirm pass.**
- [ ] **Step 5: Commit** `feat: adiciona api de locais do evento`.

### Task 2: Gerenciador visual de locais

**Files:**
- Create: `apps/eventos-admin/features/eventos/event-location-manager.tsx`
- Create: `apps/eventos-admin/features/eventos/event-location-manager.test.tsx`
- Create: `apps/eventos-admin/features/eventos/event-location-contracts.ts`
- Create: `apps/eventos-admin/features/eventos/event-location-contracts.test.ts`

**Interfaces:**
- `type EventoLocalOption = { id: string; name: string; address: string; room: string | null; instructions: string | null; accessibility: string | null; isDefault: boolean }`.
- `type EventoLocalDraft = Omit<EventoLocalOption, "id" | "isDefault">`.
- `validarLocal(draft): { ok: boolean; errors: Partial<Record<"name" | "address", string>> }`.
- `EventLocationManager` props: `{ eventId: string; initialItems: EventoLocalOption[]; initialDefaultLocationId: string | null; initialUpdatedAt: string | null; onChanged(): void }`.

- [ ] **Step 1: Write failing contract and component tests** para campos obrigatórios, estado vazio, cadastro, edição, definição do padrão, carregamento e erro.
- [ ] **Step 2: Run focused tests and confirm failure.**
- [ ] **Step 3: Implement the contracts and manager** with formulário acessível, confirmação visual do padrão, preservação dos dados em erro e callback após sucesso.
- [ ] **Step 4: Run focused tests and confirm pass.**
- [ ] **Step 5: Commit** `feat: cria gerenciador visual de locais`.

### Task 3: Integração no Workspace e nas sessões

**Files:**
- Modify: `apps/eventos-admin/app/eventos/[id]/sessoes/page.tsx`
- Modify: `apps/eventos-admin/app/eventos/[id]/sessoes/page.test.ts`
- Modify: `apps/eventos-admin/features/eventos/session-card-contracts.ts`
- Modify: `apps/eventos-admin/features/eventos/session-editor.tsx`
- Test: `apps/eventos-admin/features/eventos/session-editor.test.tsx`

**Interfaces:**
- A página carrega `GET /locais` junto de `GET /sessoes/opcoes`.
- Após `onChanged`, recarrega locais/opções, chama `router.refresh()` e preserva rascunhos das sessões.
- `SessionOptions.defaultLocation` e `locations` refletem o cadastro atualizado.

- [ ] **Step 1: Write failing integration tests** para estado sem locais, cadastro que libera o seletor, definição do padrão e troca de padrão sem modificar exceções.
- [ ] **Step 2: Run focused page/editor tests and confirm failure.**
- [ ] **Step 3: Integrate the manager above the cards**, atualizar o carregamento de opções e remover mensagens que orientam o usuário a sair do Workspace.
- [ ] **Step 4: Run focused page/editor tests and confirm pass.**
- [ ] **Step 5: Commit** `feat: integra locais ao workspace de sessoes`.

### Task 4: Prontidão, verificação e revisão final

**Files:**
- Modify: `services/api/src/modules/eventos/eventos-readiness.service.spec.ts`
- Modify: `apps/eventos-admin/features/eventos/workspace-shell.test.tsx`
- Test: suites do módulo de eventos e eventos-admin.

- [ ] **Step 1: Add readiness tests** garantindo que uma sessão herdada usa o novo `defaultLocationId`, que uma exceção continua válida e que a ausência de local permanece bloqueadora.
- [ ] **Step 2: Run focused readiness and workspace tests.**
- [ ] **Step 3: Run `pnpm --filter @essencia/eventos-admin test` and API event tests.**
- [ ] **Step 4: Run `pnpm turbo lint && pnpm turbo typecheck`.**
- [ ] **Step 5: Run `git diff --check` and review the complete branch.**
- [ ] **Step 6: Commit any test-only adjustments and prepare the branch for final review.**

## Self-review

A spec coverage check maps the intent, API, UI, inheritance behavior, conflict handling and readiness to Tasks 1–4. The API contract names match the existing `eventoLocais` fields and the page's `SessionOptions`; no database migration is needed. The five review-focus cases each have an owning task and test requirement.
