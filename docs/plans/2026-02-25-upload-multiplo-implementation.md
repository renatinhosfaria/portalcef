# Upload Múltiplo de Documentos — Plano de Implementação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir que professoras e analistas façam upload de múltiplos documentos ao mesmo tempo, com progresso individual e retry automático.

**Architecture:** Mudança 100% frontend. O componente `DocumentoUpload` ganha uma fila interna de uploads que processa arquivos em paralelo (até 10 simultâneos) usando o endpoint existente. Nenhuma mudança no backend.

**Tech Stack:** React, TypeScript, Vitest, Testing Library

---

### Task 1: Escrever teste do componente DocumentoUpload para upload múltiplo

**Files:**
- Create: `apps/planejamento/features/plano-aula/components/documento-upload.test.tsx`

**Step 1: Escrever os testes**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DocumentoUpload } from "./documento-upload";

function criarArquivo(nome: string, tipo: string, tamanhoMB = 1): File {
  const bytes = new Uint8Array(tamanhoMB * 1024 * 1024);
  return new File([bytes], nome, { type: tipo });
}

describe("DocumentoUpload - Upload Múltiplo", () => {
  it("aceita múltiplos arquivos via input file", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn().mockResolvedValue({ id: "doc-1" });
    const onAddLink = vi.fn();

    render(
      <DocumentoUpload onUpload={onUpload} onAddLink={onAddLink} />,
    );

    const arquivo1 = criarArquivo("doc1.pdf", "application/pdf");
    const arquivo2 = criarArquivo("doc2.pdf", "application/pdf");

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).toHaveAttribute("multiple");

    await user.upload(input, [arquivo1, arquivo2]);

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledTimes(2);
    });
  });

  it("mostra progresso individual por arquivo", async () => {
    const user = userEvent.setup();
    let resolveUpload: (value: unknown) => void;
    const onUpload = vi.fn().mockImplementation(
      () => new Promise((resolve) => { resolveUpload = resolve; }),
    );
    const onAddLink = vi.fn();

    render(
      <DocumentoUpload onUpload={onUpload} onAddLink={onAddLink} />,
    );

    const arquivo = criarArquivo("relatorio.pdf", "application/pdf");
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    await user.upload(input, [arquivo]);

    await waitFor(() => {
      expect(screen.getByText("relatorio.pdf")).toBeInTheDocument();
    });
  });

  it("chama onAllUploadsComplete quando todos finalizam", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn().mockResolvedValue({ id: "doc-1" });
    const onAddLink = vi.fn();
    const onAllComplete = vi.fn();

    render(
      <DocumentoUpload
        onUpload={onUpload}
        onAddLink={onAddLink}
        onAllUploadsComplete={onAllComplete}
      />,
    );

    const arquivo = criarArquivo("doc.pdf", "application/pdf");
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    await user.upload(input, [arquivo]);

    await waitFor(() => {
      expect(onAllComplete).toHaveBeenCalledTimes(1);
    });
  });

  it("rejeita arquivo com tipo inválido sem chamar onUpload", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    const onAddLink = vi.fn();

    render(
      <DocumentoUpload onUpload={onUpload} onAddLink={onAddLink} />,
    );

    const arquivoInvalido = criarArquivo("virus.exe", "application/x-msdownload");
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    await user.upload(input, [arquivoInvalido]);

    await waitFor(() => {
      expect(onUpload).not.toHaveBeenCalled();
    });
  });

  it("exibe textos no plural na drop zone", () => {
    const onUpload = vi.fn();
    const onAddLink = vi.fn();

    render(
      <DocumentoUpload onUpload={onUpload} onAddLink={onAddLink} />,
    );

    expect(
      screen.getByText(/arraste arquivos ou clique para selecionar/i),
    ).toBeInTheDocument();
  });
});
```

**Step 2: Rodar teste para verificar que falha**

Run: `cd apps/planejamento && pnpm vitest run features/plano-aula/components/documento-upload.test.tsx`
Expected: FAIL — testes falham porque o componente atual não suporta multiple

---

### Task 2: Atualizar interface e constantes do DocumentoUpload

**Files:**
- Modify: `apps/planejamento/features/plano-aula/components/documento-upload.tsx`

**Step 1: Atualizar interface, constantes e tipos**

No topo do arquivo, atualizar a interface e adicionar tipos/constantes:

```tsx
// Importar tipo PlanoDocumento
import type { PlanoDocumento } from "../types";

