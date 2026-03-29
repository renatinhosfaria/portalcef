# Edição de Documentos via SharePoint + Word Desktop — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a edição via OnlyOffice por Word desktop usando SharePoint como workspace temporário, mantendo OnlyOffice apenas para visualização read-only.

**Architecture:** O MinIO continua como storage principal. Quando uma professora clica "Editar no Word", a API copia o arquivo para o SharePoint via Microsoft Graph API, gera um link anônimo de edição, e retorna uma URL `ms-word:` que abre o Word desktop. Um webhook do Graph notifica a API quando o arquivo é salvo, sincronizando de volta ao MinIO. O worker de conversão PDF, Carbone e LibreOffice são removidos.

**Tech Stack:** NestJS, Microsoft Graph API (`@microsoft/microsoft-graph-client`, `@azure/identity`), Drizzle ORM, Next.js (App Router), shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-29-sharepoint-word-desktop-editing-design.md`

---

## Estrutura de Arquivos

### Novos arquivos

| Arquivo | Responsabilidade |
|---------|------------------|
| `services/api/src/common/sharepoint/sharepoint.module.ts` | Módulo NestJS do SharePoint |
| `services/api/src/common/sharepoint/sharepoint.service.ts` | Integração com Microsoft Graph API |
| `services/api/src/common/sharepoint/sharepoint.service.spec.ts` | Testes do SharePointService |
| `services/api/src/common/sharepoint/sharepoint-webhook.controller.ts` | Endpoint de webhook do Graph |
| `services/api/src/common/sharepoint/sharepoint-webhook.controller.spec.ts` | Testes do webhook controller |
| `services/api/src/common/sharepoint/sharepoint-cleanup.service.ts` | Cron de limpeza de arquivos expirados |
| `services/api/src/common/sharepoint/sharepoint-cleanup.service.spec.ts` | Testes do cron de limpeza |

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `packages/db/src/schema/plano-aula.ts` | Adicionar campos SharePoint, remover campos preview |
| `packages/db/src/schema/prova.ts` | Adicionar campos SharePoint, remover campos preview |
| `services/api/src/modules/plano-aula/plano-aula.controller.ts` | Adicionar endpoint editar-word e atualizar, simplificar editor-config, remover callback e lógica de conversão |
| `services/api/src/modules/plano-aula/plano-aula.service.ts` | Adicionar métodos para edição SharePoint |
| `services/api/src/modules/plano-aula/plano-aula.module.ts` | Importar SharePointModule, remover DocumentosConversaoModule |
| `services/api/src/modules/prova/prova.controller.ts` | Mesmas mudanças do plano-aula controller |
| `services/api/src/modules/prova/prova.service.ts` | Adicionar métodos para edição SharePoint |
| `services/api/src/modules/prova/prova.module.ts` | Importar SharePointModule, remover DocumentosConversaoModule |
| `services/api/src/app.module.ts` | Importar SharePointModule e ScheduleModule, remover DocumentosConversaoModule |
| `apps/planejamento/features/plano-aula/components/documento-list.tsx` | Substituir botão editar por "Editar no Word", adicionar "Enviar nova versão", remover preview status |
| `apps/planejamento/features/plano-aula/components/documento-editor.tsx` | Simplificar para modo view apenas |
| `apps/planejamento/features/plano-aula/types.ts` | Adicionar campos SharePoint, remover campos preview |
| `docker-compose.prod.yml` | Remover services worker e carbone, adicionar variáveis Azure na API |
| `services/api/package.json` | Adicionar dependências Graph API |

### Arquivos removidos

| Arquivo | Motivo |
|---------|--------|
| `services/api/src/common/queues/documentos-conversao.queue.ts` | Fila de conversão não é mais necessária |
| `services/api/src/common/queues/documentos-conversao.module.ts` | Módulo da fila não é mais necessário |
| `services/worker/` (diretório inteiro) | Worker de conversão removido |

---

## Task 1: Instalar dependências do Microsoft Graph

**Files:**
- Modify: `services/api/package.json`

- [ ] **Step 1: Instalar pacotes**

```bash
cd /var/www/essencia && pnpm --filter api add @microsoft/microsoft-graph-client @azure/identity isomorphic-fetch @nestjs/schedule
```

> `@microsoft/microsoft-graph-client` — SDK oficial do Graph API
> `@azure/identity` — autenticação com Azure (client credentials)
> `isomorphic-fetch` — requerido pelo Graph client no Node.js
> `@nestjs/schedule` — para o cron de limpeza

- [ ] **Step 2: Instalar tipos**

```bash
cd /var/www/essencia && pnpm --filter api add -D @types/isomorphic-fetch
```

- [ ] **Step 3: Verificar instalação**

```bash
cd /var/www/essencia && pnpm turbo typecheck --filter=api
```

Expected: BUILD sem erros.

- [ ] **Step 4: Commit**

```bash
git add services/api/package.json pnpm-lock.yaml
git commit -m "feat: adicionar dependências Microsoft Graph API e @nestjs/schedule"
```

---

## Task 2: Criar SharePointService

**Files:**
- Create: `services/api/src/common/sharepoint/sharepoint.service.ts`
- Create: `services/api/src/common/sharepoint/sharepoint.service.spec.ts`
- Create: `services/api/src/common/sharepoint/sharepoint.module.ts`

- [ ] **Step 1: Escrever teste do SharePointService**

```typescript
// services/api/src/common/sharepoint/sharepoint.service.spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { SharePointService } from "./sharepoint.service";
import { StorageService } from "../storage/storage.service";

describe("SharePointService", () => {
  let service: SharePointService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        AZURE_TENANT_ID: "test-tenant-id",
        AZURE_CLIENT_ID: "test-client-id",
        AZURE_CLIENT_SECRET: "test-client-secret",
        SHAREPOINT_SITE_ID: "test-site-id",
        SHAREPOINT_DRIVE_ID: "test-drive-id",
      };
      return config[key];
    }),
  };

  const mockStorageService = {
    getObject: jest.fn(),
    replaceFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharePointService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<SharePointService>(SharePointService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it("deve ser definido", () => {
    expect(service).toBeDefined();
  });

  it("deve retornar true para isConfigurado quando todas as variáveis existem", () => {
    expect(service.isConfigurado()).toBe(true);
  });

  it("deve retornar false para isConfigurado quando faltam variáveis", () => {
    mockConfigService.get.mockReturnValue(undefined);
    const service2 = new SharePointService(
      mockConfigService as unknown as ConfigService,
      mockStorageService as unknown as StorageService,
    );
    expect(service2.isConfigurado()).toBe(false);
  });

  it("deve construir URL ms-word corretamente", () => {
    const shareUrl = "https://escola.sharepoint.com/:w:/s/site/EaBcDeFg?e=xYz";
    const result = service.construirMsWordUrl(shareUrl);
    expect(result).toBe(`ms-word:ofe|u|${shareUrl}`);
  });
});
```

- [ ] **Step 2: Rodar teste para verificar que falha**

```bash
cd /var/www/essencia/services/api && npx vitest run src/common/sharepoint/sharepoint.service.spec.ts 2>&1 | head -30
```

Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar SharePointService**

```typescript
// services/api/src/common/sharepoint/sharepoint.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import "isomorphic-fetch";

