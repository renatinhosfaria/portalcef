# Upload de Documentos pela Analista Pedagógica - Plano de Implementação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir que a analista pedagógica faça upload de documentos corrigidos diretamente na tela de análise, sem precisar devolver o plano para a professora.

**Architecture:** Expandir os roles permitidos nos endpoints existentes de upload/link para incluir `analista_pedagogico`, ajustar a validação de propriedade no controller, e renderizar o componente `DocumentoUpload` existente no painel de Ações da tela de revisão.

**Tech Stack:** NestJS (backend), Next.js + React (frontend), componentes existentes reutilizados

---

### Task 1: Backend — Expandir roles no endpoint de upload

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.controller.ts:217-218`

**Step 1: Alterar decorator @Roles do endpoint uploadDocumento**

Na linha 218, mudar de `PROFESSORA_ACCESS` para incluir `ANALISTA_ACCESS`:

```typescript
// Antes (linha 218):
@Roles(...PROFESSORA_ACCESS)

// Depois:
@Roles(...PROFESSORA_ACCESS, ...ANALISTA_ACCESS)
```

**Step 2: Ajustar validação de propriedade do plano no upload**

Nas linhas 239-246, a validação atual rejeita qualquer usuário que não seja o dono do plano. Precisa permitir analista:

```typescript
// Antes (linhas 239-246):
// Verificar se plano existe e pertence ao usuário
const plano = await this.planoAulaService.getPlanoById(user, planoId);
if (plano.user.id !== user.userId) {
  throw new BadRequestException({
    code: "NOT_OWNER",
    message: "Apenas o autor pode anexar documentos ao plano",
  });
}

// Depois:
// Verificar se plano existe e usuário tem acesso
const plano = await this.planoAulaService.getPlanoById(user, planoId);
const isOwner = plano.user.id === user.userId;
const isAnalistaUser = ANALISTA_ROLES.includes(user.role as typeof ANALISTA_ROLES[number]);
if (!isOwner && !isAnalistaUser) {
  throw new BadRequestException({
    code: "NOT_AUTHORIZED",
    message: "Você não tem permissão para anexar documentos a este plano",
  });
}
```

**Step 3: Verificar que lint e typecheck passam**

Run: `pnpm turbo lint --filter=api && pnpm turbo typecheck --filter=api`
Expected: sem erros

**Step 4: Commit**

```bash
git add services/api/src/modules/plano-aula/plano-aula.controller.ts
git commit -m "feat(plano-aula): permitir analista fazer upload de documentos"
```

---

### Task 2: Backend — Expandir roles no endpoint de link YouTube

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.controller.ts:340-341`

**Step 1: Alterar decorator @Roles do endpoint adicionarLinkYouTube**

Na linha 341, mudar de `PROFESSORA_ACCESS` para incluir `ANALISTA_ACCESS`:

```typescript
// Antes (linha 341):
@Roles(...PROFESSORA_ACCESS)

// Depois:
@Roles(...PROFESSORA_ACCESS, ...ANALISTA_ACCESS)
```

**Step 2: Ajustar validação de propriedade do plano no link**

Nas linhas 365-372, aplicar a mesma lógica do upload:

```typescript
// Antes (linhas 365-372):
// Verificar se plano existe e pertence ao usuário
const plano = await this.planoAulaService.getPlanoById(user, planoId);
if (plano.user.id !== user.userId) {
  throw new BadRequestException({
    code: "NOT_OWNER",
    message: "Apenas o autor pode anexar documentos ao plano",
  });
}

// Depois:
// Verificar se plano existe e usuário tem acesso
const plano = await this.planoAulaService.getPlanoById(user, planoId);
const isOwner = plano.user.id === user.userId;
const isAnalistaUser = ANALISTA_ROLES.includes(user.role as typeof ANALISTA_ROLES[number]);
if (!isOwner && !isAnalistaUser) {
  throw new BadRequestException({
    code: "NOT_AUTHORIZED",
    message: "Você não tem permissão para anexar documentos a este plano",
  });
}
```

**Step 3: Verificar que lint e typecheck passam**

Run: `pnpm turbo lint --filter=api && pnpm turbo typecheck --filter=api`
Expected: sem erros

**Step 4: Commit**

```bash
git add services/api/src/modules/plano-aula/plano-aula.controller.ts
git commit -m "feat(plano-aula): permitir analista adicionar links YouTube"
```

---

### Task 3: Frontend — Adicionar upload no painel de Ações da revisão

**Files:**
- Modify: `apps/planejamento/app/analise/[planoId]/revisao-content.tsx`

**Step 1: Importar o componente DocumentoUpload**

Na linha 47, o import já puxa do barrel `../../../features/plano-aula`. Adicionar `DocumentoUpload` ao import existente:

