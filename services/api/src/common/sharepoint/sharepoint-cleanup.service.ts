import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  getDb,
  and,
  eq,
  isNotNull,
  lte,
  planoDocumento,
  provaDocumento,
} from "@essencia/db";

import { StorageService } from "../storage/storage.service";
import { SharePointService } from "./sharepoint.service";

/**
 * SharePointCleanupService
 *
 * Cron job que roda a cada 30 minutos para limpar edições
 * abandonadas no SharePoint.
 *
 * Cenário: usuária abre documento para edição no Word desktop,
 * mas nunca salva/fecha. Após 2 horas, o sistema sincroniza
 * eventuais alterações de volta ao MinIO e limpa os campos
 * temporários do SharePoint.
 */
@Injectable()
export class SharePointCleanupService implements OnModuleInit {
  private readonly logger = new Logger(SharePointCleanupService.name);
  private subscriptionId: string | null = null;

  constructor(
    private readonly sharePointService: SharePointService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.sharePointService.isConfigurado()) return;

    try {
      const apiBaseUrl =
        this.configService.get<string>("API_BASE_URL") ||
        "https://www.portalcef.com.br/api";
      const callbackUrl = `${apiBaseUrl}/webhooks/graph`;

      this.subscriptionId = await this.sharePointService.criarSubscription(callbackUrl);
      this.logger.log(`Webhook subscription criada: ${this.subscriptionId}`);
    } catch (error) {
      this.logger.warn(
        `Falha ao criar subscription do Graph (webhook indisponível — sincronização via cron): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async renovarSubscription(): Promise<void> {
    if (!this.subscriptionId || !this.sharePointService.isConfigurado()) return;

    try {
      await this.sharePointService.renovarSubscription(this.subscriptionId);
      this.logger.log(`Subscription ${this.subscriptionId} renovada`);
    } catch (error) {
      this.logger.warn(
        `Falha ao renovar subscription: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Tentar recriar
      try {
        const apiBaseUrl =
          this.configService.get<string>("API_BASE_URL") ||
          "https://www.portalcef.com.br/api";
        this.subscriptionId = await this.sharePointService.criarSubscription(
          `${apiBaseUrl}/webhooks/graph`,
        );
        this.logger.log(`Subscription recriada: ${this.subscriptionId}`);
      } catch (recriarError) {
        this.logger.error(
          `Falha ao recriar subscription: ${recriarError instanceof Error ? recriarError.message : String(recriarError)}`,
        );
        this.subscriptionId = null;
      }
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async limparEdicoesExpiradas(): Promise<void> {
    if (!this.sharePointService.isConfigurado()) {
      return;
    }

    const duasHorasAtras = new Date();
    duasHorasAtras.setHours(duasHorasAtras.getHours() - 2);

    await this.limparPlanoDocumentos(duasHorasAtras);
    await this.limparProvaDocumentos(duasHorasAtras);
  }

  private async limparPlanoDocumentos(limite: Date): Promise<void> {
    const db = getDb();

    const documentos = await db
      .select()
      .from(planoDocumento)
      .where(
        and(
          isNotNull(planoDocumento.editandoDesde),
          lte(planoDocumento.editandoDesde, limite),
        ),
      );

    if (documentos.length === 0) return;

    this.logger.log(
      `Encontrados ${documentos.length} documentos com edição expirada em plano_documento`,
    );

    for (const doc of documentos) {
      await this.sincronizarELimpar(doc, "plano");
    }
  }

  private async limparProvaDocumentos(limite: Date): Promise<void> {
    const db = getDb();

    const documentos = await db
      .select()
      .from(provaDocumento)
      .where(
        and(
          isNotNull(provaDocumento.editandoDesde),
          lte(provaDocumento.editandoDesde, limite),
        ),
      );

    if (documentos.length === 0) return;

    this.logger.log(
      `Encontrados ${documentos.length} documentos com edição expirada em prova_documento`,
    );

    for (const doc of documentos) {
      await this.sincronizarELimpar(doc, "prova");
    }
  }

  private async sincronizarELimpar(
    documento: {
      id: string;
      sharepointItemId: string | null;
      storageKey: string | null;
      editandoDesde: Date | null;
      mimeType: string | null;
      fileName: string | null;
    },
    tabela: "plano" | "prova",
  ): Promise<void> {
    const db = getDb();
    const tabelaRef = tabela === "plano" ? planoDocumento : provaDocumento;

    if (!documento.sharepointItemId || !documento.storageKey) {
      // Limpar campos inconsistentes
      await db
        .update(tabelaRef)
        .set({
          sharepointItemId: null,
          sharepointEditUrl: null,
          editandoDesde: null,
        })
        .where(eq(tabelaRef.id, documento.id));
      return;
    }

    try {
      // Verificar se foi modificado no SharePoint
      const foiModificado = await this.sharePointService.foiModificadoApos(
        documento.sharepointItemId,
        documento.editandoDesde!,
      );

      if (foiModificado) {
        // Baixar e sincronizar com MinIO
        const buffer = await this.sharePointService.baixarArquivo(
          documento.sharepointItemId,
        );

        await this.storageService.replaceFile(
          documento.storageKey,
          buffer,
          documento.mimeType ||
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          documento.fileName || "documento.docx",
        );

        this.logger.log(
          `Documento ${documento.id} sincronizado do SharePoint (edição expirada)`,
        );
      }

      // Remover do SharePoint (link de compartilhamento é invalidado ao remover o arquivo)
      await this.sharePointService.removerArquivo(documento.sharepointItemId);
    } catch (error) {
      this.logger.error(
        `Erro ao limpar documento ${documento.id} do SharePoint: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Limpar campos do banco independente de sucesso do SharePoint
    await db
      .update(tabelaRef)
      .set({
        sharepointItemId: null,
        sharepointEditUrl: null,
        editandoDesde: null,
        updatedAt: new Date(),
      })
      .where(eq(tabelaRef.id, documento.id));
  }
}
