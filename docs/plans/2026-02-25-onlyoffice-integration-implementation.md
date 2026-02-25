# Integração OnlyOffice - Plano de Implementação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir que usuários visualizem e editem documentos .doc/.docx diretamente no portal via OnlyOffice Document Server, removendo a conversão automática para PDF.

**Architecture:** OnlyOffice roda como container Docker separado acessível via `/onlyoffice/`. O frontend usa `@onlyoffice/document-editor-react` em modal fullscreen. A API NestJS fornece endpoints para gerar configuração do editor e receber callbacks de salvamento. O MinIO fornece URLs presigned para que o OnlyOffice acesse os arquivos.

**Tech Stack:** OnlyOffice Document Server (Docker), @onlyoffice/document-editor-react, NestJS (callback endpoint), MinIO (presigned URLs), JWT (autenticação OnlyOffice)

**Design doc:** `docs/plans/2026-02-25-onlyoffice-integration-design.md`

---

## Task 1: Adicionar OnlyOffice ao Docker Compose

**Files:**
- Modify: `docker-compose.prod.yml:331-336`
- Modify: `.env.docker`

**Step 1: Adicionar variáveis de ambiente**

Adicionar ao `.env.docker`:
```env
# OnlyOffice
ONLYOFFICE_JWT_SECRET=<gerar-com-openssl-rand-hex-32>
```

**Step 2: Adicionar serviço onlyoffice ao docker-compose.prod.yml**

Após o serviço `carbone` (linha 336), adicionar:

```yaml
  onlyoffice:
    image: onlyoffice/documentserver:latest
    container_name: essencia-onlyoffice
    <<: *common
    environment:
      JWT_ENABLED: "true"
      JWT_SECRET: ${ONLYOFFICE_JWT_SECRET}
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 2G
    healthcheck:
      <<: *healthcheck
      test: ["CMD", "curl", "-f", "http://localhost/healthcheck"]
      start_period: 60s
```

**Step 3: Adicionar ONLYOFFICE_JWT_SECRET à API**

No serviço `api` do docker-compose (linha 288-325), adicionar na seção environment:

```yaml
      ONLYOFFICE_JWT_SECRET: ${ONLYOFFICE_JWT_SECRET}
      ONLYOFFICE_URL: http://essencia-onlyoffice
      ONLYOFFICE_PUBLIC_URL: https://www.portalcef.com.br/onlyoffice
```

**Step 4: Testar container sobe**

```bash
docker compose --env-file .env.docker -f docker-compose.prod.yml up -d onlyoffice
docker compose --env-file .env.docker -f docker-compose.prod.yml ps onlyoffice
```
Expected: Status `healthy` após ~60s

**Step 5: Commit**

```bash
git add docker-compose.prod.yml .env.docker
git commit -m "infra: adicionar OnlyOffice Document Server ao docker-compose"
```

---

## Task 2: Configurar Nginx para OnlyOffice

**Files:**
- Modify: `nginx.conf` (após bloco `/storage/`, antes de `/planejamento`)

**Step 1: Adicionar location block para OnlyOffice**

No server block de `www.portalcef.com.br` (HTTPS), após o bloco `location ^~ /storage/` (linha ~438), adicionar:

```nginx
        # OnlyOffice Document Server
        location ^~ /onlyoffice/ {
            set $upstream_onlyoffice essencia-onlyoffice:80;
            proxy_pass http://$upstream_onlyoffice/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-Host $host;
            proxy_read_timeout 3600s;
            proxy_send_timeout 3600s;
        }
```

**Step 2: Restart nginx**

```bash
docker compose --env-file .env.docker -f docker-compose.prod.yml restart nginx
```

**Step 3: Testar acesso**

```bash
curl -s https://www.portalcef.com.br/onlyoffice/healthcheck
```
Expected: `true`

**Step 4: Commit**

```bash
git add nginx.conf
git commit -m "infra: adicionar proxy nginx para OnlyOffice"
```

---

## Task 3: Adicionar presigned URL ao StorageService

**Files:**
- Modify: `services/api/src/common/storage/storage.service.ts`

**Step 1: Adicionar import do GetObjectCommand e getSignedUrl**

