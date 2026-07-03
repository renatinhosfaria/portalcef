# Fluxo de Provas Direto para Analise Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enviar provas impressas diretamente da gestao para a analista pedagogica, bloqueando o envio ate todos os documentos serem impressos e espelhando a tela da analista de planos em provas.

**Architecture:** O fluxo de provas passa a usar `AGUARDANDO_ANALISTA` logo apos a impressao pela gestao, mantendo `AGUARDANDO_RESPOSTA` apenas como compatibilidade historica. A API fara a validacao de impressao completa antes da transicao e o frontend refletira a mesma regra. O contexto de tarefas ganha `provaId` para permitir tarefa vinculada a prova sem criar um modulo novo.

**Tech Stack:** NestJS, Fastify, Drizzle, PostgreSQL, Next.js App Router, React, TypeScript, Vitest, Jest, pnpm, Turborepo.

---

## Contexto Obrigatorio

Leia antes de executar:

- `docs/plans/2026-06-18-fluxo-provas-direto-analise-design.md`
- `packages/db/src/schema/prova.ts`
- `packages/db/src/schema/prova-historico.ts`
- `packages/db/src/schema/tarefas.ts`
- `services/api/src/modules/prova/prova.service.ts`
- `services/api/src/modules/prova/prova.controller.ts`
- `services/api/src/modules/prova/dto/prova.dto.ts`
- `services/api/src/modules/tarefas/dto/tarefas.dto.ts`
- `services/api/src/modules/tarefas/tarefas.service.ts`
- `apps/planejamento/app/provas/gestao/provas/[provaId]/prova-gestao-content.tsx`
- `apps/planejamento/app/provas/analise/[provaId]/revisao-content.tsx`
- `apps/planejamento/app/analise/[planoId]/revisao-content.tsx`
- `apps/planejamento/app/analise/[planoId]/tarefa-form.tsx`
- `apps/planejamento/features/prova/hooks/use-prova.ts`
- `apps/planejamento/features/plano-aula/components/documento-list.tsx`

## Regras de Execucao

- Use @superpowers:test-driven-development em toda mudanca de comportamento.
- Escreva o teste primeiro e confirme a falha pelo motivo correto.
- Rode `git status --short` antes de cada task.
- Nao reverta alteracoes locais fora do escopo.
- Commits em Portugues do Brasil somente se o usuario pedir commit.

## Task 1: Backend envia prova impressa direto para analise

**Files:**
- Test: `services/api/src/modules/prova/prova.service.spec.ts`
- Modify: `services/api/src/modules/prova/prova.service.ts`
- Modify: `services/api/src/modules/prova/prova.controller.ts`
- Modify: `services/api/src/modules/prova/dto/prova.dto.ts`

**Step 1: Escrever testes vermelhos**

Adicionar testes para:

- enviar prova de `AGUARDANDO_IMPRESSAO` para `AGUARDANDO_ANALISTA` quando todos os documentos imprimiveis tiverem `printedAt`;
- bloquear envio quando algum documento imprimivel estiver sem `printedAt`;
- ignorar `LINK_YOUTUBE` na contagem de impressao;
- registrar historico com status novo `AGUARDANDO_ANALISTA`.

**Step 2: Rodar teste focado**

Run:

```bash
pnpm --filter @essencia/api test -- prova.service.spec.ts
```

Expected: FAIL porque a gestao ainda envia para `AGUARDANDO_RESPOSTA`.

**Step 3: Implementar codigo minimo**

Adicionar metodo de dominio para gestao enviar para analise. O metodo deve validar unidade, status `AGUARDANDO_IMPRESSAO` e impressao completa. Atualizar endpoint usado pela gestao para chamar esse metodo.

**Step 4: Rodar teste focado**

Run:

```bash
pnpm --filter @essencia/api test -- prova.service.spec.ts
```

Expected: PASS.

## Task 2: Contexto de tarefas aceita provaId

