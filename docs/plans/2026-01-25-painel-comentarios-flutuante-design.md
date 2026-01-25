# Design: Painel Flutuante de Comentários em Documentos

**Data**: 2026-01-25
**Status**: Aprovado
**Contexto**: Melhorar UX de comentários em documentos do plano de aula

---

## Visão Geral

Criar um painel flutuante de comentários dentro do `DocumentoPreviewModal` que permite visualizar histórico de comentários e adicionar novos comentários sem sair da visualização do PDF.

### Objetivos

- ✅ Manter usuário no contexto de visualização do documento
- ✅ Mostrar histórico de comentários do documento atual
- ✅ Permitir adicionar novos comentários inline
- ✅ Interface não-invasiva (minimizado por padrão)
- ✅ Responsivo (desktop e mobile)

---

## Arquitetura

### Componentes Afetados

1. **DocumentoPreviewModal** (modificar)
   - Adicionar estado `comentarioPanelOpen`
   - Renderizar botão flutuante de toggle
   - Renderizar `DocumentoComentariosPanel` quando aberto
   - Receber prop `onAddComentario` do parent

2. **DocumentoComentariosPanel** (criar novo)
   - Componente do painel lateral flutuante
   - Mostra histórico (reutiliza `DocumentoComentarios`)
   - Formulário para novo comentário
   - Loading states e validações

3. **DocumentoComentarios** (existente, reutilizar)
   - Componente de lista de comentários
   - Sem modificações necessárias

### Hierarquia de Componentes

```
RevisaoContent (ou similar parent)
  └─ DocumentoPreviewModal
      ├─ Header (download, fechar)
      ├─ PDF iframe
      ├─ Botão Flutuante (toggle comentários)
      └─ DocumentoComentariosPanel (condicional)
          ├─ Header (título + fechar)
          ├─ DocumentoComentarios (histórico)
          └─ Form (novo comentário)
```

---

## Fluxo de Dados

### Props do DocumentoPreviewModal

```typescript
interface DocumentoPreviewModalProps {
  documento: PlanoDocumento;           // existente
  open: boolean;                        // existente
  onOpenChange: (open: boolean) => void; // existente
  onAddComentario?: (documentoId: string, comentario: string) => Promise<void>; // NOVO
  currentUserId?: string;              // NOVO (opcional, para identificar autor)
}
```

### Props do DocumentoComentariosPanel

```typescript
interface DocumentoComentariosPanelProps {
  documentoId: string;
  documentoNome: string;
  comentarios: DocumentoComentario[];
  isOpen: boolean;
  onClose: () => void;
  onAddComentario: (comentario: string) => Promise<void>;
  loading?: boolean;
}
```

### Fluxo de Adicionar Comentário

```
1. Usuário digita no textarea
2. Clica em "Adicionar Comentário"
3. DocumentoComentariosPanel chama onAddComentario(comentario)
4. DocumentoPreviewModal chama onAddComentario(documentoId, comentario)
5. RevisaoContent faz POST /api/.../comentarios
6. RevisaoContent refetch() do plano completo
7. DocumentoPreviewModal recebe documento atualizado via props
8. DocumentoComentariosPanel mostra novo comentário + limpa textarea
```

**Decisão**: Parent (RevisaoContent) gerencia API, modal apenas notifica via callback.
**Justificativa**: Consistente com padrão atual, mantém estado centralizado.

### Atualização da UI

**Abordagem escolhida**: Reload após sucesso

```
1. Mostra loading no botão submit
2. Faz POST /api/...
3. Se sucesso:
   - Refetch do plano completo
   - Toast de sucesso
   - Limpa textarea
4. Se erro:
   - Toast de erro
   - Mantém texto digitado
```

**Alternativa rejeitada**: Optimistic update (risco de inconsistência).

---

## Layout Visual

### Estado Fechado (padrão)

```
┌────────────────────────────────────────┐
│ [Header com downloads e fechar]       │
├────────────────────────────────────────┤
│                                        │
│                                        │
│         [PDF iframe fullscreen]        │
│                                        │
│                                        │
│                          ┌───────────┐ │
│                          │ 💬 (3)    │ │ ← Botão flutuante
│                          └───────────┘ │
└────────────────────────────────────────┘
```

### Estado Aberto

```
┌────────────────────────────────────────┐
│ [Header com downloads e fechar]       │
├────────────────────────────────────────┤
│                              ┌─────────┤
│                              │ 💬 Comen│ [X]
│         [PDF iframe]         ├─────────┤
│                              │ Históri │
│                              │ - Com 1 │
│                              │ - Com 2 │
│                              ├─────────┤
│                              │ [Form]  │
│                              │ [Enviar]│
└──────────────────────────────┴─────────┘
                               ↑ Painel sobreposto
```

