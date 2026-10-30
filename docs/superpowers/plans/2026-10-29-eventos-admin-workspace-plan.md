# Workspace híbrido de eventos no painel administrativo — Plano de Implementação

> **Para agentes de implementação:** use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa por tarefa. Cada tarefa deve seguir RED-GREEN-REFACTOR e terminar com verificação própria.

**Objetivo:** transformar o cadastro e a publicação de eventos do Portal CEF em um workspace híbrido com criação de rascunho por título, autosave, navegação lateral, progresso e checklist de publicação.

**Arquitetura:** a API continuará sendo a autoridade para tenant, autosave, prontidão e publicação. O painel `eventos-admin` terá um shell de workspace que compõe etapas independentes e usa PATCHs parciais; o endpoint final de publicação continuará transacional e revalidará todas as regras. A herança de mapa/local permanecerá explícita por sessão.

**Stack:** NestJS + Fastify, Zod, Drizzle/PostgreSQL, Next.js App Router, React, Vitest e Jest.

**Especificação:** `docs/superpowers/specs/2026-10-29-eventos-admin-workspace-design.md`

## Restrições globais

- Comunicação, domínio, textos de interface, comentários e documentação do projeto devem permanecer em Português do Brasil.
- Apps não acessam banco diretamente; usam a API HTTP.
- Tenant vem da sessão/usuário autenticado; nunca do payload confiado do cliente.
- Guards seguem `AuthGuard` → `RolesGuard` → `TenantGuard` quando houver `TenantGuard` na rota.
- O slug é único por escola, recebe sugestão após edição manual e fica imutável depois da publicação.
- Publicação exige ao menos um assento vendável (`DISPONIVEL` ou `LIBERADO`) por unidade de capacidade; bloqueados não contam.
- Trocar o mapa padrão atualiza sessões herdadas, invalida o inventário afetado e exige revisão/regeneração.
- Toda tarefa deve escrever o teste antes da implementação e executar `pnpm turbo lint && pnpm turbo typecheck` antes da integração.

## Foco de revisão

- Criar rascunho com somente título e tenant válido, sem exigir campos de publicação.
- Autosave concorrente ou com falha de rede não pode perder a edição local nem sobrescrever uma versão mais nova.
- Sessões que herdam o mapa devem ser atualizadas quando o mapa padrão mudar; sessões com mapa próprio devem permanecer intactas.
- Inventário com quantidade suficiente, mas assentos bloqueados, deve falhar no readiness.
- Slug publicado não pode ser alterado por edição posterior do título.

---

### Task 1: Contratos de rascunho, slug e prontidão

**Arquivos:**
- Criar: `services/api/src/modules/eventos/eventos-readiness.service.ts`
- Criar: `services/api/src/modules/eventos/eventos-readiness.service.spec.ts`
- Modificar: `packages/shared/src/schemas/eventos.ts`
- Modificar: `packages/shared/src/types/eventos.ts`
- Modificar: `services/api/src/modules/eventos/eventos-admin.controller.ts`
- Modificar: `services/api/src/modules/eventos/eventos.module.ts`
- Testar: `services/api/src/modules/eventos/eventos.controller.spec.ts`

**Interfaces:**
- Produz `criarRascunhoSchema = { title: string }` e `atualizarRascunhoSchema` parcial sem `schoolId`.
- Produz `GET /eventos/admin/:id/prontidao` retornando `{ eventId, status, progress, items: Array<{ key, label, state: "BLOQUEADOR" | "AVISO" | "OK", href?: string, message?: string }> }`.
- Produz `POST /eventos/admin/rascunhos` retornando o resumo do evento criado (`id`, `title`, `slug`, `status`, `schoolId`).
- Produz `PATCH /eventos/admin/:id` com controle de versão/`updatedAt` para rejeitar conflito sem apagar a edição local.

