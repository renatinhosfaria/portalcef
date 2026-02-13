# Desfazer Aprovação de Documento — Plano de Implementação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir que analista pedagógica desfaça a aprovação de um documento por engano.

**Architecture:** Novo endpoint `POST /plano-aula/documentos/:id/desaprovar` que limpa `approvedBy` e `approvedAt`. Frontend adiciona botão "Desfazer" no componente `DocumentoList` quando documento já está aprovado.

**Tech Stack:** NestJS (backend), React + Next.js (frontend), Drizzle ORM, shadcn/ui

---

### Task 1: Backend — Service `desaprovarDocumento`

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.service.ts:1219` (após `aprovarDocumento`)

**Step 1: Implementar método `desaprovarDocumento`**

Adicionar logo após o método `aprovarDocumento` (linha 1219):

```typescript
  /**
   * Desfaz a aprovação de um documento
   * Qualquer analista_pedagogico da mesma unidade pode desfazer
   */
  async desaprovarDocumento(
    user: UserContext,
    documentoId: string,
  ): Promise<PlanoDocumento> {
    const db = getDb();

    const documento = await db.query.planoDocumento.findFirst({
      where: eq(planoDocumento.id, documentoId),
      with: { plano: true },
    });

    if (!documento) {
      throw new NotFoundException("Documento não encontrado");
    }

    if (documento.plano.unitId !== user.unitId) {
      throw new ForbiddenException(
        "Você não tem permissão para desaprovar este documento",
      );
    }

    if (!documento.approvedBy) {
      throw new BadRequestException("Este documento não está aprovado");
    }

    const [documentoAtualizado] = await db
      .update(planoDocumento)
      .set({
        approvedBy: null,
        approvedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(planoDocumento.id, documentoId))
      .returning();

    return documentoAtualizado;
  }
```

**Step 2: Verificar que `BadRequestException` está importado**

No topo do arquivo, verificar se `BadRequestException` já está nos imports do `@nestjs/common`. Se não estiver, adicionar.

**Step 3: Commit**

```bash
git add services/api/src/modules/plano-aula/plano-aula.service.ts
git commit -m "feat(plano-aula): adicionar método desaprovarDocumento no service"
```

---

### Task 2: Backend — Controller endpoint

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.controller.ts:770` (após endpoint `aprovar`)

**Step 1: Adicionar endpoint `desaprovar`**

Inserir logo após o endpoint `aprovarDocumento` (linha 770):

```typescript
  /**
   * POST /plano-aula/documentos/:id/desaprovar
   * Desfaz a aprovação de um documento (apenas analista_pedagogico)
   */
  @Post("documentos/:id/desaprovar")
  @Roles("analista_pedagogico")
  async desaprovarDocumento(
    @Req() req: { user: UserContext },
    @Param("id") documentoId: string,
  ) {
    const documento = await this.planoAulaService.desaprovarDocumento(
      req.user,
      documentoId,
    );
    return {
      success: true,
      data: documento,
    };
  }
```

**Step 2: Executar typecheck**

```bash
pnpm turbo typecheck --filter=api
```

Expected: PASS sem erros

**Step 3: Commit**

```bash
git add services/api/src/modules/plano-aula/plano-aula.controller.ts
git commit -m "feat(plano-aula): adicionar endpoint POST documentos/:id/desaprovar"
```

---

### Task 3: Frontend — Hook `desaprovarDocumento`

**Files:**
- Modify: `apps/planejamento/features/plano-aula/hooks/use-plano-aula.ts:175` (após `aprovarDocumento`)

**Step 1: Adicionar função `desaprovarDocumento`**

Inserir após o `aprovarDocumento` (linha 175), antes do `imprimirDocumento`:

```typescript
  const desaprovarDocumento = useCallback(
    async (documentoId: string): Promise<PlanoDocumento> => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<PlanoDocumento>(
          `/plano-aula/documentos/${documentoId}/desaprovar`,
          {},
        );
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao desfazer aprovação";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );
```

**Step 2: Adicionar ao return do hook**

No `return` (linha ~259), adicionar `desaprovarDocumento`:

```typescript
  return {
    loading,
    error,
    criarPlano,
    getPlano,
    uploadDocumento,
    addLink,
    deleteDocumento,
    aprovarDocumento,
    desaprovarDocumento,
    imprimirDocumento,
    submeterPlano,
    editarComentario,
    deletarComentario,
  };
```

**Step 3: Commit**

```bash
git add apps/planejamento/features/plano-aula/hooks/use-plano-aula.ts
git commit -m "feat(plano-aula): adicionar desaprovarDocumento no hook usePlanoAula"
```

---

### Task 4: Frontend — Componente `DocumentoList`

**Files:**
- Modify: `apps/planejamento/features/plano-aula/components/documento-list.tsx`

**Step 1: Adicionar import do ícone `Undo2`**

Na linha 14, adicionar `Undo2` aos imports do lucide-react:

```typescript
import {
  CheckCircle,
  Eye,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Image,
  Printer,
  Trash2,
  Undo2,
  Youtube,
} from "lucide-react";
```

**Step 2: Adicionar prop `onDesaprovar` na interface**

Na interface `DocumentoListProps` (linha 29), adicionar:

```typescript
interface DocumentoListProps {
  documentos: PlanoDocumento[];
  onDelete?: (docId: string) => void;
  onAddComentario?: (documentoId: string, comentario: string) => Promise<void>;
  onEditComentario?: (comentarioId: string, novoTexto: string) => Promise<void>;
  onDeleteComentario?: (comentarioId: string) => Promise<void>;
  onAprovar?: (docId: string) => Promise<void>;
  onDesaprovar?: (docId: string) => Promise<void>;
  onImprimir?: (docId: string) => Promise<void>;
  showComments?: boolean;
  canDelete?: boolean;
  canAprovar?: boolean;
  currentUserId?: string;
}
```

**Step 3: Desestruturar `onDesaprovar` nos props**

Na função do componente (linha 165), adicionar `onDesaprovar`:

```typescript
export function DocumentoList({
  documentos,
  onDelete,
  onAddComentario,
  onEditComentario,
  onDeleteComentario,
  onAprovar,
  onDesaprovar,
  onImprimir,
  showComments = false,
  canDelete = false,
  canAprovar = false,
  currentUserId,
}: DocumentoListProps) {
```

**Step 4: Adicionar estado e handler para desaprovar**

Após o estado `imprimindoId` (linha 180), adicionar:

```typescript
  const [desaprovandoId, setDesaprovandoId] = useState<string | null>(null);
```

Após o handler `handleAprovar` (linha 192), adicionar:

```typescript
  const handleDesaprovar = async (docId: string) => {
    if (!onDesaprovar) return;
    try {
      setDesaprovandoId(docId);
      await onDesaprovar(docId);
    } catch (error) {
      console.error("Erro ao desfazer aprovação:", error);
    } finally {
      setDesaprovandoId(null);
    }
  };
```

**Step 5: Adicionar botão "Desfazer" no JSX**

Logo após o botão "Aprovar" (linha 406), adicionar botão "Desfazer":

```tsx
                {/* Desfazer Aprovação - apenas para analista quando documento está aprovado */}
                {canAprovar && onDesaprovar && !!documento.approvedBy && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                    onClick={() => handleDesaprovar(documento.id)}
                    disabled={desaprovandoId === documento.id}
                    title="Desfazer aprovação do documento"
                  >
                    <Undo2 className="h-4 w-4" />
                    {desaprovandoId === documento.id
                      ? "Desfazendo..."
                      : "Desfazer"}
                  </Button>
                )}
```

**Step 6: Commit**

```bash
git add apps/planejamento/features/plano-aula/components/documento-list.tsx
git commit -m "feat(plano-aula): adicionar botão Desfazer Aprovação no DocumentoList"
```

---

### Task 5: Frontend — Integrar na tela de Análise

**Files:**
- Modify: `apps/planejamento/app/analise/[planoId]/revisao-content.tsx`

**Step 1: Extrair `desaprovarDocumento` do hook**

Na linha 82, adicionar `desaprovarDocumento`:

```typescript
  const { uploadDocumento, addLink, aprovarDocumento, desaprovarDocumento, imprimirDocumento, editarComentario, deletarComentario } =
    usePlanoAula();
```

**Step 2: Criar handler `handleDesaprovarDocumento`**

Após `handleAprovarDocumento` (linha ~207), adicionar:

```typescript
  /**
   * Desfaz a aprovação de um documento
   */
  const handleDesaprovarDocumento = useCallback(
    async (documentoId: string) => {
      try {
        await desaprovarDocumento(documentoId);
        await refetch();
        setSuccessMessage("Aprovação do documento desfeita!");
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao desfazer aprovação do documento";
        setActionError(message);
      }
    },
    [desaprovarDocumento, refetch],
  );
```

**Step 3: Passar `onDesaprovar` ao `DocumentoList`**

Na renderização do `DocumentoList` (linha ~487), adicionar a prop:

```tsx
              <DocumentoList
                documentos={plano.documentos}
                showComments={true}
                canDelete={false}
                canAprovar={true}
                onAddComentario={handleAddComentarioViaApi}
                onEditComentario={handleEditComentario}
                onDeleteComentario={handleDeleteComentario}
                onAprovar={handleAprovarDocumento}
                onDesaprovar={handleDesaprovarDocumento}
                onImprimir={handleImprimirDocumento}
                currentUserId={currentUserId}
              />
```

**Step 4: Executar lint e typecheck**

```bash
pnpm turbo lint && pnpm turbo typecheck
```

Expected: PASS sem erros

**Step 5: Commit**

```bash
git add apps/planejamento/app/analise/[planoId]/revisao-content.tsx
git commit -m "feat(plano-aula): integrar Desfazer Aprovação na tela de análise"
```

---

### Task 6: Verificação final

**Step 1: Executar lint e typecheck completo**

```bash
pnpm turbo lint && pnpm turbo typecheck
```

Expected: PASS sem erros

**Step 2: Teste manual (checklist)**

- [ ] Abrir tela de análise como analista_pedagogico
- [ ] Aprovar um documento → badge "Aprovado" aparece, botão "Imprimir" disponível
- [ ] Clicar "Desfazer" → badge "Aprovado" desaparece, botão "Imprimir" desaparece
- [ ] Aprovar novamente → funciona normalmente
