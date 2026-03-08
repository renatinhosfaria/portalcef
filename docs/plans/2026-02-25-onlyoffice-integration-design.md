# Design: Integração OnlyOffice para Edição de Documentos no Portal

> Data: 25/02/2026
> Status: Aprovado

---

## Problema

As professoras precisam editar documentos .doc/.docx diretamente no portal, sem o ciclo de baixar, editar no Word, e re-enviar. O sistema atual converte documentos para PDF (apenas visualização), e o re-envio cria duplicatas no banco de dados, causando confusão.

## Solução

Integrar o OnlyOffice Document Server como serviço Docker para permitir visualização e edição de documentos .doc/.docx diretamente no browser. Remover a conversão automática para PDF.

---

## Arquitetura

### Fluxo Principal

```
Usuário clica "Editar" ou "Ver Documento"
       ↓
Frontend carrega componente React (@onlyoffice/document-editor-react)
       ↓
OnlyOffice busca o .docx do MinIO via URL assinada (presigned URL)
       ↓
Usuário visualiza ou edita no browser
       ↓
Ao fechar/salvar, OnlyOffice faz POST para callback URL da API
       ↓
API NestJS recebe o .docx atualizado, salva no MinIO (in-place), atualiza banco
```

### Comportamento por Tipo de Arquivo

| Tipo de arquivo         | "Ver Documento"                        | "Editar"                           |
|-------------------------|----------------------------------------|------------------------------------|
| `.doc` / `.docx`        | OnlyOffice (modo read-only)            | OnlyOffice (modo edição)           |
| `.pdf`                  | Preview nativo do browser (embed)      | Não disponível                     |
| `.png` / `.jpg` / `.jpeg` | Preview de imagem                    | Não disponível                     |

### Permissões

- **Todos os usuários** com acesso ao plano podem visualizar e editar documentos .doc/.docx.
- O botão "Editar" aparece apenas para arquivos .doc/.docx.

---

## Infraestrutura

### Novo container Docker

```yaml
onlyoffice:
  image: onlyoffice/documentserver:latest
  container_name: essencia-onlyoffice
  restart: unless-stopped
  environment:
    JWT_ENABLED: "true"
    JWT_SECRET: ${ONLYOFFICE_JWT_SECRET}
  deploy:
    resources:
      limits:
        memory: 4G
      reservations:
        memory: 2G
  networks:
    - essencia-prod
  healthcheck:
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 30s
    test: ["CMD", "curl", "-f", "http://localhost/healthcheck"]
```

### Nginx

```nginx
location /onlyoffice/ {
    proxy_pass http://essencia-onlyoffice/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Requisitos do Servidor

| Recurso        | Antes       | Após integração |
|----------------|-------------|-----------------|
| RAM usada      | ~5.3 GB     | ~9.3 GB (+4GB)  |
| RAM disponível | ~6.4 GB     | ~2.4 GB         |
| Containers     | 19          | 20              |

### Limite de 20 Conexões Simultâneas

A Community Edition limita a 20 editores simultâneos. Para o volume de uso do portal (10-20 usuários em pico), é suficiente. Se necessário no futuro, pode-se compilar do fonte (AGPL permite) ou adquirir licença Enterprise.

---

## Componentes Novos

### Backend (NestJS)

1. **Endpoint de configuração do editor**
   - `GET /api/plano-aula/:id/documentos/:docId/editor-config`
   - Retorna config JSON para o componente React do OnlyOffice
   - Inclui: URL presigned do MinIO, callbackUrl, token JWT do OnlyOffice, modo (edit/view)

2. **Endpoint de callback**
   - `POST /api/plano-aula/:id/documentos/:docId/onlyoffice-callback`
   - Recebe o documento editado do OnlyOffice
   - Baixa o .docx da URL fornecida pelo OnlyOffice
   - Substitui o arquivo no MinIO (mesmo storageKey)
   - Atualiza `updatedAt` no banco

3. **Endpoint de URL presigned**
   - `GET /api/plano-aula/:id/documentos/:docId/download-url`
   - Gera URL temporária (presigned) do MinIO para o OnlyOffice acessar o arquivo
   - TTL: 1 hora

### Frontend (Next.js/React)

1. **Componente `DocumentoEditor`**
   - Usa `@onlyoffice/document-editor-react`
   - Abre em modal fullscreen ou página dedicada
   - Props: `documentId`, `planoId`, `mode` (edit | view)

2. **Modificação em `DocumentoList`**
   - Botão "Editar" para arquivos .doc/.docx
   - Botão "Ver Documento" abre OnlyOffice em modo read-only para .doc/.docx
   - Para PDF: mantém embed nativo do browser
   - Para imagens: mantém preview de imagem

---

## O que é Removido

1. **Conversão automática doc/docx → PDF**
   - O worker não enfileira mais jobs de conversão para documentos Word
   - Os campos `previewKey`, `previewUrl`, `previewStatus`, etc. ficam no banco mas não são mais populados para novos uploads
   - PDFs previamente gerados continuam acessíveis (não são deletados)

2. **Container Carbone** (pode ser removido se não for usado para outra coisa)
   - Verificar se Carbone é usado em outro fluxo antes de remover

---

## Segurança

- **JWT obrigatório** entre API e OnlyOffice (variável `ONLYOFFICE_JWT_SECRET`)
- **URLs presigned** do MinIO com TTL curto (1h) para acesso aos arquivos
- **Callback autenticado** — verificar token JWT no header do callback do OnlyOffice
- **Read-only filesystem** no container OnlyOffice (mesma prática dos demais)

---

## Referências

- [OnlyOffice React Component](https://api.onlyoffice.com/docs/docs-api/get-started/frontend-frameworks/react/)
- [OnlyOffice Docker](https://github.com/ONLYOFFICE/Docker-DocumentServer)
- [OnlyOffice Callback Handler](https://api.onlyoffice.com/docs/docs-api/use-cases/editing/)
- [CVE-2025-66478](https://nextjs.org/blog/CVE-2025-66478) — Contexto do incidente de segurança que precedeu esta decisão