- [ ] **Passo 1: escrever testes que falham** para criação mínima por título, normalização/uniqueness do slug, rejeição de tenant divergente e readiness com cada bloqueador.
- [ ] **Passo 2: executar os testes** com `pnpm --filter @essencia/api test -- --runInBand eventos.controller.spec.ts eventos-readiness.service.spec.ts`; confirmar falha por contratos ausentes.
- [ ] **Passo 3: implementar os schemas, o serviço de prontidão e as rotas** reutilizando `EventosRulesService`, `EventosService` e `assertSchoolScope`; a contagem de inventário deve usar apenas estados `DISPONIVEL`/`LIBERADO` e comparar com `session.capacity`.
- [ ] **Passo 4: executar os testes novamente** e confirmar PASS para criação, slug, conflitos, herança e checklist.
- [ ] **Passo 5: verificar tipos** com `pnpm --filter @essencia/api typecheck`.
- [ ] **Passo 6: commit** `feat: adiciona contratos de rascunho e prontidao de eventos`.

### Task 2: Autosave parcial e regras de slug/mapa no serviço de eventos

**Arquivos:**
- Modificar: `services/api/src/modules/eventos/eventos.service.ts`
- Modificar: `services/api/src/modules/eventos/eventos.service.spec.ts` (criar se necessário)
- Modificar: `services/api/src/modules/eventos/eventos-admin.controller.ts`
- Modificar: `packages/shared/src/schemas/eventos.ts`
- Testar: `services/api/src/modules/eventos/eventos.controller.spec.ts`

**Interfaces:**
- `atualizarEvento(id, input, actor, expectedUpdatedAt?)` deve retornar resumo atualizado ou erro de conflito.
- `atualizarMapaPadrao(eventId, mapId, actor)` deve propagar somente para sessões com `mapId = null`, marcar seus inventários para regeneração/revisão e auditar a operação.
- Slug publicado deve ser rejeitado com `EVENT_SLUG_IMMUTABLE`; slug manual em rascunho não pode ser substituído silenciosamente pelo título.

- [ ] **Passo 1: escrever testes que falham** para PATCH parcial por etapa, conflito de versão, slug imutável, sugestão sem aplicação automática e propagação exclusiva para sessões herdadas.
- [ ] **Passo 2: executar os testes** e confirmar falha.
- [ ] **Passo 3: implementar os PATCHs parciais** sem regravar sessões, ingressos ou políticas; persistir auditoria com etapa e valores anteriores/novos.
- [ ] **Passo 4: implementar a troca de mapa padrão** dentro de transação, mantendo sessões com mapa específico e invalidando o inventário herdado.
- [ ] **Passo 5: executar testes e typecheck** com `pnpm --filter @essencia/api test -- --runInBand eventos.controller.spec.ts eventos.service.spec.ts` e `pnpm --filter @essencia/api typecheck`.
- [ ] **Passo 6: commit** `feat: suporta autosave e heranca de mapas em eventos`.

### Task 3: Shell do workspace e navegação lateral

**Arquivos:**
- Criar: `apps/eventos-admin/features/eventos/workspace-shell.tsx`
- Criar: `apps/eventos-admin/features/eventos/workspace-status.tsx`
- Criar: `apps/eventos-admin/features/eventos/workspace-navigation.tsx`
- Criar: `apps/eventos-admin/features/eventos/workspace-shell.test.tsx`
- Modificar: `apps/eventos-admin/app/eventos/[id]/layout.tsx`
- Modificar: `apps/eventos-admin/app/eventos/[id]/page.tsx`
- Modificar: `apps/eventos-admin/app/globals.css`

**Interfaces:**
- `WorkspaceShell({ eventId, children, readiness, lastSavedAt, saveState })` renderiza cabeçalho, navegação lateral e conteúdo.
- `WorkspaceNavigation({ eventId, items })` recebe itens com `key`, `label`, `href`, `state` e `blocked`.
- `SaveState` é `"idle" | "saving" | "saved" | "error" | "conflict"`.

