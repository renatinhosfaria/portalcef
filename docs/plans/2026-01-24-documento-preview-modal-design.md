# Design: Modal de Preview de Documentos em Tela Cheia

**Data:** 2026-01-24
**Status:** Design Validado
**Contexto:** Melhorar UX de visualização de documentos convertidos (DOC/DOCX → PDF)

---

## 🎯 Problema

A visualização atual de documentos na interface está inadequada:
- Preview inline com altura fixa de 384px (`h-96`)
- Difícil visualizar documentos com múltiplas páginas (ex: PDF de 8 páginas)
- Usuário reportou: "não está boa, está pequeno"

## ✅ Decisões de Design

### 1. Abordagem de Visualização

**Escolhido:** Modal/Dialog em tela cheia usando shadcn/ui

**Razões:**
- Maximiza área de visualização
- Foco completo no documento
- Experiência consistente (ESC para fechar)
- Não polui navegação do usuário

### 2. Funcionalidades de Download

**Escolhido:** Dois botões separados na barra superior do modal

Botões:
1. **"Baixar PDF"** - Download do arquivo convertido
   - Fonte: `documento.previewUrl`
   - Habilitado apenas quando `previewStatus === "PRONTO"`
   - Formato: `.pdf`

2. **"Baixar Original (.docx)"** - Download do arquivo original
   - Fonte: `documento.url`
   - Sempre habilitado (arquivo original sempre disponível)
   - Formato: preserva extensão original (`.doc`, `.docx`)

### 3. Estados do Botão "Ver Documento"

**Escolhido:** Desabilitar botão até conversão completar

Estados:
- `PENDENTE`: Botão **desabilitado**, mostra badge "Convertendo..."
- `PRONTO`: Botão **habilitado**, abre modal ao clicar
- `ERRO`: Botão **habilitado**, abre modal mostrando mensagem de erro

### 4. Layout do Modal

