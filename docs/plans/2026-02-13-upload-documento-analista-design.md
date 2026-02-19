# Upload de Documentos pela Analista Pedagógica

> Design aprovado em 2026-02-13

## Problema

A analista pedagógica precisa fazer pequenas correções em documentos dos planos de aula. O fluxo atual exige baixar o documento, corrigir no computador, devolver o plano para a professora, e aguardar que ela suba o documento corrigido. Ciclo desnecessariamente longo para pequenas correções.

## Solução

Adicionar capacidade de upload de documentos (arquivos + links YouTube) para a role `analista_pedagogico`, reutilizando toda a infraestrutura existente.

## Decisões de Design

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Documento novo ou substituição? | **Adicionar como novo** | Analista pode deletar o antigo manualmente (já tem permissão) |
| Quando disponível? | **Qualquer status do plano** | Flexibilidade total para a analista |
| Posição na UI? | **Painel de Ações** | Junto com Aprovar, Devolver, Criar Tarefa |
| Tipos de upload? | **Arquivos + YouTube** | Mesmas funcionalidades da professora |
| Abordagem técnica? | **Reutilizar componente e endpoint existentes** | Menor código novo, mesmas automações garantidas |

## Alterações Necessárias

### 1. Backend — Controller (`plano-aula.controller.ts`)

- Adicionar `analista_pedagogico` aos roles permitidos nos endpoints:
  - `POST /plano-aula/:id/documentos/upload`
  - `POST /plano-aula/:id/documentos/link`
- Ajustar validação de propriedade: aceitar se é dono do plano **OU** é `analista_pedagogico`

### 2. Frontend — Tela de Análise (`revisao-content.tsx`)

- Renderizar componente `DocumentoUpload` no painel de Ações
- Condição: sempre visível para `analista_pedagogico`
- Garantir polling de conversão (documentos `PENDENTE`) na tela de revisão

### 3. Frontend — Hook (`use-plano-aula.ts`)

- Reutilizar funções `uploadDocumento()` e `addLink()` existentes
- Garantir refetch da lista de documentos após upload

## O que NÃO muda

- Schema do banco de dados (nenhuma migration)
- Componente `DocumentoUpload` (reutilizado sem alteração)
- Componente `DocumentoList` (já exibe documentos novos via refetch)
- Fila de conversão BullMQ (já funciona para qualquer documento)
- Lógica de aprovação/impressão de documentos
- `StorageService` (MinIO)

## Fluxo Completo

```
Analista abre plano → Painel de Ações → Componente de Upload
  ├─ Arrasta arquivo ou clica para selecionar
  │   → POST /plano-aula/:id/documentos/upload (com role analista_pedagogico)
  │   → MinIO armazena arquivo
  │   → Se DOC/DOCX: fila de conversão BullMQ
  │   → Documento aparece na lista com polling automático
  │   → Histórico registra: "Documento enviado por [Analista]"
  │
  └─ Cola link do YouTube
      → POST /plano-aula/:id/documentos/link
      → Documento tipo LINK_YOUTUBE adicionado à lista
```
