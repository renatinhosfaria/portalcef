# Upload Múltiplo de Documentos — Design

> Módulo: Planejamento | Data: 2026-02-25

## Problema

Professoras e analistas pedagógicas só conseguem fazer upload de um documento por vez no plano de aula. Isso torna o processo lento quando há vários arquivos para enviar.

## Decisão

Upload múltiplo via requests paralelas ao endpoint existente. Sem mudanças no backend.

## Requisitos

- Selecionar múltiplos arquivos pelo botão ou drag-and-drop
- Envio imediato ao selecionar (sem tela de confirmação)
- Lista de progresso individual por arquivo
- Sem limite de quantidade de arquivos
- Limite de 100MB por arquivo
- Em caso de falha, retentar automaticamente até 5 vezes antes de marcar como erro
- Concorrência máxima de 10 uploads simultâneos

## Modelo de Estado

```typescript
type FileUploadStatus = "pendente" | "enviando" | "sucesso" | "erro";

interface FileUploadItem {
  id: string;           // UUID temporário
  file: File;
  status: FileUploadStatus;
  tentativas: number;   // max 5
  erro?: string;
}
```

Estado `uploadQueue: FileUploadItem[]` substitui o booleano `isUploading`.

## Constantes

```typescript
const MAX_UPLOADS_SIMULTANEOS = 10;
const MAX_TENTATIVAS = 5;
const TEMPO_REMOVER_SUCESSO = 2000; // ms
```

## Lógica de Fila

1. Selecionar/arrastar arquivos → validar cada um → adicionar à fila com status `"pendente"`
2. `useEffect` observa a fila: conta quantos estão `"enviando"`
3. Se `enviando < 10` e existem `"pendente"` → inicia próximo upload
4. Sucesso → marca `"sucesso"` → remove da fila após 2s
5. Falha → incrementa `tentativas` → se < 5, volta para `"pendente"` (retry) → se >= 5, marca `"erro"`
6. `refetchPlano()` chamado uma única vez quando toda a fila finalizar

## Mudanças na UI

- Input file com atributo `multiple`
- Textos no plural ("Arraste arquivos...")
- Drop zone continua funcional durante uploads
- Nova lista de progresso entre drop zone e botões:
  - Ícone do tipo de arquivo
  - Nome (truncado se necessário)
  - Status visual (pendente, enviando, sucesso, erro)
  - Botão retry manual nos itens com erro

## Interface do Componente

```typescript
interface DocumentoUploadProps {
  onUpload: (file: File) => Promise<PlanoDocumento>;
  onAddLink: (url: string) => void | Promise<void>;
  onAllUploadsComplete?: () => void;
  disabled?: boolean;
}
```

## Arquivos Alterados

| Arquivo | Mudança |
|---------|---------|
| `documento-upload.tsx` | Fila de uploads, UI de progresso, concorrência, multiple |
| `plano-content.tsx` | Ajustar handleUpload, passar onAllUploadsComplete |

Nenhuma mudança no backend, hook, banco de dados ou tipos compartilhados.
