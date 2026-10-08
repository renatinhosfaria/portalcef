# Correções prioritárias do módulo loja — Plano de implementação

> **Para Claude:** use a skill superpowers:executing-plans para executar este plano tarefa por tarefa.

**Objetivo:** corrigir dados fictícios, invariantes de pedido e fluxos administrativos que hoje apresentam comportamento enganoso ou incompleto.

**Arquitetura:** manter a API como fonte de verdade, aplicar a regra de quantidade no serviço de pedidos antes da reserva e tornar as telas honestas quando não houver fonte de dados real. Ajustes de UI serão pequenos e cobertos por testes de origem/componente.

**Stack:** NestJS, Drizzle, Next.js, React, Vitest, Jest, pnpm.

---

### Tarefa 1: Tornar relatórios sem fonte real explicitamente indisponíveis

**Arquivos:**
- Modificar: `apps/loja-admin/app/relatorios/page.tsx`
- Testar: `apps/loja-admin/__tests__/relatorios-page.test.tsx`

1. Escrever teste que confirme que vendas, estoque e interesse não renderizam os números estáticos.
2. Executar o teste e confirmar falha porque os mocks atuais aparecem.
3. Remover os objetos mock e renderizar estado de indisponibilidade para essas abas.
4. Manter o resumo real de pré-venda conectado à API.
5. Executar o teste e confirmar aprovação.

### Tarefa 2: Aplicar limite de duas unidades também na pronta-entrega

**Arquivos:**
- Modificar: `services/api/src/modules/shop/shop-orders.service.ts`
- Testar: `services/api/src/modules/shop/shop-orders.service.spec.ts`

1. Escrever teste para duas variantes do mesmo produto e aluno excedendo o limite em pedido normal.
2. Executar o teste e confirmar falha porque o pedido atual não rejeita o excesso.
3. Extrair validação de quantidade por produto/aluno e aplicá-la antes da reserva em `createPendingOnlineOrder`.
4. Executar os testes do serviço e confirmar aprovação.
5. Adicionar caso de nomes com diferença de maiúsculas/minúsculas.

### Tarefa 3: Corrigir filtros dos links do dashboard e remover affordances sem ação

**Arquivos:**
- Modificar: `apps/loja-admin/app/page.tsx`
- Modificar: `apps/loja-admin/app/pedidos/page.tsx`
- Modificar: `apps/loja-admin/app/estoque/page.tsx`
- Testar: testes existentes de dashboard, pedidos e estoque

1. Escrever teste que confirme leitura de `status` e `lowStock` na URL.
2. Executar e confirmar falha.
3. Inicializar os filtros a partir de `useSearchParams` e tornar os links funcionais.
4. Remover botões de configuração/histórico sem implementação para não oferecer ações mortas.
5. Executar os testes administrativos.

### Tarefa 4: Preservar imagens da galeria no catálogo público

**Arquivos:**
- Modificar: `apps/loja/app/[schoolId]/[unitId]/catalog-page-content.tsx`
- Testar: `apps/loja/__tests__/catalog.test.ts` ou teste de componente do cartão

1. Escrever teste para manter o array `images` ao transformar a resposta da API.
2. Executar e confirmar falha.
3. Adicionar `images` aos tipos e ao transformador do catálogo.
4. Executar o teste e confirmar aprovação.

### Tarefa 5: Alinhar contrato e configuração de parcelas

**Arquivos:**
- Modificar: `packages/shared/src/types/shop.ts`
- Modificar: `apps/loja-admin/app/configuracoes/page.tsx`
- Modificar: `apps/loja-admin/__tests__/configuracoes.test.tsx`
- Testar: typecheck dos pacotes envolvidos

1. Escrever teste que confirme que a configuração não promete seleção de parcelas no checkout hospedado.
2. Executar e confirmar falha.
3. Ajustar o texto e o controle para indicar que o limite fica pendente até o checkout suportar parcelamento configurável.
4. Adicionar `isPreSale` ao tipo compartilhado.
5. Executar typecheck e testes.

### Tarefa 6: Verificação final

1. Executar testes específicos de API, loja e loja-admin.
2. Executar typecheck dos três pacotes e lint.
3. Revisar diff e documentação.
4. Commitar a implementação na branch do worktree.