No topo do arquivo, adicionar:

```typescript
import { PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
```

**Step 2: Instalar dependência do presigner**

```bash
cd services/api && pnpm add @aws-sdk/s3-request-presigner && cd ../..
```

**Step 3: Adicionar método getPresignedUrl**

Após o método `uploadBuffer` (linha ~148), adicionar:

```typescript
  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn });
  }
```

**Step 4: Rodar typecheck**

```bash
pnpm turbo typecheck --filter=@essencia/api
```
Expected: PASS

**Step 5: Commit**

```bash
git add services/api/src/common/storage/storage.service.ts services/api/package.json pnpm-lock.yaml
git commit -m "feat(storage): adicionar método getPresignedUrl para URLs temporárias do MinIO"
```

---

## Task 4: Criar endpoint de configuração do editor OnlyOffice

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.controller.ts`
- Modify: `services/api/src/modules/plano-aula/plano-aula.service.ts`

**Step 1: Adicionar dependência jsonwebtoken**

```bash
cd services/api && pnpm add jsonwebtoken @types/jsonwebtoken && cd ../..
```

**Step 2: Adicionar método no service para buscar documento por ID**

Em `plano-aula.service.ts`, adicionar método:

```typescript
  async getDocumentoById(planoId: string, documentoId: string) {
    const db = getDb();
    const documento = await db.query.planoDocumento.findFirst({
      where: and(
        eq(planoDocumento.id, documentoId),
        eq(planoDocumento.planoId, planoId),
      ),
    });
    if (!documento) {
      throw new NotFoundException("Documento não encontrado");
    }
    return documento;
  }
```

**Step 3: Adicionar endpoint GET editor-config no controller**

Após o endpoint de upload (~linha 353), adicionar:

```typescript
  @Get(":id/documentos/:docId/editor-config")
  @Roles(...VISUALIZAR_ACCESS)
  async getEditorConfig(
    @Req() req: { user: UserContext },
    @Param("id") planoId: string,
    @Param("docId") docId: string,
    @Query("mode") mode: "edit" | "view" = "view",
  ) {
    const documento = await this.planoAulaService.getDocumentoById(planoId, docId);

    if (!documento.storageKey) {
      throw new BadRequestException("Documento sem arquivo associado");
    }

    const isWord = documento.mimeType?.includes("word") ||
                   documento.mimeType?.includes("msword");
    if (!isWord) {
      throw new BadRequestException("Apenas documentos .doc/.docx podem ser abertos no editor");
    }

    // Gerar URL presigned para o OnlyOffice acessar o arquivo no MinIO
    const fileUrl = await this.storageService.getPresignedUrl(documento.storageKey, 3600);

    const onlyofficeUrl = this.configService.get<string>("ONLYOFFICE_PUBLIC_URL")
      || "https://www.portalcef.com.br/onlyoffice";
    const jwtSecret = this.configService.get<string>("ONLYOFFICE_JWT_SECRET");

    const callbackUrl = `https://www.portalcef.com.br/api/plano-aula/${planoId}/documentos/${docId}/onlyoffice-callback`;

    const config = {
      document: {
        fileType: documento.fileName?.endsWith(".doc") ? "doc" : "docx",
        key: `${docId}-${documento.updatedAt ? new Date(documento.updatedAt).getTime() : Date.now()}`,
        title: documento.fileName || "Documento",
        url: fileUrl,
      },
      documentType: "word",
      editorConfig: {
        mode: mode,
        lang: "pt",
        callbackUrl: mode === "edit" ? callbackUrl : undefined,
        customization: {
          autosave: true,
          forcesave: true,
        },
        user: {
          id: req.user.userId,
          name: req.user.name || "Usuário",
        },
      },
    };

    // Assinar config com JWT se configurado
    let token: string | undefined;
    if (jwtSecret) {
      const jwt = await import("jsonwebtoken");
      token = jwt.default.sign(config, jwtSecret);
    }

    return {
      success: true,
      data: {
        documentServerUrl: onlyofficeUrl,
        config: { ...config, token },
      },
    };
  }