- [ ] **Passo 1: escrever testes que falham** para renderização das seis etapas, indicação do estado ativo, status do evento, mensagem de salvamento e link para pendência.
- [ ] **Passo 2: executar `pnpm --filter @essencia/eventos-admin test -- workspace-shell.test.tsx`** e confirmar falha.
- [ ] **Passo 3: implementar o shell** sem duplicar lógica de negócio nas páginas filhas; manter identidade visual Portal CEF e suporte a teclado/foco.
- [ ] **Passo 4: executar o teste** e confirmar PASS.
- [ ] **Passo 5: executar `pnpm --filter @essencia/eventos-admin typecheck`**.
- [ ] **Passo 6: commit** `feat: cria workspace administrativo de eventos`.

### Task 4: Criação por título e hook de autosave no cliente

**Arquivos:**
- Criar: `apps/eventos-admin/features/eventos/use-evento-autosave.ts`
- Criar: `apps/eventos-admin/features/eventos/use-evento-autosave.test.ts`
- Criar: `apps/eventos-admin/features/eventos/evento-draft-form.tsx`
- Criar: `apps/eventos-admin/features/eventos/evento-draft-form.test.tsx`
- Modificar: `apps/eventos-admin/app/eventos/novo/page.tsx`
- Modificar: `apps/eventos-admin/app/eventos/page.tsx`

**Interfaces:**
- `createDraft(title: string) -> Promise<EventoResumo>` chama `POST /eventos-admin/api/eventos/admin/rascunhos` e navega para `/eventos/:id/informacoes`.
- `useEventoAutosave<T>({ eventId, value, dirty, serialize, save }) -> { state, lastSavedAt, conflict, retry }` agrupa alterações, mantém valor local em falha e não envia valores obsoletos.

- [ ] **Passo 1: escrever testes que falham** para criação após título, slug exibido, debounce, retry, erro de rede e conflito.
- [ ] **Passo 2: executar os testes** com Vitest e confirmar falha.
- [ ] **Passo 3: implementar o hook e a tela mínima**; o rascunho deve ser criado uma vez, e o título não deve ser enviado novamente como criação.
- [ ] **Passo 4: executar os testes** e confirmar PASS.
- [ ] **Passo 5: executar lint/typecheck do app**.
- [ ] **Passo 6: commit** `feat: cria rascunhos de eventos com autosave`.

### Task 5: Etapas de informações, sessões, ingressos e políticas

**Arquivos:**
- Criar: `apps/eventos-admin/app/eventos/[id]/informacoes/page.tsx`
- Criar: `apps/eventos-admin/app/eventos/[id]/ingressos/page.tsx`
- Criar: `apps/eventos-admin/app/eventos/[id]/politicas/page.tsx`
- Modificar: `apps/eventos-admin/app/eventos/[id]/sessoes/page.tsx`
- Modificar: `apps/eventos-admin/features/eventos/evento-form.tsx`
- Modificar: `apps/eventos-admin/features/eventos/session-editor.tsx`
- Criar: testes Vitest correspondentes para cada etapa.

**Interfaces:**
- Cada etapa carrega o estado salvo pelo endpoint administrativo e envia somente seu contrato via `useEventoAutosave`.
- A etapa de informações controla `title`, `slug`, `summary`, `description`, `imageUrl`, `category`, `contactEmail`, `contactPhone` e `cancellationPolicy`.
- Sessões usam `POST/PATCH /eventos/admin/:id/sessoes` e exibem herança de local/mapa sem expor IDs como campo principal.
- Ingressos e políticas usam endpoints próprios e mostram versões ativas.

- [ ] **Passo 1: escrever testes que falham** para autosave por etapa, edição manual do slug, sessão herdada, sessão com exceção, preço em centavos e cinco políticas obrigatórias.
- [ ] **Passo 2: executar os testes** e confirmar falha.
- [ ] **Passo 3: implementar as telas** usando componentes focados; substituir o formulário monolítico da criação por etapas reutilizáveis no workspace.
- [ ] **Passo 4: executar testes e typecheck** do app.
- [ ] **Passo 5: commit** `feat: implementa etapas editaveis do workspace de eventos`.

