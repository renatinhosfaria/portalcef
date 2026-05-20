import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import "isomorphic-fetch";
import axios from "axios";

import { StorageService } from "../storage/storage.service";

@Injectable()
export class SharePointService {
  private static readonly HORAS_EDICAO_PADRAO = 8;

  private readonly logger = new Logger(SharePointService.name);
  private client: Client | null = null;
  private credential: ClientSecretCredential | null = null;

  private readonly tenantId: string | undefined;
  private readonly clientId: string | undefined;
  private readonly clientSecret: string | undefined;
  private readonly siteId: string | undefined;
  private readonly driveId: string | undefined;
  private readonly horasEdicao: number;
  private driveWebUrl: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
  ) {
    this.tenantId = this.configService.get<string>("AZURE_TENANT_ID");
    this.clientId = this.configService.get<string>("AZURE_CLIENT_ID");
    this.clientSecret = this.configService.get<string>("AZURE_CLIENT_SECRET");
    this.siteId = this.configService.get<string>("SHAREPOINT_SITE_ID");
    this.driveId = this.configService.get<string>("SHAREPOINT_DRIVE_ID");
    this.horasEdicao = this.carregarHorasEdicao();

    if (this.isConfigurado()) {
      this.inicializarClient();
    } else {
      this.logger.warn(
        "SharePoint não configurado — variáveis AZURE_* ou SHAREPOINT_* ausentes",
      );
    }
  }

  private carregarHorasEdicao(): number {
    const valor = this.configService.get<string>("SHAREPOINT_EDIT_TTL_HOURS");
    if (!valor) return SharePointService.HORAS_EDICAO_PADRAO;

    const horas = Number(valor);
    if (!Number.isFinite(horas) || horas <= 0) {
      this.logger.warn(
        `SHAREPOINT_EDIT_TTL_HOURS inválido (${valor}); usando ${SharePointService.HORAS_EDICAO_PADRAO}h`,
      );
      return SharePointService.HORAS_EDICAO_PADRAO;
    }

    return horas;
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
    this.credential = new ClientSecretCredential(
      this.tenantId!,
      this.clientId!,
      this.clientSecret!,
    );

    const authProvider = new TokenCredentialAuthenticationProvider(this.credential, {
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

  obterHorasEdicao(): number {
    return this.horasEdicao;
  }

  calcularLimiteEdicao(agora = new Date()): Date {
    return new Date(agora.getTime() - this.horasEdicao * 60 * 60 * 1000);
  }

  async uploadParaSharePoint(
    storageKey: string,
    fileName: string,
    documentoId: string,
  ): Promise<string> {
    const s3Response = await this.storageService.getObject(storageKey);
    const chunks: Buffer[] = [];
    const s3Stream = s3Response.Body as NodeJS.ReadableStream;

    for await (const chunk of s3Stream) {
      chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk as any));
    }
    const buffer = Buffer.concat(chunks);

    this.logger.log(
      `Buffer preparado: ${buffer.length} bytes (storageKey: ${storageKey})`,
    );

    if (buffer.length === 0) {
      throw new Error(`Arquivo ${storageKey} vazio ao ler do storage`);
    }

    const uploadPath = `/sites/${this.siteId}/drives/${this.driveId}/root:/edicao-temporaria/${documentoId}/${fileName}:/content`;

    this.logger.log(
      `Iniciando upload para SharePoint via REST: ${uploadPath}`,
    );

    try {
      // Usar axios para upload direto via REST API
      const response = await axios.put(
        `https://graph.microsoft.com/v1.0${uploadPath}`,
        buffer,
        {
          headers: {
            "Authorization": await this.getAuthorizationHeader(),
            "Content-Type": "application/octet-stream",
          },
        },
      );

      this.logger.log(
        `Arquivo ${fileName} copiado para SharePoint (${buffer.length} bytes → itemId: ${response.data.id})`,
      );

      return response.data.id;
    } catch (error) {
      this.logger.error(
        `Erro ao fazer upload para SharePoint: ${error instanceof Error ? error.message : error}`,
      );
      throw error;
    }
  }

  private async getAuthorizationHeader(): Promise<string> {
    if (!this.credential) {
      throw new Error("SharePoint não configurado");
    }

    const token = await this.credential.getToken("https://graph.microsoft.com/.default");
    return `Bearer ${token.token}`;
  }

  private async getDriveWebUrl(): Promise<string> {
    if (this.driveWebUrl) return this.driveWebUrl;

    const client = this.getClient();
    const drive = await client
      .api(`/sites/${this.siteId}/drives/${this.driveId}`)
      .select("webUrl")
      .get();

    this.driveWebUrl = drive.webUrl;
    this.logger.log(`Drive webUrl obtido: ${drive.webUrl}`);
    return drive.webUrl;
  }

  async criarLinkCompartilhamento(
    itemId: string,
    documentoId: string,
    fileName: string,
    expiracaoHoras = this.horasEdicao,
  ): Promise<{ url: string; shareId: string; directUrl: string }> {
    const client = this.getClient();

    const expiracao = new Date();
    expiracao.setHours(expiracao.getHours() + expiracaoHoras);

    const expiracaoIso = expiracao.toISOString();

    const response = await client
      .api(
        `/sites/${this.siteId}/drives/${this.driveId}/items/${itemId}/createLink`,
      )
      .post({
        type: "edit",
        scope: "anonymous",
        expirationDateTime: expiracaoIso,
      });

    // Construir URL direta do arquivo no SharePoint (para ms-word protocol)
    const driveUrl = await this.getDriveWebUrl();
    const encodedFileName = encodeURIComponent(fileName).replace(/%20/g, " ");
    const directUrl = `${driveUrl}/edicao-temporaria/${documentoId}/${encodedFileName}`;

    this.logger.log(`Link compartilhamento: ${response.link.webUrl}`);
    this.logger.log(`URL direta do arquivo: ${directUrl}`);

    return {
      url: response.link.webUrl,
      shareId: response.id,
      directUrl,
    };
  }

  async criarLinkVisualizacao(
    itemId: string,
  ): Promise<{ embedUrl: string }> {
    const client = this.getClient();

    // Endpoint preview retorna URL hospedada em *.officeapps.live.com,
    // embeddable em qualquer domínio (diferente do webUrl do SharePoint,
    // cujo frame-ancestors restringe a domínios Microsoft).
    const response = await client
      .api(
        `/sites/${this.siteId}/drives/${this.driveId}/items/${itemId}/preview`,
      )
      .post({});

    this.logger.log(`Preview URL: ${response.getUrl}`);

    return {
      embedUrl: response.getUrl,
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
      chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk as any));
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      throw new Error(`Arquivo ${itemId} vazio ao baixar do SharePoint`);
    }

    return buffer;
  }

  async converterParaPdf(itemId: string): Promise<Buffer> {
    // Graph responde com 302 para uma URL temporária (~1h) do PDF gerado.
    // O SDK segue redirects transparentemente via getStream().
    const url = `https://graph.microsoft.com/v1.0/sites/${this.siteId}/drives/${this.driveId}/items/${itemId}/content?format=pdf`;

    const response = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
      headers: {
        Authorization: await this.getAuthorizationHeader(),
      },
      maxRedirects: 5,
    });

    const buffer = Buffer.from(response.data);

    if (buffer.length === 0) {
      throw new Error(
        `Convers\u00e3o DOCX\u2192PDF retornou buffer vazio para item ${itemId}`,
      );
    }

    this.logger.log(
      `PDF gerado via Graph para item ${itemId}: ${buffer.length} bytes`,
    );

    return buffer;
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

  isItemNaoEncontrado(error: unknown): boolean {
    const erro = error as {
      code?: unknown;
      status?: unknown;
      statusCode?: unknown;
      message?: unknown;
      body?: unknown;
      error?: { code?: unknown; message?: unknown };
      response?: {
        status?: unknown;
        data?: { error?: { code?: unknown; message?: unknown } };
      };
    };

    const codigos = [
      erro.code,
      erro.error?.code,
      erro.response?.data?.error?.code,
    ]
      .filter((codigo): codigo is string => typeof codigo === "string")
      .map((codigo) => codigo.toLowerCase());

    if (codigos.includes("itemnotfound")) {
      return true;
    }

    const status = Number(erro.statusCode ?? erro.status ?? erro.response?.status);
    const mensagens = [
      erro.message,
      erro.body,
      erro.error?.message,
      erro.response?.data?.error?.message,
    ]
      .filter((mensagem): mensagem is string => typeof mensagem === "string")
      .join(" ")
      .toLowerCase();

    return (
      status === 404 &&
      (mensagens.includes("itemnotfound") ||
        mensagens.includes("resource could not be found") ||
        mensagens.includes("not found"))
    );
  }

  async removerArquivo(itemId: string, tentativas = 3): Promise<boolean> {
    const client = this.getClient();

    for (let i = 0; i < tentativas; i++) {
      try {
        await client
          .api(
            `/sites/${this.siteId}/drives/${this.driveId}/items/${itemId}`,
          )
          .delete();

        this.logger.log(`Arquivo ${itemId} removido do SharePoint`);
        return true;
      } catch (error) {
        const mensagem = error instanceof Error ? error.message : String(error);
        const naoEncontrado = this.isItemNaoEncontrado(error);
        const isLocked = mensagem.includes("locked");

        if (naoEncontrado) {
          this.logger.warn(
            `Arquivo ${itemId} não existe mais no SharePoint; referência local será limpa`,
          );
          return true;
        }

        if (isLocked && i < tentativas - 1) {
          const delay = Math.pow(2, i) * 5000; // 5s, 10s, 20s
          this.logger.warn(
            `Arquivo ${itemId} está bloqueado no SharePoint, tentativa ${i + 1}/${tentativas}. Aguardando ${delay / 1000}s...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        this.logger.warn(
          `Falha ao remover arquivo ${itemId} do SharePoint (tentativa ${i + 1}/${tentativas}): ${mensagem}`,
        );
        return false;
      }
    }

    return false;
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

  construirMsWordUrl(sharePointUrl: string): string {
    return `ms-word:ofe|u|${sharePointUrl}`;
  }
}