// Atualizar interface
interface DocumentoUploadProps {
  onUpload: (file: File) => Promise<PlanoDocumento>;
  onAddLink: (url: string) => void | Promise<void>;
  onAllUploadsComplete?: () => void;
  disabled?: boolean;
}

// Novos tipos para a fila
type FileUploadStatus = "pendente" | "enviando" | "sucesso" | "erro";

interface FileUploadItem {
  id: string;
  file: File;
  status: FileUploadStatus;
  tentativas: number;
  erro?: string;
}

// Atualizar constante de tamanho
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// Novas constantes
const MAX_UPLOADS_SIMULTANEOS = 10;
const MAX_TENTATIVAS = 5;
const TEMPO_REMOVER_SUCESSO = 2000;
```

**Step 2: Atualizar texto do limite no JSX**

Trocar o texto `(max. 10MB)` por `(max. 100MB)`.

**Step 3: Rodar typecheck**

Run: `pnpm turbo typecheck --filter=planejamento`
Expected: PASS (tipos são aditivos, não quebram nada ainda)

---

### Task 3: Implementar estado da fila e lógica de processamento

**Files:**
- Modify: `apps/planejamento/features/plano-aula/components/documento-upload.tsx`

**Step 1: Substituir estado booleano pela fila**

Remover `isUploading` e adicionar `uploadQueue`:

```tsx
const [uploadQueue, setUploadQueue] = useState<FileUploadItem[]>([]);
```

Derivar `isUploading` da fila:

```tsx
const isUploading = uploadQueue.some(
  (item) => item.status === "enviando" || item.status === "pendente",
);
```

**Step 2: Criar função para adicionar arquivos à fila**

```tsx
const adicionarArquivosNaFila = useCallback(
  (files: File[]) => {
    setError(null);
    const novosItens: FileUploadItem[] = [];

    for (const file of files) {
      const validationError = validateFile(file);
      if (validationError) {
        novosItens.push({
          id: crypto.randomUUID(),
          file,
          status: "erro",
          tentativas: MAX_TENTATIVAS,
          erro: validationError,
        });
      } else {
        novosItens.push({
          id: crypto.randomUUID(),
          file,
          status: "pendente",
          tentativas: 0,
        });
      }
    }

    setUploadQueue((prev) => [...prev, ...novosItens]);
  },
  [],
);
```

**Step 3: Criar função para processar um item da fila**

```tsx
const processarUpload = useCallback(
  async (item: FileUploadItem) => {
    setUploadQueue((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, status: "enviando" as const } : i,
      ),
    );

    try {
      await onUpload(item.file);
      setUploadQueue((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: "sucesso" as const } : i,
        ),
      );

      // Remover item com sucesso após delay
      setTimeout(() => {
        setUploadQueue((prev) => prev.filter((i) => i.id !== item.id));
      }, TEMPO_REMOVER_SUCESSO);
    } catch {
      setUploadQueue((prev) =>
        prev.map((i) => {
          if (i.id !== item.id) return i;
          const novasTentativas = i.tentativas + 1;
          if (novasTentativas >= MAX_TENTATIVAS) {
            return {
              ...i,
              status: "erro" as const,
              tentativas: novasTentativas,
              erro: "Erro ao enviar. Tente novamente.",
            };
          }
          return {
            ...i,
            status: "pendente" as const,
            tentativas: novasTentativas,
          };
        }),
      );
    }
  },
  [onUpload],
);
```

**Step 4: Adicionar useEffect para processar a fila**

```tsx
useEffect(() => {
  const enviando = uploadQueue.filter((i) => i.status === "enviando").length;
  const pendentes = uploadQueue.filter((i) => i.status === "pendente");

  const vagas = MAX_UPLOADS_SIMULTANEOS - enviando;
  if (vagas <= 0 || pendentes.length === 0) return;

  const proximos = pendentes.slice(0, vagas);
  for (const item of proximos) {
    processarUpload(item);
  }
}, [uploadQueue, processarUpload]);
```

**Step 5: Adicionar useEffect para chamar onAllUploadsComplete**

```tsx
useEffect(() => {
  if (uploadQueue.length === 0) return;

  const todosFinalizados = uploadQueue.every(
    (i) => i.status === "sucesso" || i.status === "erro",
  );

  if (todosFinalizados) {
    onAllUploadsComplete?.();
  }
}, [uploadQueue, onAllUploadsComplete]);
```

**Step 6: Rodar typecheck**

Run: `pnpm turbo typecheck --filter=planejamento`
Expected: PASS

---

### Task 4: Atualizar handlers para múltiplos arquivos

**Files:**
- Modify: `apps/planejamento/features/plano-aula/components/documento-upload.tsx`

**Step 1: Atualizar handleFileChange para múltiplos arquivos**

```tsx
const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (files && files.length > 0) {
    adicionarArquivosNaFila(Array.from(files));
  }
  e.target.value = "";
};
```

**Step 2: Atualizar handleDrop para múltiplos arquivos**

```tsx
const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  setIsDragging(false);

  if (disabled) return;

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    adicionarArquivosNaFila(Array.from(files));
  }
};
```

**Step 3: Atualizar botão "Enviar Arquivo" para múltiplos**

```tsx
onClick={() => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ACCEPTED_EXTENSIONS;
  input.multiple = true;
  input.onchange = (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      adicionarArquivosNaFila(Array.from(files));
    }
  };
  input.click();
}}
```

**Step 4: Adicionar `multiple` ao input oculto do drag-and-drop**

No JSX, adicionar `multiple` ao input:

```tsx
<input
  type="file"
  className="absolute inset-0 cursor-pointer opacity-0"
  onChange={handleFileChange}
  disabled={disabled}
  accept={ACCEPTED_EXTENSIONS}
  multiple