```
┌─────────────────────────────────────────────────────────┐
│ [X Fechar]    [📄 Baixar PDF]  [📝 Baixar Original]    │ <- Header
├─────────────────────────────────────────────────────────┤
│                                                         │
│                                                         │
│              [Preview do PDF em iframe]                │
│                  (tela cheia)                           │
│                                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🏗 Arquitetura de Componentes

### Novo Componente: `DocumentoPreviewModal`

**Localização:** `apps/planejamento/features/plano-aula/components/documento-preview-modal.tsx`

**Props:**
```typescript
interface DocumentoPreviewModalProps {
  documento: PlanoDocumento;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Responsabilidades:**
- Renderizar Dialog em fullscreen
- Exibir preview do PDF via iframe
- Gerenciar botões de download (PDF + Original)
- Tratar estados PENDENTE/PRONTO/ERRO
- Keyboard shortcuts (ESC para fechar)

### Modificação: `DocumentoList`

**Arquivo:** `apps/planejamento/features/plano-aula/components/documento-list.tsx`

**Mudanças:**
1. Remover lógica de toggle inline (`expandedDocs`)
2. Adicionar state para modal: `openDocId`
3. Modificar botão "Ver Documento":
   - Desabilitar quando `previewStatus === "PENDENTE"`
   - onClick abre modal ao invés de toggle inline
4. Renderizar `<DocumentoPreviewModal>` condicionalmente

---

## 🔄 Fluxo de Interação

### Fluxo Normal (Documento Convertido)

```
Usuario clica "Ver Documento"
    ↓
Modal abre em tela cheia
    ↓
PDF renderizado em iframe
    ↓
Usuario pode:
  - Visualizar PDF completo
  - Baixar PDF convertido
  - Baixar arquivo original
  - Fechar (ESC ou botão X)
```

### Fluxo com Conversão Pendente

```
Usuario vê documento na lista
    ↓
Badge "Convertendo..." visível
    ↓
Botão "Ver Documento" DESABILITADO
    ↓
Polling atualiza status a cada 3s
    ↓
Quando status → "PRONTO"
    ↓
Botão habilitado automaticamente
```

### Fluxo com Erro de Conversão

```
Usuario clica "Ver Documento"
    ↓
Modal abre
    ↓
Mensagem de erro exibida:
  "Erro ao converter documento"
  {documento.previewError}
    ↓
Botão "Baixar PDF" desabilitado
Botão "Baixar Original" habilitado
```

---

## 📋 Implementação Técnica

### 1. Criar `DocumentoPreviewModal`

**Dependências:**
- `@essencia/ui/components/dialog`
- `@essencia/ui/components/button`
- `lucide-react` (ícones: Download, FileText, X)

**Estados internos:**
- Nenhum (componente controlado via props)

**Download Logic:**
```typescript
const handleDownloadPdf = () => {
  if (!documento.previewUrl) return;

  const link = document.createElement('a');
  link.href = documento.previewUrl;
  link.download = documento.fileName?.replace(/\.(docx?|odt)$/i, '.pdf') || 'documento.pdf';
  link.click();
};

const handleDownloadOriginal = () => {
  if (!documento.url) return;

  const link = document.createElement('a');
  link.href = documento.url;
  link.download = documento.fileName || 'documento';
  link.click();
};
```

### 2. Modificar `DocumentoList`

**Adicionar state:**
```typescript
const [openDocId, setOpenDocId] = useState<string | null>(null);
```

**Modificar botão "Ver Documento":**
```typescript
<Button
  variant="ghost"
  size="sm"
  className="h-8 gap-1"
  onClick={() => setOpenDocId(documento.id)}
  disabled={documento.previewStatus === "PENDENTE"}
>
  <ChevronDown className="h-4 w-4" />
  Ver Documento
</Button>
```

**Renderizar modal:**
```typescript
{documentos.map((documento) => (
  <>
    {/* Card do documento */}

    {/* Modal */}
    <DocumentoPreviewModal
      documento={documento}
      open={openDocId === documento.id}
      onOpenChange={(open) => setOpenDocId(open ? documento.id : null)}
    />
  </>
))}
```

### 3. Estilização do Modal

**Dialog fullscreen:**
```typescript
<DialogContent className="max-w-[100vw] h-screen p-0">
  <div className="flex flex-col h-full">
    {/* Header com botões */}
    <div className="flex items-center justify-between p-4 border-b">
      {/* Botões */}
    </div>

    {/* Preview area */}
    <div className="flex-1 overflow-hidden">
      {/* iframe ou mensagem de erro */}
    </div>
  </div>
</DialogContent>
```

---

## ✅ Critérios de Aceitação

1. ✅ Modal abre em tela cheia ao clicar "Ver Documento"
2. ✅ PDF é exibido ocupando toda área disponível
3. ✅ Botão "Baixar PDF" funciona quando status === "PRONTO"
4. ✅ Botão "Baixar Original" sempre funciona
5. ✅ Botão "Ver Documento" desabilitado quando status === "PENDENTE"
6. ✅ ESC fecha o modal
7. ✅ Mensagem de erro exibida quando status === "ERRO"
8. ✅ Downloads usam nomes de arquivo apropriados

---

## 🧪 Casos de Teste

### Teste 1: Visualização de PDF Convertido
- **Dado:** Documento com `previewStatus === "PRONTO"`
- **Quando:** Usuario clica "Ver Documento"
- **Então:** Modal abre mostrando PDF em fullscreen

### Teste 2: Download de PDF
- **Dado:** Modal aberto com documento convertido
- **Quando:** Usuario clica "Baixar PDF"
- **Então:** Download inicia com nome correto (.pdf)

### Teste 3: Download de Original
- **Dado:** Modal aberto com documento
- **Quando:** Usuario clica "Baixar Original"
- **Então:** Download inicia com nome/extensão original

### Teste 4: Conversão Pendente
- **Dado:** Documento com `previewStatus === "PENDENTE"`
- **Quando:** Usuario vê lista de documentos
- **Então:** Botão "Ver Documento" está desabilitado

### Teste 5: Erro de Conversão
- **Dado:** Documento com `previewStatus === "ERRO"`
- **Quando:** Usuario abre modal
- **Então:** Mensagem de erro exibida, botão PDF desabilitado

### Teste 6: Fechar Modal
- **Dado:** Modal aberto
- **Quando:** Usuario pressiona ESC
- **Então:** Modal fecha

---

## 📝 Notas de Implementação

1. **Remover código antigo:**
   - Remover `expandedDocs` state de `DocumentoList`
   - Remover preview inline do card
   - Manter componente `DocumentoPreview` para reusar lógica de renderização

2. **Acessibilidade:**
   - Dialog já tem foco trap (shadcn/ui)
   - Botões com labels descritivos
   - ESC para fechar

3. **Performance:**
   - Modal renderizado apenas quando necessário
   - iframe carregado sob demanda
   - Polling já implementado (não afetado)

4. **Mobile:**
   - Modal fullscreen funciona bem em mobile
   - Botões responsivos no header
   - iframe com scroll nativo

---

## 🔄 Dependências

- ✅ BullMQ worker funcionando (já implementado)
- ✅ MinIO storage configurado (já implementado)
- ✅ Polling de status automático (já implementado)
- ✅ shadcn/ui Dialog component (já disponível)

---

## 📦 Impacto

**Arquivos novos:**
- `apps/planejamento/features/plano-aula/components/documento-preview-modal.tsx`

**Arquivos modificados:**
- `apps/planejamento/features/plano-aula/components/documento-list.tsx`

**Arquivos removidos/deprecated:**
- Nenhum (preview inline será substituído)

**Estimativa:**
- 1 componente novo (~150 linhas)
- 1 componente modificado (~50 linhas alteradas)
- Sem mudanças no backend
- Sem mudanças no schema

---

**Design validado pelo usuário em sessão de brainstorming (2026-01-24)**
