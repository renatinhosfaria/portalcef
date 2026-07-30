# Fluxos de Gestão do Workflows Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Completar a navegação e as ações de gestão de modelos, execuções e categorias no app de workflows.

**Architecture:** A página principal permanece operacional e passa a carregar todos os status de execução. Uma nova página `/modelos` concentra modelos de todos os status e abre um modal de categorias; ações específicas continuam delegadas aos endpoints HTTP existentes, com um único reforço de integridade para categorias inativas na API.

**Tech Stack:** Next.js 15, React 19, TypeScript, NestJS, Zod, Vitest, Testing Library e Jest.

---

### Task 1: Incorporar a criação inline de categoria já iniciada

**Files:**
- Modify: `apps/workflows/lib/api.ts`
- Modify: `apps/workflows/components/workflow-editor.tsx`
- Test: `apps/workflows/components/workflow-editor.test.tsx`

**Step 1: Aplicar no worktree somente o diff local desses três arquivos**

Use o diff da árvore principal sem incluir mudanças de outros módulos.

**Step 2: Executar o teste que já demonstra o comportamento**

Run: `pnpm --filter workflows test -- components/workflow-editor.test.tsx`

Expected: PASS, incluindo `cria categoria inline e seleciona a categoria criada`.

**Step 3: Executar o typecheck**

Run: `pnpm --filter workflows typecheck`

Expected: PASS.

### Task 2: Expor clientes HTTP ausentes

**Files:**
- Modify: `apps/workflows/lib/api.ts`
- Test: `apps/workflows/lib/api.test.ts`

**Step 1: Escrever testes falhando para os novos clientes**

Cobrir:

```typescript
atualizarCategoria("categoria-1", { nome: "Eventos internos" });
editarTituloExecucao("execucao-1", { titulo: "Novo título" });
descartarExecucaoTeste("execucao-1");
```

Expected endpoints:

```text
PATCH  /workflows/categorias/categoria-1
PATCH  /workflows/execucoes/execucao-1/titulo
DELETE /workflows/execucoes/execucao-1
```

**Step 2: Verificar RED**

Run: `pnpm --filter workflows test -- lib/api.test.ts`

Expected: FAIL porque as funções ainda não são exportadas.

**Step 3: Implementar os três clientes mínimos**

Retornar os tipos compartilhados adequados e manter o cliente fino.

**Step 4: Verificar GREEN**

Run: `pnpm --filter workflows test -- lib/api.test.ts`

Expected: PASS.

### Task 3: Gerenciar categorias

**Files:**
- Create: `apps/workflows/components/gerenciar-categorias-dialog.tsx`
- Create: `apps/workflows/components/gerenciar-categorias-dialog.test.tsx`

**Step 1: Escrever testes falhando**

Cobrir uma linha de categoria que:

- alterna para edição e salva o nome normalizado;
- chama `atualizarCategoria(id, { ativo: false })`;
- chama `atualizarCategoria(id, { ativo: true })`;
- mantém o modal aberto e mostra erro quando uma mutação falha.

**Step 2: Verificar RED**

Run: `pnpm --filter workflows test -- components/gerenciar-categorias-dialog.test.tsx`

Expected: FAIL porque o componente não existe.

**Step 3: Implementar o modal mínimo**

Usar `Dialog`, `Input`, `Button` e `Badge`. Receber `categorias`, `open`,
`onOpenChange` e `onCategoriasChange`. Reutilizar `criarCategoria` e
`atualizarCategoria`.

**Step 4: Verificar GREEN**

Run: `pnpm --filter workflows test -- components/gerenciar-categorias-dialog.test.tsx`

Expected: PASS.

### Task 4: Criar a página de gestão de modelos

**Files:**
- Create: `apps/workflows/app/modelos/page.tsx`
- Create: `apps/workflows/app/modelos/page.test.tsx`
- Create: `apps/workflows/components/modelo-gestao-card.tsx`
- Create: `apps/workflows/components/modelo-gestao-card.test.tsx`
- Modify: `apps/workflows/components/iniciar-execucao-dialog.tsx`
- Modify: `apps/workflows/components/iniciar-execucao-dialog.test.tsx`

**Step 1: Escrever teste falhando do diálogo de teste**

Renderizar com `teste` e verificar:

```typescript
expect(iniciarExecucao).toHaveBeenCalledWith("modelo-1", {
  titulo: "Validação do rascunho",
  teste: true,
});
```

Também verificar os textos `Iniciar teste` e `Iniciando teste...`.

**Step 2: Verificar RED do diálogo**

Run: `pnpm --filter workflows test -- components/iniciar-execucao-dialog.test.tsx`

Expected: FAIL porque a prop `teste` não existe.

**Step 3: Implementar suporte mínimo a teste**

Adicionar `teste?: boolean`, ajustar textos e incluir `teste: true` somente no
payload de teste.

**Step 4: Verificar GREEN do diálogo**

Run: `pnpm --filter workflows test -- components/iniciar-execucao-dialog.test.tsx`

Expected: PASS.

**Step 5: Escrever testes falhando do card e da página**

Cobrir:

- link de edição para todos os status;
- botão `Iniciar teste` apenas para rascunho;
- ausência de início para inativo;
- consulta `listarModelos("status=todos")`;
- filtros por status;
- botão `Gerenciar categorias`;
- bloqueio visual para usuário sem gestão.

**Step 6: Verificar RED**

Run: `pnpm --filter workflows test -- components/modelo-gestao-card.test.tsx app/modelos/page.test.tsx`

Expected: FAIL porque os componentes ainda não existem.

**Step 7: Implementar card e página mínimos**

