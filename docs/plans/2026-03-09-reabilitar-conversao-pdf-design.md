# Design: Reabilitar Conversão PDF para Impressão de Documentos

**Data:** 2026-03-09
**Status:** Aprovado

## Problema

O botão "Imprimir" está desabilitado para documentos Word e JPG anexados em planos de aula. A causa é que a conversão de documentos para PDF foi desabilitada quando o OnlyOffice foi adotado para visualização/edição, mas o botão de impressão continua dependendo de `pdfUrl` (gerado pela conversão). Sem `previewUrl` preenchido, `pdfUrl` retorna `null` e o botão fica desabilitado.

## Contexto

- Os campos `previewKey`, `previewUrl`, `previewStatus` são independentes dos campos usados pelo OnlyOffice (`storageKey`, `fileUrl`, `fileKey`).
- Reabilitar a conversão não interfere em nada no fluxo do OnlyOffice.
- O worker já converte DOC/DOCX via LibreOffice + Carbone. Falta suporte a imagens (JPG/PNG).
- Após edição pelo OnlyOffice, o PDF preview fica desatualizado e deve ser regerado.

## Abordagem Escolhida

**Abordagem C — LibreOffice para imagens + Carbone para DOCX (fluxo híbrido):**
- Manter Carbone para DOCX (fidelidade atual preservada)
- Usar LibreOffice para JPG/PNG → PDF (sem novas dependências)
- PDF nativo não precisa de conversão

## Arquitetura e Fluxo

```
Upload (DOC/DOCX/JPG/PNG)
  └─ API: salva no MinIO + define previewStatus="PENDENTE"
  └─ API: enfileira job na fila "documentos-conversao"
        │
        ▼
  Worker processa job:
    ├─ Se DOC/DOCX → LibreOffice (DOC→DOCX) + Carbone (DOCX→PDF)  [já existe]
    └─ Se JPG/PNG  → LibreOffice (imagem→PDF)                       [novo]
        │
        ▼
  Worker salva PDF no MinIO
  Worker atualiza: previewStatus="PRONTO", previewUrl=<url>
        │
        ▼
  Frontend habilita botão "Imprimir"

─── Após edição via OnlyOffice ───
  Callback OnlyOffice (status=2):
    └─ API: salva novo arquivo no MinIO       [já existe]
    └─ API: redefine previewStatus="PENDENTE" [novo]
    └─ API: reenfileira job de conversão      [novo]
```

## Mudanças por Componente

### 1. `services/worker/src/conversao/conversor.ts`

Adicionar função `converterImagemParaPdfComLibreOffice()`:
- Usa o mesmo padrão da função `converterDocParaDocxComLibreOffice()` já existente
- Comando: `soffice --headless --convert-to pdf --outdir <pasta> <imagem>`
- Usa perfil isolado (`-env:UserInstallation`) para evitar conflitos entre jobs concorrentes

Atualizar `converterDocParaPdf()` com branch adicional:
```
Se mimeType === "image/jpeg" | "image/jpg" | "image/png"
  → converterImagemParaPdfComLibreOffice()
Senão (DOC/DOCX)
  → fluxo atual (LibreOffice + Carbone)
```

### 2. `services/api/src/modules/plano-aula/plano-aula.controller.ts` — Upload

Remover desabilitação e restaurar lógica de conversão:
- `precisaConverter = mimeType é DOC, DOCX, JPG ou PNG` (PDF nativo fica de fora)
- Se `precisaConverter`: salvar com `previewStatus="PENDENTE"` + enfileirar job
- Se não precisa (PDF): salvar sem campos de preview

### 3. `services/api/src/modules/plano-aula/plano-aula.controller.ts` — Callback OnlyOffice

Após salvar arquivo editado (status=2), adicionar:
- Resetar `previewStatus = "PENDENTE"` no banco
- Enfileirar novo job de conversão com o `storageKey` atualizado

## Arquivos Afetados

| Arquivo | Tipo de Mudança |
|---|---|
| `services/worker/src/conversao/conversor.ts` | Adicionar suporte a imagens via LibreOffice |
| `services/api/src/modules/plano-aula/plano-aula.controller.ts` | Re-habilitar conversão no upload + re-disparar no callback |

## O que NÃO muda

- Fluxo do OnlyOffice (edição, salvamento, comentários)
- Campos `storageKey`, `fileUrl`, `fileKey`
- Lógica do botão no frontend
- Worker em si (apenas o conversor recebe adição)
- Tabela `prova_documento` (fora do escopo)
