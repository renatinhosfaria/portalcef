import {
  Body,
  Controller,
  HttpCode,
  Logger,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { FastifyReply } from "fastify";
import {
  getDb,
  eq,
  planoDocumento,
  provaDocumento,
} from "@essencia/db";

import { Public } from "../decorators/public.decorator";
import { StorageService } from "../storage/storage.service";
import { SharePointService } from "./sharepoint.service";

// ============================================
// Types
// ============================================

interface GraphNotification {
  resource: string;
  changeType: string;
  clientState?: string;
  subscriptionId?: string;
}

interface GraphNotificationPayload {
  value: GraphNotification[];
}

// ============================================
// Controller
// ============================================

/**
 * SharePointWebhookController
 *
 * Recebe notificações do Microsoft Graph quando arquivos são
 * modificados no SharePoint (edição via Word desktop).
 *
 * Fluxo:
 * 1. Microsoft envia validação inicial (validationToken)
 * 2. Quando arquivo é salvo no SharePoint, Graph notifica este endpoint
 * 3. Controller baixa o arquivo atualizado e sincroniza com o MinIO
 * 4. Limpa campos temporários do SharePoint no banco
 */
@Controller("webhooks")
export class SharePointWebhookController {
  private readonly logger = new Logger(SharePointWebhookController.name);

  constructor(
    private readonly sharePointService: SharePointService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * POST /webhooks/graph
   *
   * Endpoint público (server-to-server do Microsoft Graph).
   * Dois cenários:
   * - Validação: retorna validationToken como texto puro
   * - Notificação: processa alterações de arquivos
   */
  @Post("graph")
  @Public()
  @HttpCode(200)
  async handleGraphNotification(
    @Query("validationToken") validationToken: string | undefined,
    @Res() reply: FastifyReply,
    @Body() body: GraphNotificationPayload,
  ) {
    // Cenário 1: Validação da subscription
    if (validationToken) {
      this.logger.log("Validação de subscription recebida");
      return reply
        .header("Content-Type", "text/plain")
        .send(validationToken);
    }

    // Cenário 2: Notificações de alteração
    if (!body?.value?.length) {
      return reply.send({ status: "ok" });
    }

    // Processar notificações em background (responder rápido ao Graph)
    // O Graph espera resposta em poucos segundos
    setImmediate(() => {
      this.processarNotificacoes(body.value).catch((error) => {
        this.logger.error(
          `Erro ao processar notificações do Graph: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    });

    return reply.send({ status: "ok" });
  }

  // ============================================
  // Métodos Privados
  // ============================================

  private async processarNotificacoes(
    notificacoes: GraphNotification[],
  ): Promise<void> {
    for (const notificacao of notificacoes) {
      // Validar clientState
      if (notificacao.clientState !== "essencia-portal-webhook") {
        this.logger.warn(
          `Notificação com clientState inválido: ${notificacao.clientState}`,
        );
        continue;
      }

      // Extrair documentoId do resource path
      // Padrão: .../edicao-temporaria/{documentoId}/...
      const match = notificacao.resource?.match(
        /edicao-temporaria\/([0-9a-f-]+)\//i,
      );
      if (!match) {
        this.logger.debug(
          `Resource sem documentoId reconhecível: ${notificacao.resource}`,
        );
        continue;
      }

      const documentoId = match[1];
      await this.sincronizarDocumento(documentoId);
    }
  }

  private async sincronizarDocumento(documentoId: string): Promise<void> {
    const db = getDb();

    // Buscar em plano_documento
    let documento = await db.query.planoDocumento.findFirst({
      where: eq(planoDocumento.id, documentoId),
    });
    let tabela: "plano" | "prova" = "plano";

    // Se não encontrou, buscar em prova_documento
    if (!documento) {
      const provaDoc = await db.query.provaDocumento.findFirst({
        where: eq(provaDocumento.id, documentoId),
      });
      if (provaDoc) {
        documento = provaDoc;
        tabela = "prova";
      }
    }

    if (!documento) {
      this.logger.warn(`Documento ${documentoId} não encontrado em nenhuma tabela`);
      return;
    }

    if (!documento.sharepointItemId || !documento.storageKey) {
      this.logger.debug(
        `Documento ${documentoId} sem sharepointItemId ou storageKey — ignorando`,
      );
      return;
    }

    try {
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

      // Atualizar registro e limpar campos do SharePoint
      const dadosAtualizacao = {
        fileSize: buffer.length,
        updatedAt: new Date(),
        sharepointItemId: null,
        sharepointEditUrl: null,
        editandoDesde: null,
      };

      if (tabela === "plano") {
        await db
          .update(planoDocumento)
          .set(dadosAtualizacao)
          .where(eq(planoDocumento.id, documentoId));
      } else {
        await db
          .update(provaDocumento)
          .set(dadosAtualizacao)
          .where(eq(provaDocumento.id, documentoId));
      }

      // Remover arquivo temporário do SharePoint
      // Nota: o link de compartilhamento é invalidado automaticamente ao remover o arquivo
      await this.sharePointService.removerArquivo(documento.sharepointItemId);

      this.logger.log(
        `Documento ${documentoId} sincronizado do SharePoint para MinIO (${tabela}_documento)`,
      );
    } catch (error) {
      this.logger.error(
        `Erro ao sincronizar documento ${documentoId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