**Files:**
- Modify: `packages/db/src/schema/tarefas.ts`
- Modify: `services/api/src/modules/tarefas/dto/tarefas.dto.ts`
- Modify: `services/api/src/modules/tarefas/tarefas.service.ts`
- Create: `packages/db/drizzle/<nova_migration>_tarefas_prova_contexto.sql`
- Test: teste existente de tarefas mais adequado ou novo teste focado em `services/api/src/modules/tarefas`.

**Step 1: Escrever teste vermelho**

Criar/ajustar teste para criar tarefa manual com contexto `{ modulo: "PLANEJAMENTO", provaId }`.

**Step 2: Rodar teste focado**

Expected: FAIL porque o DTO/schema ainda rejeita ou ignora `provaId`.

**Step 3: Implementar schema e migration**

Adicionar `provaId` em `tarefa_contextos`, DTOs e insercao de contextos.

**Step 4: Rodar teste focado**

Expected: PASS.

## Task 3: Frontend de gestao bloqueia envio ate impressao completa

**Files:**
- Test: `apps/planejamento/app/provas/gestao/provas/[provaId]/prova-gestao-content.test.tsx`
- Modify: `apps/planejamento/app/provas/gestao/provas/[provaId]/prova-gestao-content.tsx`
- Modify: `apps/planejamento/features/prova/hooks/use-prova.ts`

**Step 1: Escrever testes vermelhos**

Testar que:

- o botao exibe "Enviar para Analise";
- o botao fica desabilitado quando falta documento impresso;
- o botao chama a acao de enviar para analise quando todos os documentos estao impressos.

**Step 2: Rodar teste focado**

Expected: FAIL com textos/acao antigos.

**Step 3: Implementar UI**

Trocar texto, chamada de hook e regra de bloqueio por `printedAt`.

**Step 4: Rodar teste focado**

Expected: PASS.

## Task 4: Tela da analista de provas espelha plano de aula

**Files:**
- Test: `apps/planejamento/app/provas/analise/[provaId]/revisao-content.test.tsx`
- Modify: `apps/planejamento/app/provas/analise/[provaId]/revisao-content.tsx`
- Create/Move if needed: componente compartilhado de tarefa ou formulario especifico de prova
- Modify: `apps/planejamento/features/prova/hooks/use-prova.ts`

**Step 1: Escrever testes vermelhos**

Testar que a tela mostra:

- `Criar Tarefa vinculada a Prova`;
- acao de regerar PDF quando documento esta com erro;
- upload de documento corrigido;
- botoes de aprovar/devolver prova.

**Step 2: Rodar teste focado**

Expected: FAIL porque a tela ainda nao tem tarefa vinculada a prova e nao passa `onRegerarPdf`.

**Step 3: Implementar UI**

Adicionar estado do formulario de tarefa, botao, contexto com `provaId`, e hook para regerar PDF de documento de prova.

**Step 4: Rodar teste focado**

Expected: PASS.

## Task 5: Migrar provas em AGUARDANDO_RESPOSTA

**Files:**
- Create: `packages/db/drizzle/<nova_migration>_provas_resposta_para_analise.sql`
- Modify if needed: `packages/db/drizzle/meta/_journal.json`

**Step 1: Criar migration**

Migration deve atualizar provas em `AGUARDANDO_RESPOSTA` para `AGUARDANDO_ANALISTA` e atualizar `updated_at`.

**Step 2: Validar migration em build**

Run:

```bash
pnpm --filter @essencia/db build
```

Expected: PASS.

## Task 6: Validacao final

Run:

```bash
pnpm --filter @essencia/api test -- prova.service.spec.ts
pnpm --filter planejamento test -- app/provas/gestao/provas/[provaId]/prova-gestao-content.test.tsx app/provas/analise/[provaId]/revisao-content.test.tsx
pnpm turbo lint
pnpm turbo typecheck
```

Expected: todos passam. Warnings antigos podem permanecer, desde que nao haja erros.