Derivar filtros no cliente e abrir `IniciarExecucaoDialog` com `teste=true`
para rascunhos.

**Step 8: Verificar GREEN**

Run: `pnpm --filter workflows test -- components/modelo-gestao-card.test.tsx app/modelos/page.test.tsx`

Expected: PASS.

### Task 5: Completar a página operacional e a navegação das execuções

**Files:**
- Modify: `apps/workflows/app/page.tsx`
- Modify: `apps/workflows/app/page.test.tsx`
- Modify: `apps/workflows/components/execucao-card.tsx`
- Create: `apps/workflows/components/execucao-card.test.tsx`

**Step 1: Escrever testes falhando**

Cobrir:

- consulta única `listarExecucoes("status=todos")`;
- aba `Canceladas`;
- execução cancelada renderizada;
- botão `Gerenciar modelos` somente para gestão;
- card aponta para `/execucoes/:id`;
- card de teste exibe badge `Teste`.

**Step 2: Verificar RED**

Run: `pnpm --filter workflows test -- app/page.test.tsx components/execucao-card.test.tsx`

Expected: FAIL pelos comportamentos ausentes.

**Step 3: Implementar a carga e os cards mínimos**

Manter `listarModelos("status=PUBLICADO")`, carregar todas as execuções e
derivar por status com `useMemo` ou na conclusão da carga.

**Step 4: Verificar GREEN**

Run: `pnpm --filter workflows test -- app/page.test.tsx components/execucao-card.test.tsx`

Expected: PASS.

### Task 6: Editar título e descartar execução de teste

**Files:**
- Modify: `apps/workflows/components/execucao-detalhe.tsx`
- Modify: `apps/workflows/components/execucao-detalhe.test.tsx`
- Create: `apps/workflows/components/descartar-execucao-dialog.tsx`
- Create: `apps/workflows/components/descartar-execucao-dialog.test.tsx`
- Modify: `apps/workflows/app/execucoes/[execucaoId]/page.tsx`
- Modify: `apps/workflows/app/execucoes/[execucaoId]/page.test.tsx`

**Step 1: Escrever testes falhando do detalhe**

Cobrir:

- botão `Editar título`;
- validação de três caracteres;
- `onEditarTitulo(id, tituloNormalizado)`;
- botão `Descartar teste` somente para gestão e `teste=true`.

**Step 2: Verificar RED**

Run: `pnpm --filter workflows test -- components/execucao-detalhe.test.tsx`

Expected: FAIL porque props e ações não existem.

**Step 3: Implementar edição inline e diálogo de confirmação**

Bloquear interações concorrentes e preservar o título original ao cancelar.

**Step 4: Escrever teste falhando da página**

Verificar que:

```typescript
editarTituloExecucao(id, { titulo });
descartarExecucaoTeste(id);
router.push("/");
```

**Step 5: Verificar RED da página**

Run: `pnpm --filter workflows test -- app/execucoes/[execucaoId]/page.test.tsx`

Expected: FAIL porque os handlers ainda não estão conectados.

**Step 6: Conectar clientes e navegação**

Recarregar após edição e retornar à lista após descarte bem-sucedido.

**Step 7: Verificar GREEN**

Run: `pnpm --filter workflows test -- components/execucao-detalhe.test.tsx components/descartar-execucao-dialog.test.tsx app/execucoes/[execucaoId]/page.test.tsx`

Expected: PASS.

### Task 7: Preservar categoria inativa e reforçar a API

**Files:**
- Modify: `apps/workflows/components/workflow-editor.tsx`
- Modify: `apps/workflows/components/workflow-editor.test.tsx`
- Modify: `services/api/src/modules/workflows/workflows-modelos.service.ts`
- Modify: `services/api/src/modules/workflows/workflows-modelos.service.spec.ts`

**Step 1: Escrever teste frontend falhando**

Cobrir que uma categoria inativa não aparece para modelo novo, mas aparece
quando já está vinculada ao modelo editado.

**Step 2: Verificar RED frontend**

Run: `pnpm --filter workflows test -- components/workflow-editor.test.tsx`

Expected: FAIL porque todas as categorias são listadas.

**Step 3: Implementar filtro mínimo**

Derivar categorias selecionáveis com `ativo || id === modelo?.categoriaId`.

**Step 4: Verificar GREEN frontend**

Run: `pnpm --filter workflows test -- components/workflow-editor.test.tsx`

Expected: PASS.

**Step 5: Escrever teste API falhando**

Cobrir criação e troca de categoria usando categoria `ativo: false`.

**Step 6: Verificar RED API**

Run: `pnpm --filter @essencia/api test -- workflows-modelos.service`

Expected: FAIL porque a categoria inativa ainda é aceita.

**Step 7: Implementar validação mínima**

Permitir buscar a categoria atual para leitura, mas exigir `ativo=true` ao
criar ou quando `categoriaId` é enviado na atualização.

**Step 8: Verificar GREEN API**

Run: `pnpm --filter @essencia/api test -- workflows-modelos.service`

Expected: PASS.

### Task 8: Verificação final

**Files:**
- Verify: `apps/workflows/**`
- Verify: `services/api/src/modules/workflows/**`

**Step 1: Executar testes focados**

Run:

```bash
pnpm --filter workflows test
pnpm --filter @essencia/api test -- workflows-modelos.service workflows.controller
```

Expected: PASS.

**Step 2: Executar pipeline obrigatório**

Run:

```bash
pnpm turbo lint && pnpm turbo typecheck
```

Expected: PASS, aceitando apenas avisos preexistentes.

**Step 3: Revisar diff e status**

Run:

```bash
git diff --check
git status --short
```

Expected: nenhum erro de whitespace e somente arquivos do escopo.

