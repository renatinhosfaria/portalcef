import { Injectable, Logger } from "@nestjs/common";
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
 * mas nunca salva/fecha. Após a janela configurada de edição, o sistema sincroniza
 * eventuais alterações de volta ao MinIO e limpa os campos
 * temporários do SharePoint.
 */
@Injectable()
export class SharePointCleanupService {
  private readonly logger = new Logger(SharePointCleanupService.name);

  constructor(
    private readonly sharePointService: SharePointService,
    private readonly storageService: StorageService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async limparEdicoesExpiradas(): Promise<void> {
    if (!this.sharePointService.isConfigurado()) {
      return;
    }

    const limiteExpiracao = this.sharePointService.calcularLimiteEdicao();

    await this.limparPlanoDocumentos(limiteExpiracao);
    await this.limparProvaDocumentos(limiteExpiracao);
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
      const removido = await this.sharePointService.removerArquivo(documento.sharepointItemId);

      if (!removido) {
        // Arquivo ainda bloqueado — manter campos para tentar novamente no próximo ciclo
        this.logger.warn(
          `Documento ${documento.id} não removido do SharePoint (arquivo bloqueado). Será tentado novamente no próximo ciclo.`,
        );
        return;
      }
    } catch (error) {
      this.logger.error(
        `Erro ao limpar documento ${documento.id} do SharePoint: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }

    // Limpar campos do banco somente se a remoção do SharePoint foi bem-sucedida
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
