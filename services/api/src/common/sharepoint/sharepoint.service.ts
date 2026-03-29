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

  async uploadParaSharePoint(
    storageKey: string,
    fileName: string,
    documentoId: string,
  ): Promise<string> {
    const client = this.getClient();

    const s3Response = await this.storageService.getObject(storageKey);
    const chunks: Buffer[] = [];
    const stream = s3Response.Body as NodeJS.ReadableStream;
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk as Buffer));
    }
    const buffer = Buffer.concat(chunks);

    const uploadPath = `/drives/${this.driveId}/root:/edicao-temporaria/${documentoId}/${fileName}:/content`;

    const response = await client
      .api(`/sites/${this.siteId}${uploadPath}`)
      .putStream(buffer);

    this.logger.log(
      `Arquivo ${fileName} copiado para SharePoint (documentoId: ${documentoId})`,
    );

    return response.id;
  }

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

  async criarSubscription(callbackUrl: string): Promise<string> {
    const client = this.getClient();

    const expiracao = new Date();
    expiracao.setDate(expiracao.getDate() + 29);

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

  construirMsWordUrl(sharePointUrl: string): string {
    return `ms-word:ofe|u|${sharePointUrl}`;
  }
}
