# Design: Edição de Documentos via SharePoint + Word Desktop

> **Data:** 2026-03-29
> **Status:** Aprovado
> **Módulos afetados:** plano-aula, prova

---

## Problema

O OnlyOffice, usado atualmente para edição de documentos .doc/.docx no navegador, não reproduz a formatação do Microsoft Word com fidelidade. As professoras preparam material pedagógico com formatação cuidadosa e reclamam das diferenças de renderização (fontes, espaçamentos, quebras de página, margens).

## Decisão

Substituir a **edição** via OnlyOffice por edição no **Microsoft Word desktop**, usando o **SharePoint** como workspace temporário de edição. O OnlyOffice permanece exclusivamente para **visualização** (modo read-only). A conversão para PDF (worker, Carbone, LibreOffice) é removida inteiramente.

## Contexto

- Todas as professoras têm Word instalado em seus computadores pessoais (Windows)
- A escola não possui Microsoft 365 por usuário — será contratada 1 licença Business Basic (~R$30-40/mês)
- O MinIO continua como storage principal (source of truth)
- O SharePoint é usado apenas como workspace temporário durante edições
- Links de compartilhamento anônimos com expiração de 2 horas são aceitáveis

---

## Arquitetura

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  Portal CEF │────>│   API       │────>│    MinIO      │
│  (Browser)  │     │  (NestJS)   │     │  (Storage)   │
└──────┬──────┘     └──────┬──────┘     └──────────────┘
       │                   │
       │ ms-word://...     │ Graph API
       v                   v
┌─────────────┐     ┌──────────────┐
│ Word Desktop│────>│  SharePoint  │
│ (Professora)│     │  (Workspace) │
└─────────────┘     └──────┬───────┘
                           │ Webhook
                           v
                    ┌──────────────┐
                    │   API        │──> Copia de volta pro MinIO
                    │  (NestJS)    │
                    └──────────────┘
```

### Fluxos

#### Visualizar (coordenadora/professora)

Portal abre OnlyOffice em modo view (read-only) para renderizar o .docx no navegador. Sem alterações significativas em relação ao fluxo atual, exceto que os modos "edit" e "comentar" são removidos.

#### Editar (professora)

1. Professora clica "Editar no Word" no portal
2. API copia o .docx do MinIO para o SharePoint (via Graph API)
3. API gera link de compartilhamento anônimo (expiração: 2h, permissão: edição)
4. Portal recebe URL e redireciona via protocolo `ms-word:ofe|u|{sharepoint_url}`
5. Word desktop abre o arquivo direto do SharePoint
6. Professora edita e salva (Ctrl+S) — salva no SharePoint
7. Webhook do Microsoft Graph notifica a API (~30s a 5min de delay)
8. API baixa arquivo atualizado do SharePoint e substitui no MinIO
9. API remove arquivo temporário do SharePoint e revoga o link

#### Fallback: re-upload manual

Se o protocolo `ms-word:` não funcionar (cenário raro):

1. Professora clica "Enviar nova versão" no portal
2. Seleciona ou arrasta o .docx editado (drag-and-drop)
3. API valida o arquivo (.doc/.docx, max 100MB) e substitui no MinIO

---

## Integração com Microsoft Graph API

### Autenticação

App Registration no Azure Entra ID com credenciais de aplicação (client credentials flow). Nenhuma professora precisa de conta Microsoft.

**Permissões de aplicação necessárias:**

- `Files.ReadWrite.All` — ler/escrever arquivos no SharePoint
- `Sites.ReadWrite.All` — acessar o site SharePoint da escola

### Estrutura no SharePoint

```
SharePoint da Escola/
└── Documentos/
    └── edicao-temporaria/
        └── {documentoId}/
            └── arquivo.docx
```

Cada documento em edição fica numa pasta isolada pelo `documentoId`. Após sincronização, a pasta é removida.

### Webhooks

O Microsoft Graph envia notificações de mudança via webhook. As subscriptions expiram em no máximo 30 dias e precisam ser renovadas automaticamente.

**Validação:** na criação da subscription, o Graph envia POST com `validationToken`. O endpoint responde com o token em texto puro.

**Latência:** webhooks de mudança de arquivo podem demorar de 30 segundos a 5 minutos para chegar. Isso é aceitável para o caso de uso.

### Cron de limpeza (rede de segurança)

Job agendado a cada 30 minutos:

- Busca documentos com `editandoDesde` maior que 2 horas
- Verifica no SharePoint se houve modificação:
  - Sim: sincroniza de volta ao MinIO
  - Não: apenas remove do SharePoint e limpa os campos do banco
- Cobre cenários onde o webhook falha ou não chega

---

## Mudanças no Backend (API)

### Novos componentes

```
services/api/src/common/sharepoint/
├── sharepoint.module.ts
├── sharepoint.service.ts              # Integração com Graph API
└── sharepoint-webhook.controller.ts   # Recebe webhooks do Graph
```

### Novos endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/plano-aula/:id/documentos/:docId/editar-word` | Copia para SharePoint, gera link, retorna URL ms-word: |
| POST | `/plano-aula/:id/documentos/:docId/atualizar` | Re-upload manual (fallback) |
| POST | `/webhooks/graph` | Recebe webhooks do Microsoft Graph |

Os mesmos endpoints são replicados para o módulo **prova**.

### Endpoints removidos

| Rota | Motivo |
|------|--------|
| `POST /plano-aula/:id/documentos/:docId/onlyoffice-callback` | Era callback de salvamento do OnlyOffice |