import { StorageService } from "../storage/storage.service";

@Injectable()
export class SharePointService {
  private readonly logger = new Logger(SharePointService.name);
  private client: Client | null = null;

  private readonly tenantId: string | undefined;
  private readonly clientId: string | undefined;
  private readonly clientSecret: string | undefined;
  private readonly siteId: string | undefined;
  private readonly driveId: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
  ) {
    this.tenantId = this.configService.get<string>("AZURE_TENANT_ID");
    this.clientId = this.configService.get<string>("AZURE_CLIENT_ID");
    this.clientSecret = this.configService.get<string>("AZURE_CLIENT_SECRET");
    this.siteId = this.configService.get<string>("SHAREPOINT_SITE_ID");
    this.driveId = this.configService.get<string>("SHAREPOINT_DRIVE_ID");

    if (this.isConfigurado()) {
      this.inicializarClient();
    } else {
      this.logger.warn(
        "SharePoint não configurado — variáveis AZURE_* ou SHAREPOINT_* ausentes",
      );
    }
  }

  isConfigurado(): boolean {
    return !!(
      this.tenantId &&
      this.clientId &&
      this.clientSecret &&
      this.siteId &&
      this.driveId
    );
  }

  private inicializarClient(): void {
    const credential = new ClientSecretCredential(
      this.tenantId!,
      this.clientId!,
      this.clientSecret!,
    );

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ["https://graph.microsoft.com/.default"],
    });

    this.client = Client.initWithMiddleware({ authProvider });
  }

  private getClient(): Client {
    if (!this.client) {
      throw new Error("SharePoint não configurado");
    }
    return this.client;
  }

  /**
   * Copia um arquivo do MinIO para o SharePoint na pasta edicao-temporaria/{documentoId}/
   * Retorna o itemId do arquivo no SharePoint.
   */
  async uploadParaSharePoint(
    storageKey: string,
    fileName: string,
    documentoId: string,
  ): Promise<string> {
    const client = this.getClient();

    // Baixar arquivo do MinIO
    const s3Response = await this.storageService.getObject(storageKey);
    const chunks: Buffer[] = [];
    const stream = s3Response.Body as NodeJS.ReadableStream;
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk as Buffer));
    }
    const buffer = Buffer.concat(chunks);

    // Upload para SharePoint
    const uploadPath = `/drives/${this.driveId}/root:/edicao-temporaria/${documentoId}/${fileName}:/content`;

    const response = await client
      .api(`/sites/${this.siteId}${uploadPath}`)
      .putStream(buffer);

    this.logger.log(
      `Arquivo ${fileName} copiado para SharePoint (documentoId: ${documentoId})`,
    );

    return response.id;
  }

  /**
   * Cria um link de compartilhamento anônimo com permissão de edição.
   * Retorna a URL de compartilhamento e o shareId.
   */
  async criarLinkCompartilhamento(
    itemId: string,
    expiracaoHoras: number = 2,
  ): Promise<{ url: string; shareId: string }> {
    const client = this.getClient();

    const expiracao = new Date();
    expiracao.setHours(expiracao.getHours() + expiracaoHoras);

    const response = await client
      .api(
        `/sites/${this.siteId}/drives/${this.driveId}/items/${itemId}/createLink`,
      )
      .post({
        type: "edit",
        scope: "anonymous",
        expirationDateTime: expiracao.toISOString(),
      });

    return {
      url: response.link.webUrl,
      shareId: response.id,
    };
  }

  /**
   * Baixa o conteúdo de um arquivo do SharePoint.
   * Retorna o buffer do arquivo.
   */
  async baixarArquivo(itemId: string): Promise<Buffer> {
    const client = this.getClient();

    const stream = await client
      .api(
        `/sites/${this.siteId}/drives/${this.driveId}/items/${itemId}/content`,
      )
      .getStream();

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk as Buffer));
    }
    return Buffer.concat(chunks);
  }

  /**
   * Verifica se um arquivo foi modificado após uma data específica.
   */
  async foiModificadoApos(
    itemId: string,
    data: Date,
  ): Promise<boolean> {
    const client = this.getClient();

    try {
      const item = await client
        .api(
          `/sites/${this.siteId}/drives/${this.driveId}/items/${itemId}`,
        )
        .select("lastModifiedDateTime")
        .get();

      const lastModified = new Date(item.lastModifiedDateTime);
      return lastModified > data;
    } catch {
      return false;
    }
  }

  /**
   * Remove um arquivo do SharePoint.
   */
  async removerArquivo(itemId: string): Promise<void> {
    const client = this.getClient();

    try {
      await client
        .api(
          `/sites/${this.siteId}/drives/${this.driveId}/items/${itemId}`,
        )
        .delete();

      this.logger.log(`Arquivo ${itemId} removido do SharePoint`);
    } catch (error) {
      this.logger.warn(
        `Falha ao remover arquivo ${itemId} do SharePoint: ${error}`,
      );
    }
  }

  /**
   * Revoga um link de compartilhamento.
   */
  async revogarLink(itemId: string, shareId: string): Promise<void> {
    const client = this.getClient();

    try {
      await client
        .api(
          `/sites/${this.siteId}/drives/${this.driveId}/items/${itemId}/permissions/${shareId}`,
        )
        .delete();
    } catch (error) {
      this.logger.warn(
        `Falha ao revogar link ${shareId}: ${error}`,
      );
    }
  }

  /**
   * Cria uma subscription (webhook) para notificações de mudança.
   * Subscriptions expiram em no máximo ~30 dias para drives.
   */
  async criarSubscription(callbackUrl: string): Promise<string> {
    const client = this.getClient();

    const expiracao = new Date();
    expiracao.setDate(expiracao.getDate() + 29); // 29 dias (margem de segurança)

    const response = await client.api("/subscriptions").post({
      changeType: "updated",
      notificationUrl: callbackUrl,
      resource: `/sites/${this.siteId}/drives/${this.driveId}/root/children`,
      expirationDateTime: expiracao.toISOString(),
      clientState: "essencia-portal-webhook",
    });

    this.logger.log(
      `Subscription criada: ${response.id} (expira em ${expiracao.toISOString()})`,
    );

    return response.id;
  }

  /**
   * Renova uma subscription existente.
   */
  async renovarSubscription(subscriptionId: string): Promise<void> {
    const client = this.getClient();

    const expiracao = new Date();
    expiracao.setDate(expiracao.getDate() + 29);

    await client.api(`/subscriptions/${subscriptionId}`).patch({
      expirationDateTime: expiracao.toISOString(),
    });

    this.logger.log(
      `Subscription ${subscriptionId} renovada até ${expiracao.toISOString()}`,
    );
  }

  /**
   * Constrói a URL ms-word: para abrir no Word desktop.
   */
  construirMsWordUrl(sharePointUrl: string): string {
    return `ms-word:ofe|u|${sharePointUrl}`;
  }
}
```

- [ ] **Step 4: Criar módulo SharePoint**

```typescript
// services/api/src/common/sharepoint/sharepoint.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { StorageModule } from "../storage/storage.module";
import { SharePointService } from "./sharepoint.service";

