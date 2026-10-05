# Correções do módulo de suporte — plano de implementação

> **Para o agente:** executar este plano tarefa por tarefa, mantendo o ciclo RED-GREEN-REFACTOR.

**Objetivo:** alinhar as regras de status, validação, anexos e contagem do módulo de suporte entre API, aplicação e banco, com testes que impeçam regressões.

**Arquitetura:** as transições de status e limites de anexos serão definidos em um único módulo compartilhado. A API continuará sendo responsável pela validação final, fará limpeza compensatória dos arquivos enviados quando a persistência falhar e retornará erros estruturados. A interface consumirá as mesmas regras e exibirá a contagem completa.

**Tecnologias:** NestJS, Fastify multipart, Zod, Drizzle, Next.js, React, Jest e Vitest.

---

### Tarefa 1: Criar o contrato compartilhado do workflow e anexos

**Arquivos:**
- Modificar: `packages/shared/src/types/suporte.ts`
- Testar: `packages/shared/src/types/suporte.test.ts`

**Passos:**
1. Escrever testes para transições permitidas, transições proibidas e limite total de anexos.
2. Executar `pnpm --filter @essencia/shared test -- suporte.test.ts`; confirmar falha.
3. Adicionar `STATUS_TRANSITIONS`, `isTransicaoStatusPermitida` e constantes de limite.
4. Executar o teste novamente; confirmar aprovação.
5. Refatorar somente após os testes passarem.

### Tarefa 2: Fortalecer os schemas da API

**Arquivos:**
- Modificar: `services/api/src/modules/suporte/dto/suporte.dto.ts`
- Testar: `services/api/src/modules/suporte/suporte.controller.spec.ts`

**Passos:**
1. Adicionar testes para rejeitar título/descrição/mensagem compostos apenas por espaços e para normalizar espaços externos.
2. Executar o teste; confirmar falha.
3. Aplicar `trim` e limites mínimos nos schemas.
4. Executar o teste; confirmar aprovação.

### Tarefa 3: Aplicar transições no service e sincronizar a UI

**Arquivos:**
- Modificar: `services/api/src/modules/suporte/suporte.service.ts`
- Modificar: `apps/suporte/app/[id]/page.tsx`
- Testar: `services/api/src/modules/suporte/suporte.service.spec.ts`
- Testar: `apps/suporte/app/[id]/page.test.tsx`

**Passos:**
1. Escrever testes para impedir transição inválida e permitir as transições válidas.
2. Executar os testes; confirmar falha.
3. Validar a transição no service e reutilizar o mapa compartilhado na página.
4. Executar os testes; confirmar aprovação.

### Tarefa 4: Corrigir contrato e compensação de uploads

**Arquivos:**
- Modificar: `services/api/src/modules/suporte/suporte.controller.ts`
- Modificar: `services/api/src/modules/suporte/suporte.service.ts`
- Testar: `services/api/src/modules/suporte/suporte.controller.spec.ts`

**Passos:**
1. Escrever testes para rejeitar excesso de arquivos antes do upload e remover arquivos já enviados quando a persistência falhar.
2. Executar os testes; confirmar falha.
3. Preservar a chave do storage, validar quantidade/tipo antes do upload e executar limpeza compensatória.
4. Executar os testes; confirmar aprovação.

### Tarefa 5: Tornar a contagem coerente

**Arquivos:**
- Modificar: `packages/shared/src/types/suporte.ts`
- Modificar: `services/api/src/modules/suporte/suporte.service.ts`
- Modificar: `apps/suporte/hooks/use-ordens-servico.ts`
- Modificar: `apps/suporte/app/page.tsx`
- Testar: `services/api/src/modules/suporte/suporte.service.spec.ts`

**Passos:**
1. Escrever teste para retornar também a quantidade de OS fechadas.
2. Executar o teste; confirmar falha.
3. Adicionar o campo `fechadas` e exibi-lo no resumo da tela.
4. Executar o teste; confirmar aprovação.

### Tarefa 6: Verificação final

**Comandos:**
- `pnpm --filter suporte test`
- `pnpm --filter suporte typecheck`
- `pnpm --filter suporte lint`
- `pnpm --filter @essencia/api test -- src/modules/suporte/suporte.service.spec.ts src/modules/suporte/suporte.controller.spec.ts --runInBand`
- `pnpm turbo lint`
- `pnpm turbo typecheck`

Registrar o resultado de cada comando antes de considerar a branch pronta.
