# Desfazer Aprovação de Documento

> Design aprovado em 2026-02-13

## Problema

A analista pedagógica pode aprovar um documento por engano. Atualmente não há como desfazer a aprovação, forçando workarounds manuais.

## Solução

Adicionar botão "Desfazer Aprovação" que limpa `approvedBy` e `approvedAt`, voltando o documento ao estado não-aprovado.

## Decisões de Design

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Quem pode desfazer? | Qualquer `analista_pedagogico` da unidade | Flexibilidade, mesma regra da aprovação |
| Confirmação? | Não | Ação rápida e reversível (pode aprovar de novo) |
| Impacto na impressão? | Bloqueia "Imprimir" novamente | Comportamento consistente — só documento aprovado imprime |
| UI | Substituir "Aprovar" por "Desfazer" quando aprovado | Mesmo espaço, sem poluir a interface |

## Alterações Necessárias

### 1. Backend — Controller (`plano-aula.controller.ts`)

- Novo endpoint: `POST /plano-aula/documentos/:id/desaprovar`
- Role: `analista_pedagogico`
- Validação: documento deve existir e pertencer à mesma unidade

### 2. Backend — Service (`plano-aula.service.ts`)

- Novo método `desaprovarDocumento(user, documentoId)`
- Seta `approvedBy: null`, `approvedAt: null`, `updatedAt: new Date()`

### 3. Frontend — Hook (`use-plano-aula.ts`)

- Nova função `desaprovarDocumento(documentoId)`
- Chamada: `POST /plano-aula/documentos/${documentoId}/desaprovar`

### 4. Frontend — Componente (`documento-list.tsx`)

- Quando `canAprovar && documento.approvedBy`: mostrar botão "Desfazer" (laranja, ícone `Undo2`)
- Quando `canAprovar && !documento.approvedBy`: manter botão "Aprovar" atual (verde)

## O que NÃO muda

- Schema do banco de dados (sem migration — campos já aceitam `null`)
- Lógica de impressão (já depende de `approvedBy && approvedAt`)
- Badge "Aprovado" (já condicional)
- Componentes de upload/conversão
- Fila BullMQ / StorageService

## Fluxo

```
Analista vê documento aprovado por engano
  → Botão "Desfazer" aparece (laranja, ícone Undo2)
  → Clique direto (sem confirmação)
  → POST /plano-aula/documentos/:id/desaprovar
  → Banco: approvedBy = null, approvedAt = null
  → UI atualiza: badge "Aprovado" desaparece, botão "Imprimir" bloqueado
  → Botão volta a ser "Aprovar" (verde)
```
