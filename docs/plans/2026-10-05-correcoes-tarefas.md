# Plano de Implementação: Correções do Módulo de Tarefas

> **Para o agente:** usar o ciclo TDD em cada tarefa: teste falhando, implementação mínima, teste passando e refatoração.

**Objetivo:** alinhar os contratos do módulo de tarefas entre API, banco e frontend e corrigir as transições e consultas que hoje produzem resultados incorretos.

**Arquitetura:** a API será a fonte do contrato de criação, listagem e estatísticas. O frontend enviará dados normalizados e consumirá envelopes de resposta de forma explícita. A máquina de estados será protegida por atualizações condicionais no banco; eventos automáticos usarão um ator sistêmico válido e chaves de idempotência.

**Tecnologias:** NestJS, Drizzle, PostgreSQL, Zod, Next.js, React, Vitest e Jest.

---

### Tarefa 1: Corrigir o contrato de criação manual

**Arquivos:**
- Modificar: `services/api/src/modules/tarefas/dto/tarefas.dto.ts`
- Modificar: `apps/tarefas/app/tarefa-form.tsx`
- Modificar: `apps/tarefas/app/criar/criar-form.tsx`
- Modificar: `apps/tarefas/features/criar-tarefa/hooks/use-criar-tarefa.ts`
- Testar: testes do schema e do formulário quando disponíveis; teste de controller a criar

Escrever testes que aceitem criação manual sem `tipoOrigem`, com `contextos` como array e com data de formulário normalizada. Remover `tipoOrigem` do input manual público e manter `MANUAL` no service.

### Tarefa 2: Implementar todos os filtros e ordenação da listagem

**Arquivos:**
- Modificar: `services/api/src/modules/tarefas/dto/tarefas.dto.ts`
- Modificar: `services/api/src/modules/tarefas/tarefas.service.ts`
- Modificar: `apps/tarefas/features/tarefas-list/hooks/use-tarefas.ts`
- Testar: `services/api/src/modules/tarefas/tarefas.service.spec.ts`

Adicionar `tipo` ao schema, aplicar filtros de tarefa e de contexto, respeitar `orderBy`/`orderDir` e retornar contextos quando a listagem precisar deles. Escrever testes para cada filtro essencial e para a ordenação.

### Tarefa 3: Unificar o contrato de estatísticas

**Arquivos:**
- Modificar: `services/api/src/modules/tarefas/tarefas.service.ts`
- Modificar: `packages/shared/src/types/tarefas.ts`
- Modificar: `apps/tarefas/features/tarefas-list/hooks/use-tarefas.ts`
- Modificar: `packages/components/src/tarefas/tarefa-badge-container.tsx`
- Testar: service e componentes consumidores

Definir um único formato com `total`, `pendentes`, `concluidas`, `canceladas`, `atrasadas` e `proximasVencer`. Usar uma consulta agregada e consumir explicitamente `response.data`.

### Tarefa 4: Corrigir transições e histórico

**Arquivos:**
- Modificar: `services/api/src/modules/tarefas/tarefas.service.ts`
- Modificar: `services/api/src/modules/tarefas/tarefa-historico.service.ts`
- Testar: `services/api/src/modules/tarefas/tarefas.service.spec.ts`

Impedir conclusão de tarefas canceladas, tornar conclusão e cancelamento condicionais ao estado pendente e garantir que falha de histórico não seja silenciosa. Validar idempotência e histórico em testes.

### Tarefa 5: Corrigir tarefas automáticas e eventos

**Arquivos:**
- Modificar: `services/api/src/modules/tarefas/tarefas-eventos.service.ts`
- Modificar: `packages/db/src/schema/tarefas.ts`
- Criar: migration para o identificador sistêmico e/ou idempotência
- Testar: `services/api/src/modules/tarefas/tarefas-eventos.service.spec.ts`

Usar ator sistêmico válido, selecionar responsáveis dentro do contexto da unidade, concluir a tarefa no evento final e evitar duplicatas por evento. Alinhar o tipo de `quinzenaId` com o domínio de planejamento.

### Tarefa 6: Validar datas, notificações e regressões

**Arquivos:**
- Modificar: `apps/tarefas/lib/prazo-utils.ts`
- Modificar: `apps/tarefas/features/notificacoes/tarefa-notificacao-provider.tsx`
- Testar: `apps/tarefas` e API

Corrigir a semântica de atraso, evitar notificações antes do carregamento e reduzir consultas duplicadas. Executar testes direcionados, lint e typecheck do monorepo.