```

**Step 4: Adicionar imports necessários no controller**

Adicionar `Query, BadRequestException` aos imports do `@nestjs/common`, e `ConfigService` ao constructor.

**Step 5: Rodar typecheck**

```bash
pnpm turbo typecheck --filter=@essencia/api
```
Expected: PASS

**Step 6: Commit**

```bash
git add services/api/
git commit -m "feat(plano-aula): adicionar endpoint editor-config para OnlyOffice"
```

---

## Task 5: Criar endpoint de callback do OnlyOffice

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.controller.ts`

**Step 1: Adicionar endpoint POST onlyoffice-callback**

Após o endpoint editor-config, adicionar:

```typescript
  @Post(":id/documentos/:docId/onlyoffice-callback")
  async onlyofficeCallback(
    @Param("id") planoId: string,
    @Param("docId") docId: string,
    @Body() body: { status: number; url?: string; key?: string },
  ) {
    // Status codes do OnlyOffice:
    // 0 - sem alteração
    // 1 - editando
    // 2 - pronto para salvar (documento fechado)
    // 3 - erro ao salvar
    // 4 - documento fechado sem mudanças
    // 6 - forçar salvamento enquanto edita
    // 7 - erro ao forçar salvamento

    if (body.status === 2 || body.status === 6) {
      if (!body.url) {
        this.logger.warn(`OnlyOffice callback sem URL para doc ${docId}`);
        return { error: 0 };
      }

      try {
        const documento = await this.planoAulaService.getDocumentoById(planoId, docId);

        // Baixar o documento atualizado da URL fornecida pelo OnlyOffice
        const response = await fetch(body.url);
        if (!response.ok) {
          throw new Error(`Falha ao baixar documento do OnlyOffice: ${response.status}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());

        // Substituir arquivo no MinIO (mesmo storageKey)
        await this.storageService.replaceFile(
          documento.storageKey!,
          buffer,
          documento.mimeType || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          documento.fileName || "documento.docx",
        );

        // Atualizar updatedAt e fileSize no banco
        await this.planoAulaService.atualizarDocumento(docId, {
          fileSize: buffer.length,
          updatedAt: new Date(),
        });

        this.logger.log(`Documento ${docId} atualizado via OnlyOffice`);
      } catch (error) {
        this.logger.error(`Erro ao salvar callback OnlyOffice: ${error}`);
      }
    }

    // OnlyOffice espera { error: 0 } como resposta de sucesso
    return { error: 0 };
  }
```

**Step 2: Adicionar método replaceFile ao StorageService**

Em `storage.service.ts`, adicionar:

```typescript
  async replaceFile(
    key: string,
    buffer: Buffer,
    mimetype: string,
    filename: string,
  ): Promise<void> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
        ContentDisposition: this.buildContentDisposition(filename),
      }),
    );
    this.logger.log(`File replaced successfully: ${key}`);
  }
```

**Step 3: Adicionar método atualizarDocumento ao PlanoAulaService**

Em `plano-aula.service.ts`, adicionar:

```typescript
  async atualizarDocumento(documentoId: string, dados: { fileSize?: number; updatedAt?: Date }) {
    const db = getDb();
    await db
      .update(planoDocumento)
      .set(dados)
      .where(eq(planoDocumento.id, documentoId));
  }
```

**Step 4: Rodar typecheck**

```bash
pnpm turbo typecheck --filter=@essencia/api
```
Expected: PASS

**Step 5: Commit**

```bash
git add services/api/
git commit -m "feat(plano-aula): adicionar callback endpoint para salvamento OnlyOffice"
```

---

## Task 6: Desabilitar conversão automática doc→PDF

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.controller.ts:309-337`

**Step 1: Remover enfileiramento da conversão**

No método `uploadDocumento`, substituir o bloco de conversão (linhas 309-337) por:

```typescript
      // Conversão doc→PDF desabilitada (OnlyOffice é usado para visualização/edição)
      // Salvar documento no banco via service
      const documento = await this.planoAulaService.adicionarDocumentoUpload(
        planoId,
        {
          tipo: "UPLOAD",
          fileName: uploadResult.name,
          fileKey: uploadResult.key,
          fileUrl: uploadResult.url,
          fileSize: buffer.length,
          mimeType: data.mimetype,
        },
      );
```