/>
```

**Step 5: Remover a função `uploadFile` que não é mais usada**

A função `uploadFile` (linhas 78-99) pode ser removida — toda lógica agora passa por `adicionarArquivosNaFila` → `processarUpload`.

**Step 6: Rodar typecheck**

Run: `pnpm turbo typecheck --filter=planejamento`
Expected: PASS

---

### Task 5: Atualizar UI — textos no plural e lista de progresso

**Files:**
- Modify: `apps/planejamento/features/plano-aula/components/documento-upload.tsx`

**Step 1: Atualizar textos da drop zone**

```tsx
<p className="text-sm font-medium text-center">
  {isDragging
    ? "Solte os arquivos aqui"
    : isUploading
      ? "Enviando..."
      : "Arraste arquivos ou clique para selecionar"}
</p>
<p className="text-xs text-muted-foreground mt-1">
  PDF, DOC, DOCX, XLS, XLSX, PNG, JPG (max. 100MB)
</p>
```

**Step 2: Não desabilitar a drop zone durante uploads**

Remover `isUploading` da condição de `pointer-events-none`:

```tsx
className={cn(
  "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-all",
  isDragging
    ? "border-primary bg-primary/5"
    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
  disabled && "pointer-events-none opacity-60",
  !disabled && "cursor-pointer",
)}
```

Atualizar o `disabled` do input oculto:

```tsx
disabled={disabled}
```

**Step 3: Adicionar lista de progresso no JSX**

Entre a drop zone e os botões de ação, adicionar:

```tsx
{/* Lista de Progresso do Upload */}
{uploadQueue.length > 0 && (
  <div className="space-y-2">
    {uploadQueue.map((item) => (
      <div
        key={item.id}
        className={cn(
          "flex items-center gap-3 rounded-md border px-3 py-2 text-sm",
          item.status === "sucesso" && "border-green-200 bg-green-50",
          item.status === "erro" && "border-red-200 bg-red-50",
          item.status === "enviando" && "border-blue-200 bg-blue-50",
          item.status === "pendente" && "border-muted",
        )}
      >
        {/* Ícone de status */}
        {item.status === "enviando" && (
          <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-blue-600" />
        )}
        {item.status === "sucesso" && (
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600" />
        )}
        {item.status === "erro" && (
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" />
        )}
        {item.status === "pendente" && (
          <Upload className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        )}

        {/* Nome do arquivo */}
        <span className="flex-1 truncate">{item.file.name}</span>

        {/* Status texto */}
        {item.status === "enviando" && (
          <span className="text-xs text-blue-600">Enviando...</span>
        )}
        {item.status === "sucesso" && (
          <span className="text-xs text-green-600">Enviado</span>
        )}
        {item.status === "pendente" && (
          <span className="text-xs text-muted-foreground">Aguardando</span>
        )}
        {item.status === "erro" && (
          <>
            <span className="text-xs text-red-600">{item.erro}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-red-600 hover:text-red-700"
              onClick={() => {
                setUploadQueue((prev) =>
                  prev.map((i) =>
                    i.id === item.id
                      ? { ...i, status: "pendente" as const, tentativas: 0, erro: undefined }
                      : i,
                  ),
                );
              }}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    ))}
  </div>
)}
```

**Step 4: Adicionar imports necessários**

Adicionar `CheckCircle2` e `RotateCcw` aos imports de lucide-react:

```tsx
import {
  AlertCircle,
  CheckCircle2,
  Link,
  Loader2,
  RotateCcw,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
```

Adicionar `useEffect` ao import do React:

```tsx
import { useCallback, useEffect, useState } from "react";
```

**Step 5: Rodar testes**

Run: `cd apps/planejamento && pnpm vitest run features/plano-aula/components/documento-upload.test.tsx`
Expected: PASS — todos os 5 testes passando

---

### Task 6: Atualizar plano-content.tsx

**Files:**
- Modify: `apps/planejamento/app/plano-aula/[quinzenaId]/plano-content.tsx`

**Step 1: Atualizar handleUpload para retornar resultado**

```tsx
const handleUpload = useCallback(
  async (file: File) => {
    if (!plano?.id) throw new Error("Plano não encontrado");

    return await uploadDocumento(plano.id, file);
  },
  [plano?.id, uploadDocumento],
);
```

**Step 2: Atualizar uso do DocumentoUpload no JSX**

```tsx
<DocumentoUpload
  onUpload={handleUpload}
  onAddLink={handleAddLink}
  onAllUploadsComplete={refetchPlano}
  disabled={actionLoading}
/>
```

**Step 3: Rodar typecheck**

Run: `pnpm turbo typecheck --filter=planejamento`
Expected: PASS

---

### Task 7: Verificação final — lint, typecheck e testes

**Files:** Nenhum arquivo novo

**Step 1: Rodar lint**

Run: `pnpm turbo lint --filter=planejamento`
Expected: PASS

**Step 2: Rodar typecheck**

Run: `pnpm turbo typecheck --filter=planejamento`
Expected: PASS

**Step 3: Rodar todos os testes do módulo**

Run: `cd apps/planejamento && pnpm vitest run`
Expected: PASS — todos os testes passando, incluindo os novos

**Step 4: Commit**

```bash
git add apps/planejamento/features/plano-aula/components/documento-upload.tsx \
       apps/planejamento/features/plano-aula/components/documento-upload.test.tsx \
       apps/planejamento/app/plano-aula/[quinzenaId]/plano-content.tsx \
       docs/plans/2026-02-25-upload-multiplo-design.md \
       docs/plans/2026-02-25-upload-multiplo-implementation.md
git commit -m "feat(planejamento): implementar upload múltiplo de documentos

Permite selecionar e enviar múltiplos arquivos simultaneamente via
botão ou drag-and-drop. Inclui lista de progresso individual,
concorrência de até 10 uploads, e retry automático (até 5 tentativas)."
```