@Module({
  imports: [ConfigModule, StorageModule.forRoot()],
  providers: [SharePointService],
  exports: [SharePointService],
})
export class SharePointModule {}
```

- [ ] **Step 5: Rodar testes para verificar que passam**

```bash
cd /var/www/essencia/services/api && npx vitest run src/common/sharepoint/sharepoint.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/common/sharepoint/
git commit -m "feat: criar SharePointService com integração Microsoft Graph API"
```

---

## Task 3: Criar SharePoint Webhook Controller

**Files:**
- Create: `services/api/src/common/sharepoint/sharepoint-webhook.controller.ts`
- Create: `services/api/src/common/sharepoint/sharepoint-webhook.controller.spec.ts`

- [ ] **Step 1: Escrever teste do webhook controller**

```typescript
// services/api/src/common/sharepoint/sharepoint-webhook.controller.spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { SharePointWebhookController } from "./sharepoint-webhook.controller";
import { SharePointService } from "./sharepoint.service";
import { StorageService } from "../storage/storage.service";

// Mock dinâmico dos services de plano-aula e prova
const mockPlanoAulaService = {
  getDocumentoById: jest.fn(),
  atualizarDocumento: jest.fn(),
};

const mockProvaService = {
  getDocumentoById: jest.fn(),
  atualizarDocumento: jest.fn(),
};

const mockSharePointService = {
  baixarArquivo: jest.fn(),
  removerArquivo: jest.fn(),
  revogarLink: jest.fn(),
};

const mockStorageService = {
  replaceFile: jest.fn(),
};

describe("SharePointWebhookController", () => {
  let controller: SharePointWebhookController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SharePointWebhookController],
      providers: [
        { provide: SharePointService, useValue: mockSharePointService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: "PlanoAulaService", useValue: mockPlanoAulaService },
        { provide: "ProvaService", useValue: mockProvaService },
      ],
    }).compile();

    controller = module.get<SharePointWebhookController>(
      SharePointWebhookController,
    );
  });

  it("deve ser definido", () => {
    expect(controller).toBeDefined();
  });

  it("deve responder com validationToken na validação do webhook", async () => {
    const result = await controller.handleWebhook(
      "test-validation-token",
      undefined,
    );
    expect(result).toBe("test-validation-token");
  });
});
```

- [ ] **Step 2: Rodar teste para verificar que falha**

```bash
cd /var/www/essencia/services/api && npx vitest run src/common/sharepoint/sharepoint-webhook.controller.spec.ts 2>&1 | head -20
```

Expected: FAIL — controller não existe.

- [ ] **Step 3: Implementar webhook controller**

```typescript
// services/api/src/common/sharepoint/sharepoint-webhook.controller.ts
import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Logger,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { FastifyReply } from "fastify";

import { Public } from "../decorators/public.decorator";
import { StorageService } from "../storage/storage.service";
import { SharePointService } from "./sharepoint.service";

interface GraphNotification {
  value: Array<{
    subscriptionId: string;
    clientState: string;
    changeType: string;
    resource: string;
    resourceData: {
      id: string;
      "@odata.type": string;
      "@odata.id": string;
    };
  }>;
}

@Controller("webhooks")
export class SharePointWebhookController {
  private readonly logger = new Logger(SharePointWebhookController.name);

  constructor(
    private readonly sharePointService: SharePointService,
    private readonly storageService: StorageService,
    @Inject("PlanoAulaService") private readonly planoAulaService: any,
    @Inject("ProvaService") private readonly provaService: any,
  ) {}

  /**
   * POST /webhooks/graph
   * Recebe webhooks do Microsoft Graph para notificações de mudança de arquivos.
   *
   * Na criação da subscription, o Graph envia POST com ?validationToken=xxx.
   * O endpoint responde com o token em texto puro (requisito da Microsoft).
   *
   * Nas notificações normais, o corpo contém as mudanças detectadas.
   */
  @Post("graph")
  @Public()
  @HttpCode(200)
  async handleWebhook(
    @Query("validationToken") validationToken?: string,
    @Body() body?: GraphNotification,
  ): Promise<string | { status: string }> {
    // Validação da subscription — responder com o token em texto puro
    if (validationToken) {
      this.logger.log("Validação de subscription do Graph recebida");
      return validationToken;
    }

    // Processar notificações de mudança
    if (!body?.value?.length) {
      return { status: "ok" };
    }

    for (const notification of body.value) {
      if (notification.clientState !== "essencia-portal-webhook") {
        this.logger.warn(
          `Webhook com clientState inválido: ${notification.clientState}`,
        );
        continue;
      }

      // O resource contém o path do item alterado no drive
      // Extrair o documentoId do path: edicao-temporaria/{documentoId}/arquivo.docx
      const resourcePath = notification.resource;
      const match = resourcePath.match(
        /edicao-temporaria\/([a-f0-9-]+)\//i,
      );

      if (!match) {
        this.logger.debug(
          `Notificação ignorada — path não corresponde a edição temporária: ${resourcePath}`,
        );
        continue;
      }

      const documentoId = match[1];
      this.logger.log(
        `Notificação de mudança recebida para documento ${documentoId}`,
      );

      try {
        await this.sincronizarDocumento(documentoId);
      } catch (error) {
        this.logger.error(
          `Erro ao sincronizar documento ${documentoId}: ${error}`,
        );
      }
    }

    return { status: "ok" };
  }

  /**
   * Sincroniza um documento do SharePoint de volta para o MinIO.
   * Busca o documento nos dois módulos (plano-aula e prova).
   */
  private async sincronizarDocumento(documentoId: string): Promise<void> {
    // Tentar encontrar o documento em plano_documento ou prova_documento
    let documento: any = null;
    let service: any = null;

    try {
      documento =
        await this.planoAulaService.getDocumentoByIdDireto(documentoId);
      service = this.planoAulaService;
    } catch {
      try {
        documento =
          await this.provaService.getDocumentoByIdDireto(documentoId);
        service = this.provaService;
      } catch {
        this.logger.warn(
          `Documento ${documentoId} não encontrado em nenhuma tabela`,
        );
        return;
      }
    }

    if (!documento?.sharepointItemId || !documento?.storageKey) {
      this.logger.warn(
        `Documento ${documentoId} sem sharepointItemId ou storageKey`,
      );
      return;
    }

    // Baixar arquivo atualizado do SharePoint
    const buffer = await this.sharePointService.baixarArquivo(
      documento.sharepointItemId,
    );

    // Substituir no MinIO
    await this.storageService.replaceFile(
      documento.storageKey,
      buffer,
      documento.mimeType ||
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      documento.fileName || "documento.docx",
    );

    // Limpar campos SharePoint e atualizar tamanho do arquivo
    await service.atualizarDocumento(documentoId, {
      fileSize: buffer.length,
      updatedAt: new Date(),
      sharepointItemId: null,
      sharepointEditUrl: null,
      editandoDesde: null,
    });

    // Limpar arquivo temporário do SharePoint
    await this.sharePointService.removerArquivo(documento.sharepointItemId);

    this.logger.log(
      `Documento ${documentoId} sincronizado do SharePoint para MinIO (${buffer.length} bytes)`,
    );
  }
}
```

- [ ] **Step 4: Rodar teste para verificar que passa**

```bash
cd /var/www/essencia/services/api && npx vitest run src/common/sharepoint/sharepoint-webhook.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/common/sharepoint/sharepoint-webhook.controller.ts services/api/src/common/sharepoint/sharepoint-webhook.controller.spec.ts
git commit -m "feat: criar controller de webhook do Microsoft Graph"
```

---

## Task 4: Criar cron de limpeza do SharePoint

**Files:**
- Create: `services/api/src/common/sharepoint/sharepoint-cleanup.service.ts`
- Create: `services/api/src/common/sharepoint/sharepoint-cleanup.service.spec.ts`

- [ ] **Step 1: Escrever teste do cron de limpeza**

```typescript
// services/api/src/common/sharepoint/sharepoint-cleanup.service.spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { SharePointCleanupService } from "./sharepoint-cleanup.service";
import { SharePointService } from "./sharepoint.service";
import { StorageService } from "../storage/storage.service";

