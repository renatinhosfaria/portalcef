# Melhorias do módulo de turmas — Plano de Implementação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Objetivo:** Corrigir os principais problemas funcionais do módulo de turmas sem alterar o escopo de segurança.

**Arquitetura:** O ciclo normal da turma usará `isActive=false` para arquivamento, preservando os vínculos pedagógicos. A API continuará sendo a autoridade para validação de unidade, etapa e professora; o frontend usará uma matriz de capacidades única para renderizar apenas ações válidas e exibirá o contexto completo da turma.

**Stack:** NestJS, Drizzle ORM, PostgreSQL, Next.js, React, Zod, Vitest e Jest.

---

### Tarefa 1: Cobrir as regras de domínio do service

**Arquivos:**

- Alterar: `services/api/src/modules/turmas/turmas.service.spec.ts`
- Alterar: `services/api/src/modules/turmas/turmas.service.ts`
- Alterar: `packages/shared/src/schemas/turmas.ts`

**Passos:**

1. Escrever testes falhos para rejeitar professora inativa, arquivar uma turma sem apagar o registro e impedir criação com etapa não atribuída à unidade.
2. Executar os testes direcionados e confirmar as falhas.
3. Implementar as validações mínimas e o método de arquivamento.
4. Executar novamente os testes e cobrir conflitos/retornos vazios.

### Tarefa 2: Ajustar o contrato da API e a listagem

**Arquivos:**

- Alterar: `services/api/src/modules/turmas/turmas.controller.ts`
- Alterar: `services/api/src/modules/turmas/turmas.service.ts`
- Alterar: `apps/turmas/lib/api.ts`

**Passos:**

1. Validar o contrato do endpoint de arquivamento e da consulta com etapa e unidade.
2. Executar os testes e confirmar a falha.
3. Adicionar o endpoint explícito e carregar as relações necessárias.
4. Manter o `DELETE` legado como alias de arquivamento, sem usá-lo no fluxo normal da tela.

### Tarefa 3: Alinhar a experiência da tela

**Arquivos:**

- Alterar: `apps/turmas/app/page.tsx`
- Alterar: `apps/turmas/components/turmas-page-content.tsx`
- Alterar: `apps/turmas/components/turmas-list.tsx`
- Alterar: `apps/turmas/components/turma-form.tsx`
- Alterar: `apps/turmas/components/gerenciar-professora-dialog.tsx`
- Testar: `apps/turmas/app/page.test.tsx`
- Criar: `apps/turmas/lib/capabilities.test.ts`

**Passos:**

1. Escrever testes para a matriz de capacidades e validar o carregamento da tela.
2. Implementar a matriz de capacidades e o estado de arquivamento.
3. Adicionar colunas de unidade/etapa, acessibilidade básica e estados vazios distintos, limpando opções antigas quando a troca de contexto falhar.
4. Executar todos os testes do app.

### Tarefa 4: Limpeza e verificação

**Arquivos:**

- Remover: `apps/turmas/components/turmas-list.NEW.tsx`
- Remover: `apps/turmas/components/turma-card.tsx`
- Alterar: `docs/API.md`
- Alterar: `docs/DATABASE.md`

**Passos:**

1. Remover implementações mortas e corrigir a documentação do ciclo de vida.
2. Executar `pnpm --filter @essencia/turmas test -- --run`.
3. Executar `pnpm turbo lint --filter=@essencia/turmas --filter=@essencia/api`.
4. Executar `pnpm turbo typecheck --filter=@essencia/turmas --filter=@essencia/api`.
5. Revisar `git diff --check` e o diff final.