```typescript
// Antes (linhas 40-47):
import {
  DocumentoList,
  HistoricoTimeline,
  PlanoStatusBadge,
  useAnalistaActions,
  usePlanoAula,
  usePlanoDetalhe,
} from "../../../features/plano-aula";

// Depois:
import {
  DocumentoList,
  DocumentoUpload,
  HistoricoTimeline,
  PlanoStatusBadge,
  useAnalistaActions,
  usePlanoAula,
  usePlanoDetalhe,
} from "../../../features/plano-aula";
```

**Step 2: Extrair uploadDocumento e addLink do hook usePlanoAula**

Na linha 80-81, adicionar `uploadDocumento` e `addLink` à desestruturação:

```typescript
// Antes (linhas 80-81):
const { aprovarDocumento, imprimirDocumento, editarComentario, deletarComentario } =
  usePlanoAula();

// Depois:
const { uploadDocumento, addLink, aprovarDocumento, imprimirDocumento, editarComentario, deletarComentario } =
  usePlanoAula();
```

**Step 3: Criar handlers de upload e link**

Adicionar após o `handleImprimirDocumento` (após a linha 224):

```typescript
/**
 * Upload de documento pela analista
 */
const handleUploadDocumento = useCallback(
  async (file: File) => {
    if (!plano) return;
    try {
      await uploadDocumento(plano.id, file);
      await refetch();
      setSuccessMessage("Documento enviado com sucesso!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao enviar documento";
      setActionError(message);
    }
  },
  [plano, uploadDocumento, refetch],
);

/**
 * Adicionar link YouTube pela analista
 */
const handleAddLink = useCallback(
  async (url: string) => {
    if (!plano) return;
    try {
      await addLink(plano.id, url);
      await refetch();
      setSuccessMessage("Link adicionado com sucesso!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao adicionar link";
      setActionError(message);
    }
  },
  [plano, addLink, refetch],
);
```

**Step 4: Renderizar DocumentoUpload no painel de Ações**

No Card de "Ações" (linhas 467-545), adicionar o componente de upload **após** o aviso sobre comentários (após a linha 533) e antes do fechamento do bloco `canPerformActions`:

O upload precisa ficar disponível **independente** do status do plano. Então adicionamos FORA do bloco `canPerformActions`, mas ainda dentro do CardContent. Substituir o trecho do CardContent:

```typescript
// Antes (linhas 476-544):
<CardContent className="space-y-3">
  {canPerformActions ? (
    <>
      {/* Botao Aprovar */}
      {/* ... botões existentes ... */}
      <p className="text-xs text-muted-foreground text-center">
        Adicione comentarios aos documentos via painel flutuante
        antes de devolver.
      </p>
    </>
  ) : (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        Este plano nao esta no status &quot;Aguardando
        Analise&quot;. Nenhuma acao disponivel.
      </AlertDescription>
    </Alert>
  )}
</CardContent>

// Depois:
<CardContent className="space-y-3">
  {canPerformActions ? (
    <>
      {/* Botao Aprovar */}
      {/* ... botões existentes mantidos iguais ... */}
      <p className="text-xs text-muted-foreground text-center">
        Adicione comentarios aos documentos via painel flutuante
        antes de devolver.
      </p>
    </>
  ) : (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        Este plano nao esta no status &quot;Aguardando
        Analise&quot;. Nenhuma acao disponivel.
      </AlertDescription>
    </Alert>
  )}

  {/* Upload de documento pela analista */}
  <div className="border-t pt-3">
    <p className="text-sm font-medium mb-2">Enviar Documento Corrigido</p>
    <DocumentoUpload
      onUpload={handleUploadDocumento}
      onAddLink={handleAddLink}
      disabled={!plano}
    />
  </div>
</CardContent>
```

**Step 5: Verificar que lint e typecheck passam**

Run: `pnpm turbo lint --filter=planejamento && pnpm turbo typecheck --filter=planejamento`
Expected: sem erros

**Step 6: Commit**

```bash
git add apps/planejamento/app/analise/[planoId]/revisao-content.tsx
git commit -m "feat(planejamento): adicionar upload de documentos na tela de análise"
```

---

### Task 4: Verificação final

**Step 1: Rodar lint e typecheck do monorepo**

Run: `pnpm turbo lint && pnpm turbo typecheck`
Expected: sem erros

**Step 2: Rodar testes existentes da API**

Run: `pnpm turbo test --filter=api`
Expected: todos passam (nenhum teste existente quebrado)

**Step 3: Verificar build do app planejamento**

Run: `pnpm turbo build --filter=planejamento`
Expected: build com sucesso

**Step 4: Commit final se necessário**

Se houve ajustes durante a verificação, commitar.
