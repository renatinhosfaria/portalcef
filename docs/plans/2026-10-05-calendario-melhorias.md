# Melhorias do módulo calendário — Plano de Implementação

> **Para execução:** usar a skill `superpowers:executing-plans` para implementar este plano tarefa por tarefa.

**Objetivo:** corrigir inconsistências de datas, estatísticas, formulário e integração de planejamento no módulo calendário.

**Arquitetura:** a API será a fonte das estatísticas e filtrará eventos por sobreposição de períodos. O cálculo de dias letivos ficará centralizado no serviço de calendário, usando datas civis e conjuntos de datas para evitar duplicação. A interface manterá a agenda anterior durante refreshes e sincronizará o formulário com o evento selecionado.

**Tecnologias:** NestJS, Drizzle, Zod, Next.js, React Hook Form, date-fns, Jest e Vitest.

---

### Tarefa 1: Corrigir consultas, estatísticas e validação de mutação

**Arquivos:**

- Modificar: `services/api/src/modules/calendar/calendar.service.ts`
- Modificar: `services/api/src/modules/calendar/calendar.controller.ts`
- Modificar: `packages/shared/src/schemas/calendar.ts`
- Modificar: `apps/calendario/lib/api.ts`
- Testar: `services/api/src/modules/calendar/calendar.service.spec.ts`

**Passos:**

1. Escrever testes para evento que atravessa mês/ano, estatísticas sem duplicação e atualização parcial que produziria intervalo inválido.
2. Executar os testes e confirmar falha.
3. Implementar filtros por sobreposição, cálculo de dias únicos e validação do evento mesclado.
4. Alinhar o shape de estatísticas (`year`, `totalSchoolDays`, `totalEvents`, `monthlyStats`) entre API e cliente e validar o ano recebido.
5. Executar os testes direcionados e confirmar aprovação.

### Tarefa 2: Implementar validação real de quinzena

**Arquivos:**

- Modificar: `services/api/src/modules/calendar/calendar.service.ts`
- Testar: `services/api/src/modules/calendar/calendar.service.spec.ts`

**Passos:**

1. Escrever teste para buscar o período por ID e contar dias letivos e não letivos reais.
2. Executar o teste e confirmar falha.
3. Consultar `planoAulaPeriodo`, calcular o intervalo inclusivo e retornar a validação real.
4. Cobrir período inexistente e executar os testes da API.

### Tarefa 3: Corrigir estado e datas do frontend

**Arquivos:**

- Modificar: `apps/calendario/features/calendar/components/event-form.tsx`
- Modificar: `apps/calendario/features/calendar/components/calendar-view.tsx`
- Modificar: `apps/calendario/features/calendar/components/event-card.tsx`
- Modificar: `apps/calendario/features/calendar/hooks/use-calendar-events.ts`
- Criar: `apps/calendario/features/calendar/hooks/use-calendar-stats.ts`
- Modificar: `apps/calendario/features/calendar/components/month-stats.tsx`
- Modificar: `apps/calendario/features/calendar/components/year-summary.tsx`
- Testar: testes dos componentes e hooks do calendário

**Passos:**

1. Escrever testes para reset do formulário, erro de mutação, preservação de eventos em erro de refresh e datas civis.
2. Executar os testes e confirmar falha.
3. Adicionar reset reativo, retorno explícito de sucesso, estado de refresh e proteção contra respostas obsoletas.
4. Buscar estatísticas reais por unidade/ano e passar os dados aos componentes.
5. Substituir conversões `new Date("YYYY-MM-DD")` pela utilidade civil compartilhada.
6. Executar os testes do app.

### Tarefa 4: Fechar acessibilidade e cobertura crítica

**Arquivos:**

- Modificar: `apps/calendario/features/calendar/components/day-cell.tsx`
- Modificar: `apps/calendario/features/calendar/components/calendar-header.tsx`
- Modificar: `apps/calendario/features/calendar/components/event-card.tsx`
- Criar/Modificar: testes do fluxo `CalendarView`, `EventForm` e hooks
- Modificar: `services/api/jest.config.js` se necessário para executar testes de controller

**Passos:**

1. Escrever testes de teclado, rótulos dos botões, dias adjacentes e falha de fetch.
2. Implementar elementos interativos semânticos, `aria-label`, foco e bloqueio de seleção de dias fora do mês.
3. Garantir que o teste de controller seja realmente descoberto pelo Jest.
4. Executar lint, typecheck e todos os testes direcionados.

### Tarefa 5: Verificação final

1. Executar `pnpm --filter @essencia/calendario test`.
2. Executar `pnpm --filter @essencia/api exec jest --runInBand src/modules/calendar/calendar.service.spec.ts`.
3. Executar `pnpm turbo lint && pnpm turbo typecheck`.
4. Revisar `git diff`, status do worktree e documentação do resultado.