---

## Responsividade

### Desktop (≥768px)

- **Painel**: 400px width, fixed right, altura 100% (desconta header)
- **Botão flutuante**: bottom-right (24px, 24px)
- **PDF**: Mantém largura total, painel sobrepõe
- **Backdrop**: Não usa (painel lateral)

### Tablet (≥640px, <768px)

- **Painel**: 350px width
- **Botão flutuante**: bottom-right (16px, 16px)
- **Backdrop**: Opcional, semi-transparente

### Mobile (<640px)

- **Painel**: 100% width, 100% height (fullscreen)
- **Botão flutuante**: bottom-center
- **Backdrop**: Escuro (bg-black/50), fecha ao clicar
- **Fecha**: ESC ou backdrop ou botão X

---

## Estilos e Animação

### Painel Principal

```typescript
className={cn(
  "fixed top-[65px] bottom-0 right-0 z-40",
  "w-full sm:w-[350px] md:w-[400px]",
  "bg-background border-l shadow-2xl",
  "transform transition-transform duration-300 ease-in-out",
  isOpen ? "translate-x-0" : "translate-x-full",
  "flex flex-col"
)}
```

### Botão Flutuante

```typescript
className={cn(
  "fixed bottom-4 right-4 md:bottom-6 md:right-6 z-30",
  "bg-primary text-primary-foreground",
  "rounded-full shadow-lg",
  "px-4 py-2 flex items-center gap-2",
  "transition-all hover:scale-110 hover:shadow-xl",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
)}
```

**Contador de comentários pendentes**:
```typescript
{unresolvedCount > 0 && (
  <span className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
    {unresolvedCount}
  </span>
)}
```

### Backdrop (mobile)

```typescript
{isOpen && (
  <div
    className="fixed inset-0 bg-black/50 z-30 md:hidden"
    onClick={onClose}
    aria-hidden="true"
  />
)}
```

---

## Acessibilidade

### ARIA e Semântica

```typescript
// Painel
<aside
  role="complementary"
  aria-label="Painel de comentários do documento"
  aria-hidden={!isOpen}
>

// Botão flutuante
<button
  aria-label={`Abrir comentários (${unresolvedCount} pendentes)`}
  aria-expanded={isOpen}
  aria-controls="comentarios-panel"
>

// Form
<form aria-label="Adicionar novo comentário">
  <label htmlFor="novo-comentario">
    Seu comentário
  </label>
  <textarea
    id="novo-comentario"
    aria-required="true"
    aria-invalid={error ? "true" : "false"}
  />
</form>
```

### Navegação por Teclado

- `ESC`: Fecha o painel
- `Tab`: Navega entre elementos (header, textarea, botão)
- `Enter` no textarea: Não submete (permite múltiplas linhas)
- `Ctrl/Cmd + Enter`: Submete comentário (atalho)

### Focus Management

```typescript
useEffect(() => {
  if (isOpen) {
    // Move foco para o textarea ao abrir
    textareaRef.current?.focus();
  }
}, [isOpen]);
```

---

## Validações

### Client-side

```typescript
// Comentário vazio
const isDisabled = comentario.trim().length === 0 || isSubmitting;

// Limite de caracteres
const MAX_LENGTH = 1000;
{comentario.length}/{MAX_LENGTH}

// Durante submit
<Button disabled={isDisabled}>
  {isSubmitting && <Loader2 className="animate-spin" />}
  Adicionar Comentário
</Button>
```

### Server-side (já existe na API)

- Validação de permissão (role adequada)
- Validação de status do plano
- Sanitização do texto

---

## Tratamento de Erros

### Cenários

| Erro | Ação |
|------|------|
| Comentário vazio | Botão disabled, não permite submit |
| Comentário > 1000 chars | Mensagem de limite, trunca ao digitar |
| Erro de rede | Toast com mensagem, permite retry |
| 401/403 | Redireciona para login |
| 500 | Toast genérico, permite retry |

### Feedback Visual

```typescript
// Sucesso
toast.success("Comentário adicionado com sucesso!");

// Erro
toast.error("Erro ao adicionar comentário. Tente novamente.");

// Loading
<Button disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Enviando...
</Button>
```

---

## Estrutura de Arquivos

```
apps/planejamento/features/plano-aula/components/
├── documento-preview-modal.tsx         (modificar - adicionar estado e botão)
├── documento-comentarios-panel.tsx     (criar - painel flutuante)
├── documento-comentarios.tsx           (existente - reutilizar)
├── documento-comentarios-panel.test.tsx (criar - testes)
└── index.ts                            (atualizar - export panel)
```

---

## Integração com Parents

### RevisaoContent (coordenadora)