Os mesmos endpoints equivalentes no módulo **prova** também são removidos.

### Endpoints simplificados

`GET /plano-aula/:id/documentos/:docId/editor-config` permanece, mas:

- Sempre retorna `mode: "view"` (somente leitura)
- Remove lógica de modo "edit" e "comentar"
- Remove callback URL

`GET /plano-aula/:id/documentos/:docId/download` **permanece** — o OnlyOffice viewer ainda precisa desse proxy para baixar o arquivo do MinIO e renderizar no navegador.

### SharePointService

Métodos:

- `uploadParaSharePoint(storageKey, fileName)` — copia MinIO para SharePoint
- `criarLinkCompartilhamento(itemId, expiracao)` — gera link anônimo de edição
- `baixarArquivo(itemId)` — baixa arquivo do SharePoint
- `removerArquivo(itemId)` — limpeza após sincronização
- `revogarLink(shareId)` — revoga link de compartilhamento
- `criarSubscription(recurso, callbackUrl)` — registra webhook
- `renovarSubscription(subscriptionId)` — renova webhook (expiram em 30 dias)

### Mudanças no schema do banco

**Novos campos** em `plano_documento` e `prova_documento`:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `sharepointItemId` | `text \| null` | ID do arquivo no SharePoint (durante edição) |
| `sharepointEditUrl` | `text \| null` | URL de edição gerada |
| `editandoDesde` | `timestamp \| null` | Quando a edição foi iniciada |

Campos temporários — preenchidos ao iniciar edição, limpos após sincronização.

**Campos removidos** de `plano_documento` e `prova_documento`:

| Campo | Motivo |
|-------|--------|
| `previewKey` | Não há mais preview PDF |
| `previewUrl` | Não há mais preview PDF |
| `previewMimeType` | Não há mais preview PDF |
| `previewStatus` | Não há mais preview PDF |
| `previewError` | Não há mais preview PDF |

### Novas variáveis de ambiente

```env
AZURE_TENANT_ID=xxx
AZURE_CLIENT_ID=xxx
AZURE_CLIENT_SECRET=xxx
SHAREPOINT_SITE_ID=xxx
SHAREPOINT_DRIVE_ID=xxx
```

### Novas dependências (packages)

| Pacote | Uso |
|--------|-----|
| `@microsoft/microsoft-graph-client` | SDK oficial do Graph API |
| `@azure/identity` | Autenticação com Azure (client credentials) |

---

## Mudanças no Frontend

### Tela do documento (plano-aula e prova)

**Botões de ação:**

| Botão | Ação |
|-------|------|
| "Visualizar" | Abre OnlyOffice em modo view (read-only) |
| "Editar no Word" | Chama API, recebe URL ms-word:, Word desktop abre |
| "Baixar" | Download do .docx original |
| "Enviar nova versão" | Re-upload manual (drag-and-drop, fallback) |

### Fluxo do botao "Editar no Word"

1. Professora clica no botão
2. Portal faz `GET /plano-aula/:id/documentos/:docId/editar-word`
3. API retorna `{ url: "ms-word:ofe|u|https://..." }`
4. Portal executa `window.location.href = url`
5. Portal mostra banner informativo: "O documento foi aberto no Word. Edite e salve normalmente (Ctrl+S). As alteracoes serao sincronizadas automaticamente com o portal."

### Componentes removidos

- Iframe/componente do editor OnlyOffice (modo edição)
- Lógica de modos "edit" e "comentar" no frontend

---

## Componentes removidos da infraestrutura

| Componente | Descrição |
|------------|-----------|
| Worker service (`services/worker/`) | Container inteiro removido |
| Container Carbone | Serviço de conversão removido |
| LibreOffice (dependência do worker) | Não há mais conversão |
| BullMQ queue `documentos-conversao` | Fila de conversão removida |
| Queue service (`documentos-conversao.queue.ts`) | Código de enfileiramento removido |

**O container OnlyOffice permanece** para visualização read-only.

---

## Tratamento de erros

| Cenário | Comportamento |
|---------|---------------|
| Graph API fora do ar ao iniciar edição | Mensagem de erro: "Servico temporariamente indisponivel, tente novamente" |
| Link expira (2h) sem salvar | Arquivo removido do SharePoint na limpeza. Nenhuma alteracao no MinIO |
| Webhook não chega | Cron de limpeza (30min) verifica e sincroniza pendências |
| Professora abre mas não edita | Limpeza automática remove após expiração |
| Duas professoras editam o mesmo doc | Cenário improvável (doc pertence a um plano de uma professora). Se ocorrer, última a salvar vence |
| Protocolo ms-word: não funciona | Fallback de re-upload manual via "Enviar nova versão" |

---

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Graph API fora do ar | Fallback de re-upload manual sempre disponível |
| Webhook não chega ou atrasa | Cron de limpeza a cada 30min como rede de segurança |
| Link expira sem salvar | Limpeza automática, sem impacto no MinIO |
| Professora não tem Word | Fallback de re-upload + OnlyOffice em modo view |
| Microsoft muda API/precos | MinIO continua como source of truth, migração possível |
| Dependência da Microsoft para edição | Fallback de re-upload é independente |

---

## Pré-requisitos

1. Contratar **Microsoft 365 Business Basic** (1 licença, ~R$30-40/mês)
2. Criar **App Registration** no Azure Entra ID com permissões `Files.ReadWrite.All` e `Sites.ReadWrite.All`
3. Criar um **site SharePoint** para o portal (ex: "Portal CEF - Documentos")
4. Configurar **variáveis de ambiente** no servidor de produção
