# Correções do Loja Admin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir os problemas operacionais mais visíveis do `loja-admin`, eliminando dados fictícios, alinhando navegação e filtros, evitando salvamentos com estado inválido e reduzindo duplicação de comportamento.

**Architecture:** Manter o padrão atual de proxy Next.js para a API e centralizar apenas contratos e componentes reutilizáveis no frontend. Os relatórios sem endpoint real não exibirão métricas inventadas; o painel informará indisponibilidade até existir contrato de API. A navegação terá uma única fonte de verdade no `AdminShell`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, Testing Library, Tailwind.

---

### Tarefa 1: Corrigir navegação e controles sem comportamento

**Arquivos:**
- Modificar: `apps/loja-admin/components/AdminShell.tsx`
- Remover: `apps/loja-admin/components/AdminSidebar.tsx`
- Testar: `apps/loja-admin/__tests__/admin-shell-navigation.test.ts`

**Passos:**
1. Escrever teste que exige `/relatorios` no shell ativo e não permite dois sidebars concorrentes.
2. Executar o teste e confirmar falha.
3. Adicionar Relatórios ao `AdminShell`, remover o componente duplicado e corrigir os links/labels.
4. Executar o teste e a suíte do módulo.

### Tarefa 2: Corrigir estoque baixo, ações sem implementação e estado de estoque

**Arquivos:**
- Modificar: `apps/loja-admin/app/estoque/page.tsx`
- Modificar: `apps/loja-admin/app/page.tsx`
- Testar: `apps/loja-admin/__tests__/inventory-page.test.tsx`

**Passos:**
1. Escrever teste que verifica leitura de `lowStock=true`, filtragem dos itens e que controles sem ação não são renderizados.
2. Executar o teste e confirmar falha.
3. Usar `useSearchParams`, filtrar alertas e remover botões de configurações/histórico até haver implementação.
4. Executar o teste e a suíte do módulo.

### Tarefa 3: Impedir fallback destrutivo nas configurações

**Arquivos:**
- Modificar: `apps/loja-admin/app/configuracoes/page.tsx`
- Testar: `apps/loja-admin/__tests__/configuracoes.test.tsx`

**Passos:**
1. Escrever teste que simula falha de leitura e confirma que os campos não recebem defaults editáveis nem permitem salvar.
2. Executar o teste e confirmar falha.
3. Manter o estado sem dados, exibir erro com retry e bloquear o formulário até uma leitura válida.
4. Executar o teste e a suíte do módulo.

### Tarefa 4: Remover dados fictícios dos relatórios

**Arquivos:**
- Modificar: `apps/loja-admin/app/relatorios/page.tsx`
- Modificar: `apps/loja-admin/__tests__/pedidos-source.test.ts`
- Criar: `apps/loja-admin/__tests__/relatorios-page.test.tsx`

**Passos:**
1. Escrever testes que rejeitam os marcadores de mock, o atraso artificial e o botão de exportação enganoso, e que exibem estado honesto para abas sem API.
2. Executar os testes e confirmar falha.
3. Remover os dados fictícios e exibir indisponibilidade nas abas sem contrato; manter apenas o resumo real de pré-venda.
4. Corrigir a dependência de `useEffect` e remover o seletor de período onde ele não tem efeito.
5. Executar os testes e a suíte do módulo.

### Tarefa 5: Consolidar contratos e validação final

**Arquivos:**
- Modificar: `apps/loja-admin/app/relatorios/page.tsx`
- Modificar: `apps/loja-admin/app/configuracoes/page.tsx`
- Modificar: `apps/loja-admin/app/estoque/page.tsx`
- Testar: suíte completa do `loja-admin`

**Passos:**
1. Extrair constantes de estado/labels apenas onde já houver duplicação comprovada.
2. Executar testes, lint e typecheck após gerar os tipos do Next.
3. Revisar diff, status e documentação do plano.
4. Criar commit em português.