### Task 6: Mapa, confirmação e inventário no fluxo do workspace

**Arquivos:**
- Modificar: `apps/eventos-admin/app/eventos/[id]/mapa/page.tsx`
- Modificar: `apps/eventos-admin/app/eventos/[id]/inventario/page.tsx`
- Modificar: `apps/eventos-admin/features/eventos/map-review.tsx`
- Modificar: `apps/eventos-admin/features/eventos/inventory-grid.tsx`
- Criar: testes para troca de mapa herdado e inventário vendável.
- Modificar: serviços/rotas de mapas apenas se os contratos da Tarefa 2 exigirem.

**Interfaces:**
- A confirmação de mapa informa a revisão do inventário afetado e seus eventos de prontidão.
- O inventário exibe capacidade, assentos vendáveis, bloqueados e ação de regenerar/revisar.

- [ ] **Passo 1: escrever testes que falham** para mapa `EM_REVISAO`, confirmação, propagação e bloqueados que não satisfazem capacidade.
- [ ] **Passo 2: executar os testes** e confirmar falha.
- [ ] **Passo 3: implementar as mensagens e ações** sem permitir que o cliente marque inventário como pronto sem a API.
- [ ] **Passo 4: executar testes e typecheck**.
- [ ] **Passo 5: commit** `feat: integra mapas e inventario ao workspace`.

### Task 7: Revisão final e publicação

**Arquivos:**
- Criar: `apps/eventos-admin/app/eventos/[id]/revisar/page.tsx`
- Criar: `apps/eventos-admin/features/eventos/publication-checklist.tsx`
- Criar: `apps/eventos-admin/features/eventos/publication-checklist.test.tsx`
- Modificar: `apps/eventos-admin/app/eventos/[id]/page.tsx`
- Modificar: `services/api/src/modules/eventos/eventos-admin.controller.ts` apenas para expor readiness/publicação conforme Tarefa 1.

**Interfaces:**
- `PublicationChecklist({ items, onPublish, publishing })` renderiza bloqueadores, avisos, links por etapa e resumo da prévia salva.
- Publicação chama `POST /eventos-admin/api/eventos/admin/:id/publicar`; sucesso muda o workspace para `PUBLICADO`, erro atualiza readiness.

- [ ] **Passo 1: escrever testes que falham** para bloqueio com pendências, publicação habilitada somente com todos os itens OK, erro concorrente e slug imutável.
- [ ] **Passo 2: executar os testes** e confirmar falha.
- [ ] **Passo 3: implementar revisão, prévia salva e ação de publicação**; nenhuma regra final deve existir apenas no React.
- [ ] **Passo 4: executar testes** e confirmar PASS.
- [ ] **Passo 5: executar lint/typecheck** do app e da API.
- [ ] **Passo 6: commit** `feat: adiciona checklist e publicacao de eventos`.

### Task 8: Verificação integrada e documentação operacional

**Arquivos:**
- Modificar: `docs/superpowers/specs/2026-10-29-eventos-admin-workspace-design.md` somente se a implementação revelar decisão aprovada diferente.
- Criar/atualizar: testes de integração do módulo de eventos conforme harness existente.
- Atualizar: documentação do módulo de eventos e contratos públicos, se houver documentação correspondente.

- [ ] **Passo 1: executar testes focados** da API, DB e `eventos-admin`.
- [ ] **Passo 2: executar `pnpm turbo lint && pnpm turbo typecheck`**.
- [ ] **Passo 3: executar build de `@essencia/api` e `@essencia/eventos-admin`**.
- [ ] **Passo 4: testar manualmente o fluxo: título → rascunho → autosave → mapa → inventário → checklist → publicação, incluindo falha de rede e troca de mapa herdado**.
- [ ] **Passo 5: revisar diff, auditoria, tenant e ausência de acesso direto ao banco no app**.
- [ ] **Passo 6: commit** `test: valida fluxo completo do workspace de eventos`.