const mockSharePointService = {
  isConfigurado: jest.fn().mockReturnValue(true),
  foiModificadoApos: jest.fn(),
  baixarArquivo: jest.fn(),
  removerArquivo: jest.fn(),
};

const mockStorageService = {
  replaceFile: jest.fn(),
};

// Mock do DatabaseService usando drizzle
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([]),
};

describe("SharePointCleanupService", () => {
  let service: SharePointCleanupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharePointCleanupService,
        { provide: SharePointService, useValue: mockSharePointService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: "DATABASE_CONNECTION", useValue: mockDb },
      ],
    }).compile();

    service = module.get<SharePointCleanupService>(SharePointCleanupService);
  });

  it("deve ser definido", () => {
    expect(service).toBeDefined();
  });
});
```

- [ ] **Step 2: Rodar teste para verificar que falha**

```bash
cd /var/www/essencia/services/api && npx vitest run src/common/sharepoint/sharepoint-cleanup.service.spec.ts 2>&1 | head -20
```

Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar cron de limpeza**

```typescript
// services/api/src/common/sharepoint/sharepoint-cleanup.service.ts
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { and, isNotNull, lt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { planoDocumento } from "@essencia/db/schema/plano-aula";
import { provaDocumento } from "@essencia/db/schema/prova";
import { StorageService } from "../storage/storage.service";
import { SharePointService } from "./sharepoint.service";

@Injectable()
export class SharePointCleanupService {
  private readonly logger = new Logger(SharePointCleanupService.name);

  constructor(
    private readonly sharePointService: SharePointService,
    private readonly storageService: StorageService,
    @Inject("DATABASE_CONNECTION")
    private readonly db: NodePgDatabase,
  ) {}

  /**
   * Cron executado a cada 30 minutos.
   * Busca documentos com edição expirada (> 2 horas) e sincroniza/limpa.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async limparEdicoesExpiradas(): Promise<void> {
    if (!this.sharePointService.isConfigurado()) return;

    const limiteExpiracao = new Date();
    limiteExpiracao.setHours(limiteExpiracao.getHours() - 2);

    this.logger.log("Iniciando limpeza de edições expiradas no SharePoint...");

    await this.limparTabela(planoDocumento, "plano_documento", limiteExpiracao);
    await this.limparTabela(provaDocumento, "prova_documento", limiteExpiracao);
  }

  private async limparTabela(
    tabela: typeof planoDocumento | typeof provaDocumento,
    nomeTabela: string,
    limiteExpiracao: Date,
  ): Promise<void> {
    const documentosExpirados = await this.db
      .select()
      .from(tabela)
      .where(
        and(
          isNotNull(tabela.sharepointItemId),
          isNotNull(tabela.editandoDesde),
          lt(tabela.editandoDesde, limiteExpiracao),
        ),
      );

    for (const doc of documentosExpirados) {
      try {
        const foiModificado = await this.sharePointService.foiModificadoApos(
          doc.sharepointItemId!,
          doc.editandoDesde!,
        );

        if (foiModificado && doc.storageKey) {
          // Sincronizar de volta ao MinIO
          const buffer = await this.sharePointService.baixarArquivo(
            doc.sharepointItemId!,
          );
          await this.storageService.replaceFile(
            doc.storageKey,
            buffer,
            doc.mimeType ||
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            doc.fileName || "documento.docx",
          );
          this.logger.log(
            `Documento ${doc.id} sincronizado do SharePoint (expirado)`,
          );
        }

        // Remover do SharePoint e limpar campos
        await this.sharePointService.removerArquivo(doc.sharepointItemId!);

        await this.db
          .update(tabela)
          .set({
            sharepointItemId: null,
            sharepointEditUrl: null,
            editandoDesde: null,
            updatedAt: new Date(),
            ...(foiModificado ? { fileSize: undefined } : {}),
          })
          .where(
            // @ts-expect-error — ambas as tabelas têm campo id
            tabela.id.equals(doc.id),
          );

        this.logger.log(
          `Documento ${doc.id} limpo do SharePoint (${nomeTabela}, ${foiModificado ? "com" : "sem"} modificações)`,
        );
      } catch (error) {
        this.logger.error(
          `Erro ao limpar documento ${doc.id} do SharePoint: ${error}`,
        );
      }
    }

    if (documentosExpirados.length > 0) {
      this.logger.log(
        `Limpeza ${nomeTabela}: ${documentosExpirados.length} documentos processados`,
      );
    }
  }
}
```

- [ ] **Step 4: Atualizar SharePointModule para incluir o cleanup e o webhook**

Substituir o conteúdo de `services/api/src/common/sharepoint/sharepoint.module.ts`:

```typescript
// services/api/src/common/sharepoint/sharepoint.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { StorageModule } from "../storage/storage.module";
import { SharePointService } from "./sharepoint.service";
import { SharePointWebhookController } from "./sharepoint-webhook.controller";
import { SharePointCleanupService } from "./sharepoint-cleanup.service";

@Module({
  imports: [ConfigModule, StorageModule.forRoot()],
  controllers: [SharePointWebhookController],
  providers: [SharePointService, SharePointCleanupService],
  exports: [SharePointService],
})
export class SharePointModule {}
```

> **Nota:** O `SharePointWebhookController` injeta `PlanoAulaService` e `ProvaService` via token. Esses providers serão registrados quando os módulos forem conectados na Task 7.

- [ ] **Step 5: Rodar teste para verificar que passa**

```bash
cd /var/www/essencia/services/api && npx vitest run src/common/sharepoint/sharepoint-cleanup.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/common/sharepoint/
git commit -m "feat: criar cron de limpeza de edições expiradas no SharePoint"
```

---

## Task 5: Alterar schema do banco de dados

**Files:**
- Modify: `packages/db/src/schema/plano-aula.ts:118-171`
- Modify: `packages/db/src/schema/prova.ts:100-155`

- [ ] **Step 1: Adicionar campos SharePoint e remover campos preview em plano-aula**

Em `packages/db/src/schema/plano-aula.ts`, substituir a seção de preview (linhas 138-143) e adicionar campos SharePoint:

Substituir:
```typescript
    // Preview (conversão assíncrona)
    previewKey: varchar("preview_key", { length: 500 }), // Key do preview no storage (PDF)
    previewUrl: varchar("preview_url", { length: 1000 }), // URL pública do preview
    previewMimeType: varchar("preview_mime_type", { length: 100 }), // Tipo MIME do preview
    previewStatus: text("preview_status", { enum: documentoPreviewStatusEnum }), // Status da conversão
    previewError: text("preview_error"), // Mensagem de erro (se houver)
```

Por:
```typescript
    // Edição via SharePoint (campos temporários — preenchidos durante edição, limpos após sincronização)
    sharepointItemId: text("sharepoint_item_id"), // ID do arquivo no SharePoint
    sharepointEditUrl: text("sharepoint_edit_url"), // URL de edição gerada
    editandoDesde: timestamp("editando_desde", { withTimezone: true }), // Quando a edição foi iniciada
```

- [ ] **Step 2: Mesma alteração em prova**

Em `packages/db/src/schema/prova.ts`, substituir a seção de preview (linhas 120-127) e adicionar campos SharePoint:

Substituir:
```typescript
    // Preview (conversão assíncrona)
    previewKey: varchar("preview_key", { length: 500 }), // Key do preview no storage (PDF)
    previewUrl: varchar("preview_url", { length: 1000 }), // URL pública do preview
    previewMimeType: varchar("preview_mime_type", { length: 100 }), // Tipo MIME do preview
    previewStatus: text("preview_status", {
      enum: documentoPreviewStatusEnum,
    }), // Status da conversão
    previewError: text("preview_error"), // Mensagem de erro (se houver)
```

Por:
```typescript
    // Edição via SharePoint (campos temporários — preenchidos durante edição, limpos após sincronização)
    sharepointItemId: text("sharepoint_item_id"), // ID do arquivo no SharePoint
    sharepointEditUrl: text("sharepoint_edit_url"), // URL de edição gerada
    editandoDesde: timestamp("editando_desde", { withTimezone: true }), // Quando a edição foi iniciada
```

- [ ] **Step 3: Remover enum documentoPreviewStatusEnum se não for mais usado**

Verificar se `documentoPreviewStatusEnum` é usado em outro lugar. Se apenas nos campos removidos, remover a declaração do enum nos dois arquivos de schema.

```bash
cd /var/www/essencia && grep -r "documentoPreviewStatusEnum" packages/db/src/
```

Se só aparece nos campos removidos, remover a declaração.

- [ ] **Step 4: Gerar migration**

```bash
cd /var/www/essencia && pnpm db:generate
```

Revisar o SQL gerado — deve conter:
- `ALTER TABLE plano_documento DROP COLUMN preview_key, preview_url, preview_mime_type, preview_status, preview_error`
- `ALTER TABLE plano_documento ADD COLUMN sharepoint_item_id text, sharepoint_edit_url text, editando_desde timestamptz`
- Mesmas operações para `prova_documento`

- [ ] **Step 5: Verificar typecheck**

```bash
cd /var/www/essencia && pnpm turbo typecheck
```

Expected: Erros de compilação em arquivos que referenciam os campos removidos (previewKey, previewUrl, etc.). Esses serão corrigidos nas próximas tasks.

- [ ] **Step 6: Commit**

```bash
git add packages/db/
git commit -m "feat(db): adicionar campos SharePoint e remover campos preview no schema de documentos"
```

---

## Task 6: Atualizar controller e service do plano-aula

**Files:**
- Modify: `services/api/src/modules/plano-aula/plano-aula.controller.ts`
- Modify: `services/api/src/modules/plano-aula/plano-aula.service.ts`
- Modify: `services/api/src/modules/plano-aula/plano-aula.module.ts`

- [ ] **Step 1: Adicionar método getDocumentoByIdDireto no service**

Em `services/api/src/modules/plano-aula/plano-aula.service.ts`, adicionar método para buscar documento sem precisar do planoId (usado pelo webhook):

```typescript
  /**
   * Busca um documento diretamente pelo ID (sem validação de planoId).
   * Usado internamente pelo webhook do SharePoint.
   */
  async getDocumentoByIdDireto(documentoId: string) {
    const [documento] = await this.db
      .select()
      .from(planoDocumento)
      .where(eq(planoDocumento.id, documentoId))
      .limit(1);

    if (!documento) {
      throw new Error(`Documento ${documentoId} não encontrado`);
    }

    return documento;
  }
```

- [ ] **Step 2: Adicionar endpoint editar-word no controller**

Em `services/api/src/modules/plano-aula/plano-aula.controller.ts`, adicionar novo endpoint após o endpoint de upload:

```typescript
  /**
   * GET /plano-aula/:id/documentos/:docId/editar-word
   * Copia arquivo para o SharePoint e retorna URL ms-word: para abrir no Word desktop.
   */
  @Get(":id/documentos/:docId/editar-word")
  @Roles(...PROFESSORA_ACCESS, ...ANALISTA_ACCESS)
  async editarNoWord(
    @Req() req: { user: UserContext },
    @Param("id") planoId: string,
    @Param("docId") docId: string,
  ) {
    if (!this.sharePointService.isConfigurado()) {
      throw new BadRequestException({
        code: "SHAREPOINT_NAO_CONFIGURADO",
        message: "Edição no Word não está disponível — SharePoint não configurado",
      });
    }

    const documento = await this.planoAulaService.getDocumentoById(planoId, docId);

    if (!documento.storageKey) {
      throw new BadRequestException("Documento sem arquivo associado");
    }

    const isWord =
      documento.mimeType?.includes("word") ||
      documento.mimeType?.includes("msword");
    if (!isWord) {
      throw new BadRequestException(
        "Apenas documentos .doc/.docx podem ser editados no Word",
      );
    }

    try {
      // Copiar do MinIO para o SharePoint
      const itemId = await this.sharePointService.uploadParaSharePoint(
        documento.storageKey,
        documento.fileName || "documento.docx",
        docId,
      );

      // Criar link de compartilhamento anônimo (2h)
      const { url, shareId } =
        await this.sharePointService.criarLinkCompartilhamento(itemId, 2);

      // Salvar referência no banco
      await this.planoAulaService.atualizarDocumento(docId, {
        sharepointItemId: itemId,
        sharepointEditUrl: url,
        editandoDesde: new Date(),
      });

      // Construir URL ms-word:
      const msWordUrl = this.sharePointService.construirMsWordUrl(url);

      return {
        success: true,
        data: { url: msWordUrl },
      };
    } catch (error) {
      this.logger.error(
        `Erro ao preparar edição no Word para documento ${docId}: ${error}`,
      );
      throw new InternalServerErrorException({
        code: "SHAREPOINT_ERROR",
        message: "Erro ao preparar edição no Word. Tente novamente.",
      });
    }
  }
```

- [ ] **Step 3: Adicionar endpoint de re-upload (fallback)**

```typescript
  /**
   * POST /plano-aula/:id/documentos/:docId/atualizar
   * Re-upload manual de documento editado (fallback quando ms-word: não funciona).
   */
  @Post(":id/documentos/:docId/atualizar")
  @Roles(...PROFESSORA_ACCESS, ...ANALISTA_ACCESS)
  async atualizarDocumento(
    @Param("id") planoId: string,
    @Param("docId") docId: string,
    @Req() req: FastifyMultipartRequest,
  ) {
    if (!req.isMultipart()) {
      throw new BadRequestException({
        code: "INVALID_REQUEST",
        message: "Request deve ser multipart/form-data",
      });
    }

    const documento = await this.planoAulaService.getDocumentoById(planoId, docId);

    if (!documento.storageKey) {
      throw new BadRequestException("Documento sem arquivo associado");
    }

    const data = await req.file();
    if (!data) {
      throw new BadRequestException({
        code: "NO_FILE",
        message: "Nenhum arquivo enviado",
      });
    }

    // Validar tipo de arquivo — apenas Word
    const allowedMimeTypes = [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedMimeTypes.includes(data.mimetype)) {
      throw new BadRequestException({
        code: "INVALID_FILE_TYPE",
        message: "Tipo de arquivo não permitido. Use DOC ou DOCX",
      });
    }

    const MAX_SIZE = 100 * 1024 * 1024;
    const buffer = await data.toBuffer();
    if (buffer.length > MAX_SIZE) {
      throw new BadRequestException({
        code: "FILE_TOO_LARGE",
        message: "Arquivo muito grande. Tamanho máximo: 100MB",
      });
    }

    try {
      await this.storageService.replaceFile(
        documento.storageKey,
        buffer,
        data.mimetype,
        data.filename || documento.fileName || "documento.docx",
      );

      await this.planoAulaService.atualizarDocumento(docId, {
        fileSize: buffer.length,
        updatedAt: new Date(),
      });

      return {
        success: true,
        data: { message: "Documento atualizado com sucesso" },
      };
    } catch (error) {
      this.logger.error(
        `Erro ao atualizar documento ${docId}: ${error}`,
      );
      throw new InternalServerErrorException({
        code: "UPDATE_FAILED",
        message: "Erro ao atualizar o documento",
      });
    }
  }
```

- [ ] **Step 4: Simplificar endpoint editor-config para modo view apenas**

Substituir o endpoint `getEditorConfig` existente (linhas 375-477). Remover a lógica de modos "edit" e "comentar", callbackUrl, e forçar `mode: "view"`:

```typescript
  /**
   * GET /plano-aula/:id/documentos/:docId/editor-config
   * Retorna configuração do OnlyOffice para visualização (somente leitura)
   */
  @Get(":id/documentos/:docId/editor-config")
  @Roles(...VISUALIZAR_ACCESS)
  async getEditorConfig(
    @Req() req: { user: UserContext },
    @Param("id") planoId: string,
    @Param("docId") docId: string,
  ) {
    const documento = await this.planoAulaService.getDocumentoById(planoId, docId);

    if (!documento.storageKey) {
      throw new BadRequestException("Documento sem arquivo associado");
    }

    const isWord =
      documento.mimeType?.includes("word") ||
      documento.mimeType?.includes("msword");
    if (!isWord) {
      throw new BadRequestException(
        "Apenas documentos .doc/.docx podem ser abertos no visualizador",
      );
    }

    const apiBaseUrl =
      this.configService.get<string>("NEXT_PUBLIC_API_URL") ||
      "https://www.portalcef.com.br/api";
    const fileUrl = `${apiBaseUrl}/plano-aula/${planoId}/documentos/${docId}/download`;

    const onlyofficeUrl =
      this.configService.get<string>("ONLYOFFICE_PUBLIC_URL") ||
      "https://www.portalcef.com.br/onlyoffice";
    const jwtSecret = this.configService.get<string>("ONLYOFFICE_JWT_SECRET");

    const config = {
      document: {
        fileType: documento.fileName?.endsWith(".doc") ? "doc" : "docx",
        key: `${docId}-${documento.createdAt ? new Date(documento.createdAt).getTime() : docId}`,
        title: documento.fileName || "Documento",
        url: fileUrl,
        permissions: {
          edit: false,
          comment: false,
          download: true,
          print: true,
        },
      },
      documentType: "word",
      editorConfig: {
        mode: "view",
        lang: "pt",
        customization: {
          autosave: false,
          forcesave: false,
          plugins: false,
          compactToolbar: true,
        },
        user: {
          id: req.user.userId,
          name: "Usuário",
        },
      },
    };

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

- [ ] **Step 5: Remover endpoint onlyoffice-callback**

Remover o método `onlyofficeCallback` (linhas 519-610+) do controller.

> **IMPORTANTE:** Manter o endpoint `GET /download` (linhas 485-513) — ele continua necessário para o OnlyOffice viewer renderizar o .docx em modo read-only.

- [ ] **Step 6: Remover lógica de conversão do endpoint upload**

No endpoint `uploadDocumento`, remover:
- A constante `MIME_TYPES_QUE_PRECISAM_CONVERTER` (linha 81-87)
- A lógica `precisaConverter` e o bloco `if (precisaConverter)` que chama `documentosConversaoQueue.enfileirar()` (linhas 321-354)
- A propriedade `previewStatus: "PENDENTE"` do objeto passado ao `adicionarDocumentoUpload`
- O import e injeção do `DocumentosConversaoQueueService`

- [ ] **Step 7: Adicionar injeção do SharePointService no controller**

No constructor do `PlanoAulaController`, adicionar:

```typescript
private readonly sharePointService: SharePointService,
```

E o import:
```typescript
import { SharePointService } from "../../common/sharepoint/sharepoint.service";
```

- [ ] **Step 8: Atualizar PlanoAulaModule**

Substituir conteúdo de `services/api/src/modules/plano-aula/plano-aula.module.ts`:

```typescript
import { Module } from "@nestjs/common";

import { SharePointModule } from "../../common/sharepoint/sharepoint.module";
import { StorageModule } from "../../common/storage/storage.module";
import { AuthModule } from "../auth/auth.module";
import { PlanoAulaController } from "./plano-aula.controller";
import { PlanoAulaHistoricoService } from "./plano-aula-historico.service";
import { PlanoAulaService } from "./plano-aula.service";

@Module({
  imports: [AuthModule, StorageModule.forRoot(), SharePointModule],
  controllers: [PlanoAulaController],
  providers: [PlanoAulaService, PlanoAulaHistoricoService],
  exports: [PlanoAulaService],
})
export class PlanoAulaModule {}
```

- [ ] **Step 9: Verificar typecheck**

```bash
cd /var/www/essencia && pnpm turbo typecheck --filter=api
```

Corrigir quaisquer erros de tipo restantes.

- [ ] **Step 10: Commit**

```bash
git add services/api/src/modules/plano-aula/
git commit -m "feat(plano-aula): adicionar edição via Word desktop e remover edição/conversão OnlyOffice"
```

---

## Task 7: Atualizar controller e service da prova

**Files:**
- Modify: `services/api/src/modules/prova/prova.controller.ts`
- Modify: `services/api/src/modules/prova/prova.service.ts`
- Modify: `services/api/src/modules/prova/prova.module.ts`

As alterações são análogas à Task 6, aplicadas ao módulo prova.

- [ ] **Step 1: Adicionar método getDocumentoByIdDireto no ProvaService**

Em `services/api/src/modules/prova/prova.service.ts`, adicionar:

```typescript
  /**
   * Busca um documento diretamente pelo ID (sem validação de provaId).
   * Usado internamente pelo webhook do SharePoint.
   */
  async getDocumentoByIdDireto(documentoId: string) {
    const [documento] = await this.db
      .select()
      .from(provaDocumento)
      .where(eq(provaDocumento.id, documentoId))
      .limit(1);

    if (!documento) {
      throw new Error(`Documento ${documentoId} não encontrado`);
    }

    return documento;
  }
```

- [ ] **Step 2: Adicionar endpoint editar-word no ProvaController**

Mesmo código da Task 6 Step 2, mas com rotas `/prova/:id/documentos/:docId/editar-word` e usando `this.provaService`.

- [ ] **Step 3: Adicionar endpoint de re-upload (fallback) no ProvaController**

Mesmo código da Task 6 Step 3, mas com rota `/prova/:id/documentos/:docId/atualizar` e usando `this.provaService`.

- [ ] **Step 4: Simplificar editor-config para modo view no ProvaController**

Mesmo código da Task 6 Step 4, mas com rota `/prova/:id/documentos/:docId/editor-config`.

- [ ] **Step 5: Remover endpoint onlyoffice-callback do ProvaController**

Remover o método `onlyofficeCallback` do `ProvaController`.

- [ ] **Step 6: Remover lógica de conversão do endpoint upload da prova**

Mesma limpeza da Task 6 Step 6.

- [ ] **Step 7: Adicionar injeção do SharePointService no ProvaController**

- [ ] **Step 8: Atualizar ProvaModule**

```typescript
import { Module } from "@nestjs/common";

import { SharePointModule } from "../../common/sharepoint/sharepoint.module";
import { StorageModule } from "../../common/storage/storage.module";
import { AuthModule } from "../auth/auth.module";
import { ProvaController } from "./prova.controller";
import { ProvaHistoricoService } from "./prova-historico.service";
import { ProvaService } from "./prova.service";

@Module({
  imports: [AuthModule, StorageModule.forRoot(), SharePointModule],
  controllers: [ProvaController],
  providers: [ProvaService, ProvaHistoricoService],
  exports: [ProvaService],
})
export class ProvaModule {}
```

- [ ] **Step 9: Verificar typecheck**

```bash
cd /var/www/essencia && pnpm turbo typecheck --filter=api
```

- [ ] **Step 10: Commit**

```bash
git add services/api/src/modules/prova/
git commit -m "feat(prova): adicionar edição via Word desktop e remover edição/conversão OnlyOffice"
```

---

## Task 8: Atualizar app.module.ts e remover fila de conversão

**Files:**
- Modify: `services/api/src/app.module.ts`
- Delete: `services/api/src/common/queues/documentos-conversao.queue.ts`
- Delete: `services/api/src/common/queues/documentos-conversao.module.ts`

- [ ] **Step 1: Atualizar app.module.ts**

Em `services/api/src/app.module.ts`:
- Remover import do `DocumentosConversaoModule` (linha 10)
- Remover `DocumentosConversaoModule` do array imports (linha 64)
- Adicionar import do `SharePointModule` e `ScheduleModule`:

```typescript
import { ScheduleModule } from "@nestjs/schedule";
import { SharePointModule } from "./common/sharepoint/sharepoint.module";
```

Adicionar ao array imports:
```typescript
    ScheduleModule.forRoot(),
    SharePointModule,
```

- [ ] **Step 2: Remover arquivos da fila de conversão**

```bash
rm services/api/src/common/queues/documentos-conversao.queue.ts
rm services/api/src/common/queues/documentos-conversao.module.ts
```

Se o diretório `queues/` ficar vazio:
```bash
rmdir services/api/src/common/queues/ 2>/dev/null || true
```

- [ ] **Step 3: Verificar typecheck**

```bash
cd /var/www/essencia && pnpm turbo typecheck --filter=api
```

Expected: Sem erros.

- [ ] **Step 4: Commit**

```bash
git add -A services/api/src/app.module.ts services/api/src/common/queues/
git commit -m "refactor(api): remover fila de conversão e integrar SharePointModule"
```

---

## Task 9: Atualizar frontend — tipos e DocumentoList

**Files:**
- Modify: `apps/planejamento/features/plano-aula/types.ts`
- Modify: `apps/planejamento/features/plano-aula/components/documento-list.tsx`

- [ ] **Step 1: Atualizar tipos**

Em `apps/planejamento/features/plano-aula/types.ts`:

Remover:
```typescript
export type DocumentoPreviewStatus = "PENDENTE" | "PRONTO" | "ERRO";
```

No interface `PlanoDocumento`, substituir campos preview por campos SharePoint:

Remover:
```typescript
  // Campos de preview (conversão assíncrona)
  previewKey?: string;
  previewUrl?: string;
  previewMimeType?: string;
  previewStatus?: DocumentoPreviewStatus;
  previewError?: string;
```

Adicionar:
```typescript
  // Campos de edição via SharePoint (temporários)
  sharepointItemId?: string;
  sharepointEditUrl?: string;
  editandoDesde?: string;
```

- [ ] **Step 2: Atualizar DocumentoList — remover referências a preview e adicionar "Editar no Word"**

Em `apps/planejamento/features/plano-aula/components/documento-list.tsx`:

**2a.** Remover a função `getDocumentPdfUrl` (linhas 124-136) — não há mais preview PDF.

**2b.** Remover referências a `previewStatus` e `previewUrl` no JSX:
- Remover o badge "Convertendo..." (linhas 395-403)
- Remover a condição `documento.previewStatus === "PENDENTE"` nos status badges (linha 365)
- Remover a desabilitação do botão aprovar por `previewStatus === "PENDENTE"` (linha 479)

**2c.** Substituir o botão de editar (linhas 438-452) por lógica de "Editar no Word":

```typescript
{podeEditar && (
  <Button
    variant="ghost"
    size="icon"
    className="h-8 w-8 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
    onClick={async () => {
      try {
        const res = await fetch(
          `/api/plano-aula/${documento.planoId}/documentos/${documento.id}/editar-word`,
          { credentials: "include" },
        );
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.message || "Erro ao abrir no Word");
          return;
        }
        const json = await res.json();
        window.location.href = json.data.url;
        toast.info(
          "O documento foi aberto no Word. Edite e salve normalmente (Ctrl+S). As alterações serão sincronizadas automaticamente.",
        );
      } catch {
        toast.error("Erro ao preparar edição no Word");
      }
    }}
    title="Editar no Word"
    aria-label="Editar no Word"
  >
    <Pencil className="h-4 w-4" />
  </Button>
)}
```

**2d.** Remover o botão de comentar (linhas 454-468) — não há mais modo "comentar" no OnlyOffice.

**2e.** Remover o import e uso do `DocumentoEditorModal` para modos "edit" e "comentar". Manter apenas para modo "view":

```typescript
{isWordDocument(documento) && (
  <DocumentoEditorModal
    planoId={documento.planoId}
    documentoId={documento.id}
    mode="view"
    open={editorDocId === documento.id}
    onOpenChange={(open) =>
      setEditorDocId(open ? documento.id : null)
    }
  />
)}
```

**2f.** Remover os states `editorMode` e `podeComentar` que não são mais usados.

**2g.** Adicionar import do `toast`:

```typescript
import { toast } from "@essencia/ui/toaster";
```

**2h.** Atualizar lógica de impressão — sem preview PDF, a impressão de documentos Word não é mais possível via navegador. Remover a funcionalidade de impressão para Word docs (manter para PDFs nativos se houver):

A função `handleImprimir` e o `podeImprimir` devem verificar se o documento é PDF nativo:

```typescript
const podeImprimir =
  documento.mimeType === "application/pdf" &&
  !!documento.approvedAt &&
  !!documento.approvedBy &&
  !!onImprimir;
```

- [ ] **Step 3: Simplificar DocumentoEditorModal**

Em `apps/planejamento/features/plano-aula/components/documento-editor.tsx`:

Remover a prop `mode` do interface (forçar sempre "view"):

```typescript
interface DocumentoEditorProps {
  planoId: string;
  documentoId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

No `useEffect`, fixar mode como "view":

```typescript
const res = await fetch(
  `/api/plano-aula/${planoId}/documentos/${documentoId}/editor-config?mode=view`,
  { credentials: "include" },
);
```

Remover `onDocumentStateChange` (não há mais edição no OnlyOffice):

```typescript
<DocumentEditor
  id={`editor-${documentoId}`}
  documentServerUrl={editorConfig.documentServerUrl}
  config={editorConfig.config}
/>
```

Remover a referência `hadChangesRef` e o callback `onDocumentStateChange`.

- [ ] **Step 4: Verificar typecheck do frontend**

```bash
cd /var/www/essencia && pnpm turbo typecheck --filter=planejamento
```

- [ ] **Step 5: Commit**

```bash
git add apps/planejamento/features/plano-aula/
git commit -m "feat(planejamento): substituir edição OnlyOffice por Word desktop no frontend"
```

---

## Task 10: Atualizar docker-compose e remover worker

**Files:**
- Modify: `docker-compose.prod.yml`
- Delete: `services/worker/` (diretório inteiro)

- [ ] **Step 1: Remover services worker e carbone do docker-compose.prod.yml**

Remover os blocos de serviço `carbone` (linhas ~334-340) e `worker` (linhas ~374-403).

- [ ] **Step 2: Adicionar variáveis Azure no service api**

No bloco `environment` do serviço `api`, adicionar:

```yaml
      AZURE_TENANT_ID: ${AZURE_TENANT_ID}
      AZURE_CLIENT_ID: ${AZURE_CLIENT_ID}
      AZURE_CLIENT_SECRET: ${AZURE_CLIENT_SECRET}
      SHAREPOINT_SITE_ID: ${SHAREPOINT_SITE_ID}
      SHAREPOINT_DRIVE_ID: ${SHAREPOINT_DRIVE_ID}
```

- [ ] **Step 3: Remover dependências worker e carbone do serviço api**

No bloco `depends_on` do serviço `api`, remover referências a `carbone` e `worker` se existirem.

- [ ] **Step 4: Remover diretório do worker**

```bash
rm -rf services/worker/
```

- [ ] **Step 5: Verificar se o build funciona**

```bash
cd /var/www/essencia && pnpm turbo typecheck && pnpm turbo lint
```

- [ ] **Step 6: Commit**

```bash
git add -A docker-compose.prod.yml services/worker/
git commit -m "refactor: remover worker de conversão e carbone, adicionar variáveis Azure"
```

---

## Task 11: Verificação final e limpeza

**Files:**
- Various (limpeza de referências órfãs)

- [ ] **Step 1: Buscar referências órfãs aos campos preview**

```bash
cd /var/www/essencia && grep -r "previewKey\|previewUrl\|previewMimeType\|previewStatus\|previewError" --include="*.ts" --include="*.tsx" -l
```

Para cada arquivo encontrado, remover as referências aos campos removidos.

- [ ] **Step 2: Buscar referências órfãs à fila de conversão**

```bash
cd /var/www/essencia && grep -r "documentosConversaoQueue\|DocumentosConversaoQueue\|documentos-conversao\|ConversaoDocumentoJob\|MIME_TYPES_QUE_PRECISAM_CONVERTER" --include="*.ts" --include="*.tsx" -l
```

Para cada arquivo encontrado, remover as referências.

- [ ] **Step 3: Buscar referências ao onlyoffice-callback**

```bash
cd /var/www/essencia && grep -r "onlyoffice-callback\|onlyofficeCallback" --include="*.ts" --include="*.tsx" -l
```

Limpar referências restantes.

- [ ] **Step 4: Verificar build completo**

```bash
cd /var/www/essencia && pnpm turbo lint && pnpm turbo typecheck
```

Expected: Sem erros.

- [ ] **Step 5: Rodar testes existentes**

```bash
cd /var/www/essencia && pnpm turbo test
```

Corrigir quaisquer testes que falhem por causa das mudanças.

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "refactor: limpeza de referências órfãs após remoção do worker e edição OnlyOffice"
```

---

## Task 12: Atualizar variáveis de ambiente e documentação

**Files:**
- Modify: `.env.example`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Adicionar variáveis Azure no .env.example**

```env
# Microsoft Graph API (SharePoint - edição no Word desktop)
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
SHAREPOINT_SITE_ID=
SHAREPOINT_DRIVE_ID=
```

- [ ] **Step 2: Atualizar CLAUDE.md**

Remover referências ao worker, Carbone e LibreOffice. Adicionar nota sobre a edição via Word desktop na seção de arquitetura.

- [ ] **Step 3: Commit**

```bash
git add .env.example CLAUDE.md
git commit -m "docs: atualizar variáveis de ambiente e documentação para edição via Word desktop"
```

---

## Pré-requisitos externos (não são tasks de código)

Antes de testar em produção, a escola precisa:

1. **Contratar Microsoft 365 Business Basic** (1 licença)
2. **Criar App Registration no Azure Entra ID:**
   - Portal Azure → Azure Active Directory → App registrations → New registration
   - Tipo: Accounts in this organizational directory only
   - Permissões de aplicação: `Files.ReadWrite.All`, `Sites.ReadWrite.All`
   - Criar client secret
   - Anotar: Tenant ID, Client ID, Client Secret
3. **Identificar Site ID e Drive ID do SharePoint:**
   ```bash
   # Listar sites
   curl -H "Authorization: Bearer {token}" https://graph.microsoft.com/v1.0/sites?search=*
   # Listar drives do site
   curl -H "Authorization: Bearer {token}" https://graph.microsoft.com/v1.0/sites/{siteId}/drives
   ```
4. **Habilitar links de compartilhamento anônimo:**
   - SharePoint Admin Center → Policies → Sharing → External sharing → "Anyone"
5. **Configurar variáveis de ambiente** no servidor de produção