Isso remove o `previewStatus: "PENDENTE"` e o enfileiramento no BullMQ.

**Step 2: Rodar typecheck e lint**

```bash
pnpm turbo lint && pnpm turbo typecheck
```
Expected: PASS

**Step 3: Commit**

```bash
git add services/api/src/modules/plano-aula/plano-aula.controller.ts
git commit -m "refactor(plano-aula): desabilitar conversão automática doc-para-PDF"
```

---

## Task 7: Instalar componente React do OnlyOffice no frontend

**Files:**
- Modify: `apps/planejamento/package.json`

**Step 1: Instalar dependência**

```bash
cd apps/planejamento && pnpm add @onlyoffice/document-editor-react && cd ../..
```

**Step 2: Commit**

```bash
git add apps/planejamento/package.json pnpm-lock.yaml
git commit -m "deps(planejamento): instalar @onlyoffice/document-editor-react"
```

---

## Task 8: Criar componente DocumentoEditor

**Files:**
- Create: `apps/planejamento/features/plano-aula/components/documento-editor.tsx`

**Step 1: Criar o componente**

```tsx
"use client";

import { DocumentEditor } from "@onlyoffice/document-editor-react";
import { Dialog, DialogContent } from "@essencia/ui/components/dialog";
import { useState, useEffect } from "react";

interface DocumentoEditorProps {
  planoId: string;
  documentoId: string;
  mode: "edit" | "view";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EditorConfigResponse {
  documentServerUrl: string;
  config: Record<string, unknown>;
}

export function DocumentoEditorModal({
  planoId,
  documentoId,
  mode,
  open,
  onOpenChange,
}: DocumentoEditorProps) {
  const [editorConfig, setEditorConfig] = useState<EditorConfigResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEditorConfig(null);
      setError(null);
      return;
    }

    const fetchConfig = async () => {
      try {
        const res = await fetch(
          `/api/plano-aula/${planoId}/documentos/${documentoId}/editor-config?mode=${mode}`,
          { credentials: "include" },
        );
        if (!res.ok) throw new Error("Falha ao carregar configuração do editor");
        const json = await res.json();
        setEditorConfig(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      }
    };

    fetchConfig();
  }, [open, planoId, documentoId, mode]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0">
        {error && (
          <div className="flex items-center justify-center h-full text-destructive">
            {error}
          </div>
        )}
        {!editorConfig && !error && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Carregando editor...
          </div>
        )}
        {editorConfig && (
          <div className="w-full h-full">
            <DocumentEditor
              id={`editor-${documentoId}`}
              documentServerUrl={editorConfig.documentServerUrl}
              config={editorConfig.config}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Rodar typecheck**

```bash
pnpm turbo typecheck --filter=planejamento
```
Expected: PASS

**Step 3: Commit**

```bash
git add apps/planejamento/features/plano-aula/components/documento-editor.tsx
git commit -m "feat(planejamento): criar componente DocumentoEditorModal para OnlyOffice"
```

---

## Task 9: Adicionar botão "Editar" e integrar editor na lista de documentos

**Files:**
- Modify: `apps/planejamento/features/plano-aula/components/documento-list.tsx`

**Step 1: Adicionar import do DocumentoEditorModal e ícone Pencil**

No topo do arquivo, adicionar:

```typescript
import { DocumentoEditorModal } from "./documento-editor";
import { Pencil } from "lucide-react";
```

**Step 2: Adicionar estado para controlar o editor**

Dentro do componente `DocumentoList`, junto aos outros estados, adicionar:

```typescript
const [editorDocId, setEditorDocId] = useState<string | null>(null);
const [editorMode, setEditorMode] = useState<"edit" | "view">("view");
```

**Step 3: Criar helper para verificar se é editável**

Junto às outras funções helper:

```typescript
function isWordDocument(documento: PlanoDocumento): boolean {
  return (
    documento.mimeType?.includes("word") === true ||
    documento.mimeType?.includes("msword") === true
  );
}
```

**Step 4: Modificar botão "Ver Documento"**

Substituir o botão de preview (linhas 380-389) por:

```tsx
{isWordDocument(documento) ? (
  <Button
    variant="ghost"
    size="sm"
    className="h-8 gap-1"
    onClick={() => {
      setEditorMode("view");
      setEditorDocId(documento.id);
    }}
  >
    <Eye className="h-4 w-4" />
    Ver Documento
  </Button>
) : (
  <Button
    variant="ghost"
    size="sm"
    className="h-8 gap-1"
    onClick={() => setOpenDocId(documento.id)}
  >
    <Eye className="h-4 w-4" />
    Ver Documento
  </Button>
)}
```

**Step 5: Adicionar botão "Editar" após "Ver Documento"**

Logo após o botão "Ver Documento", adicionar:

```tsx
{isWordDocument(documento) && (
  <Button
    variant="ghost"
    size="sm"
    className="h-8 gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
    onClick={() => {
      setEditorMode("edit");
      setEditorDocId(documento.id);
    }}
    title="Editar documento no browser"
  >
    <Pencil className="h-4 w-4" />
    Editar
  </Button>
)}
```

**Step 6: Adicionar DocumentoEditorModal no JSX**

Após o `DocumentoPreviewModal` (linha ~465), adicionar:

```tsx
{isWordDocument(documento) && (
  <DocumentoEditorModal
    planoId={documento.planoId}
    documentoId={documento.id}
    mode={editorMode}
    open={editorDocId === documento.id}
    onOpenChange={(open) => setEditorDocId(open ? documento.id : null)}
  />
)}
```

**Step 7: Rodar lint e typecheck**

```bash
pnpm turbo lint && pnpm turbo typecheck
```
Expected: PASS

**Step 8: Commit**

```bash
git add apps/planejamento/features/plano-aula/components/documento-list.tsx
git commit -m "feat(planejamento): adicionar botões Editar e Ver via OnlyOffice para .doc/.docx"
```

---

## Task 10: Build e Deploy

**Step 1: Rodar pipeline de qualidade completo**

```bash
pnpm turbo lint && pnpm turbo typecheck
```
Expected: PASS sem erros

**Step 2: Rebuild imagens afetadas**

```bash
# API (tem novos endpoints)
docker build --no-cache -f docker/Dockerfile.api -t essencia-api:latest .