```typescript
const handleAddComentario = async (documentoId: string, comentario: string) => {
  try {
    await serverFetch(`/api/plano-aula/${planoId}/documentos/${documentoId}/comentarios`, {
      method: 'POST',
      body: JSON.stringify({ comentario }),
    });

    // Refetch plano completo
    await refetch();

    return Promise.resolve();
  } catch (error) {
    console.error('Erro ao adicionar comentário:', error);
    return Promise.reject(error);
  }
};

<DocumentoPreviewModal
  documento={selectedDoc}
  open={modalOpen}
  onOpenChange={setModalOpen}
  onAddComentario={handleAddComentario}
/>
```

### AnalistaRevisaoContent (similar)

Mesmo padrão, mesma API.

---

## Casos de Uso

### UC1: Visualizar comentários existentes

1. Usuário abre modal de documento
2. Vê botão flutuante com badge "(3)"
3. Clica no botão
4. Painel abre, mostra 3 comentários (1 pendente, 2 resolvidos)

### UC2: Adicionar novo comentário

1. Usuário abre painel
2. Digita comentário no textarea
3. Clica em "Adicionar Comentário"
4. Vê loading
5. Após sucesso, vê novo comentário na lista
6. Textarea limpa automaticamente

### UC3: Comentar múltiplos documentos

1. Usuário comenta documento A
2. Fecha modal
3. Abre modal do documento B
4. Vê apenas comentários do documento B (isolamento correto)

### UC4: Erro de rede

1. Usuário tenta adicionar comentário
2. Falha de rede
3. Vê toast de erro
4. Texto permanece no textarea
5. Pode tentar novamente

---

## Decisões de Design

### ✅ Escolhas Aprovadas

| Decisão | Opção Escolhida | Justificativa |
|---------|-----------------|---------------|
| Layout | Painel flutuante/sobreposto | Não redimensiona PDF, menos invasivo |
| Estado inicial | Minimizado | Prioriza visualização do documento |
| Conteúdo | Histórico + formulário | Contexto completo em um lugar |
| Gerenciamento API | Parent (RevisaoContent) | Consistente com padrão atual |
| Atualização UI | Reload após sucesso | Garante consistência com servidor |
| Responsividade | Fullscreen mobile, lateral desktop | Melhor uso do espaço em cada tela |

### ❌ Alternativas Rejeitadas

- **Modal separado**: Perde contexto do documento
- **Comentário no rodapé**: Ocupa muito espaço fixo
- **Split view lateral**: Reduz área do PDF
- **Optimistic update**: Risco de inconsistência
- **Modal gerencia API**: Duplicação de lógica

---

## Performance

### Otimizações

- **Lazy render**: Painel só renderiza quando `isOpen === true`
- **Animação CSS**: Usa transform (GPU-accelerated)
- **Memoização**: `DocumentoComentarios` não re-renderiza desnecessariamente
- **Debounce**: Validação de caracteres com debounce (opcional)

### Métricas Esperadas

- Abertura do painel: <100ms
- Animação fluida: 60fps
- Submit comentário: <500ms (depende da API)
- Refetch plano: <1s

---

## Testes

### Casos de Teste

```typescript
// documento-comentarios-panel.test.tsx

describe('DocumentoComentariosPanel', () => {
  it('renderiza histórico de comentários', () => {
    // Verifica que DocumentoComentarios é renderizado
  });

  it('permite adicionar novo comentário', async () => {
    // Digita, submete, verifica callback
  });

  it('valida comentário vazio', () => {
    // Botão disabled quando vazio
  });

  it('mostra loading durante submit', async () => {
    // Spinner visível, botão disabled
  });

  it('limpa textarea após sucesso', async () => {
    // Textarea vazia após callback resolver
  });

  it('fecha com ESC', () => {
    // Keydown ESC chama onClose
  });

  it('fecha ao clicar no backdrop (mobile)', () => {
    // Click no overlay chama onClose
  });
});
```

---

## Próximos Passos

1. ✅ Design aprovado
2. ⏳ Criar plano de implementação detalhado
3. ⏳ Implementar `DocumentoComentariosPanel`
4. ⏳ Modificar `DocumentoPreviewModal`
5. ⏳ Integrar com `RevisaoContent` e `AnalistaRevisaoContent`
6. ⏳ Escrever testes
7. ⏳ Testar em desktop e mobile
8. ⏳ Code review
9. ⏳ Deploy

---

## Referências

- [DocumentoPreviewModal.tsx](../../apps/planejamento/features/plano-aula/components/documento-preview-modal.tsx)
- [DocumentoComentarios.tsx](../../apps/planejamento/features/plano-aula/components/documento-comentarios.tsx)
- [RevisaoContent.tsx](../../apps/planejamento/app/coordenacao/[planoId]/revisao-content.tsx)
- [Types](../../apps/planejamento/features/plano-aula/types.ts)
