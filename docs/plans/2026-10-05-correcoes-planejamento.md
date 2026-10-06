# Correções do Módulo Planejamento — Plano de Implementação

> **Para Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para implementar este plano tarefa por tarefa.

**Objetivo:** Corrigir os defeitos funcionais e de consistência prioritários identificados no módulo planejamento, mantendo o fluxo de aprovação, dados e documentos coerentes.

**Arquitetura:** A API continuará sendo a única camada de acesso ao banco. O fluxo de aprovação será tratado como uma máquina de estados explícita no service, e as invariantes de período e documento serão validadas no domínio antes da persistência. As alterações de interface usarão o cliente de API e feedback visual já adotados pelo app.

**Stack:** NestJS, Drizzle, PostgreSQL, Next.js, React, Vitest, Jest.

---

### Tarefa 1: Consolidar a regra de aprovação vigente

**Arquivos:**
- Revisar: `services/api/src/modules/plano-aula/plano-aula.service.ts`
- Revisar: `apps/planejamento/app/gestao/planos/planos-content.tsx`
- Testar: `services/api/src/modules/plano-aula/plano-aula.service.spec.ts`

**Passos:**
1. Confirmar no histórico de commits e no comportamento da tela se a aprovação do analista é final.
2. Se for final, remover ou redirecionar estados, endpoints e hooks antigos de coordenação sem uso.
3. Se for dupla, escrever teste falhando e ajustar a máquina de estados completa antes de alterar produção.
4. Executar os testes específicos do plano de aula.

### Tarefa 2: Reforçar invariantes de períodos

**Arquivos:**
- Modificar: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.ts`
- Testar: `services/api/src/modules/plano-aula-periodo/plano-aula-periodo.service.spec.ts`

**Passos:**
1. Escrever teste para alteração de início que invalida a data de entrega existente.
2. Executar e confirmar a falha.
3. Validar sempre as datas efetivas do período.
4. Escrever teste para renumeração sem colisão intermediária.
5. Implementar renumeração em transação com valores temporários.
6. Executar os testes específicos do período.

### Tarefa 3: Corrigir ciclo de vida dos uploads

**Arquivos:**
- Modificar: `services/api/src/modules/plano-aula/plano-aula.controller.ts`
- Modificar: `services/api/src/common/storage/storage.service.ts` somente se necessário
- Testar: `services/api/src/modules/plano-aula/plano-aula.controller.spec.ts`

**Passos:**
1. Escrever teste que remova o objeto do storage quando a gravação do documento falhar.
2. Executar e confirmar a falha.
3. Reutilizar o buffer já lido e adicionar compensação de storage no erro do banco.
4. Executar os testes do controller e storage.

### Tarefa 4: Melhorar feedback das ações de documentos

**Arquivos:**
- Modificar: `apps/planejamento/features/plano-aula/components/documento-list.tsx`
- Testar: `apps/planejamento/features/plano-aula/components/documento-list.test.tsx`

**Passos:**
1. Escrever testes para erro visível ao aprovar/desaprovar e para confirmação antes de imprimir.
2. Executar e confirmar as falhas.
3. Ajustar a ordem das ações e mensagens de erro.
4. Executar o teste do componente.

### Tarefa 5: Validar o conjunto afetado

**Passos:**
1. Executar testes da API e do app planejamento.
2. Executar `pnpm turbo lint && pnpm turbo typecheck`.
3. Corrigir regressões que surgirem.
4. Revisar o diff e registrar limitações restantes.