# Planejamento (tem novos componentes)
docker build --no-cache -f docker/Dockerfile.nextjs \
  --build-arg APP_NAME=planejamento --build-arg PACKAGE_NAME=planejamento \
  --build-arg APP_PORT=3007 \
  --build-arg NEXT_PUBLIC_API_URL=https://www.portalcef.com.br/api \
  --build-arg API_INTERNAL_URL=http://api:3002 \
  -t essencia-planejamento:latest .
```

**Step 3: Deploy com rolling update**

```bash
docker compose --env-file .env.docker -f docker-compose.prod.yml up -d onlyoffice
# Aguardar OnlyOffice ficar healthy (~60s)
sleep 60
docker compose --env-file .env.docker -f docker-compose.prod.yml up -d --force-recreate api planejamento
```

**Step 4: Verificar**

```bash
# OnlyOffice healthy
curl -s https://www.portalcef.com.br/onlyoffice/healthcheck

# API healthy
curl -s https://www.portalcef.com.br/api/health

# Containers
docker compose --env-file .env.docker -f docker-compose.prod.yml ps
```

**Step 5: Commit final**

```bash
git add -A
git commit -m "feat: integrar OnlyOffice para edição de documentos .doc/.docx no portal"
```

---

## Ordem de Dependência

```
Task 1 (Docker) → Task 2 (Nginx) → Task 3 (Presigned URL)
                                          ↓
Task 7 (NPM install) → Task 8 (Editor)   Task 4 (Editor Config) → Task 5 (Callback) → Task 6 (Desabilitar PDF)
                            ↓                                                                    ↓
                        Task 9 (Integrar UI) ←──────────────────────────────────────────────────────
                            ↓
                        Task 10 (Build & Deploy)
```

Tasks 1-2 (infra) e Tasks 7 (npm) podem ser feitas em paralelo.
Tasks 3-6 (backend) e Task 8 (frontend) podem ser feitas em paralelo.
Task 9 depende de Task 8 (componente pronto) e Tasks 4-5 (endpoints prontos).
Task 10 é sempre a última.
