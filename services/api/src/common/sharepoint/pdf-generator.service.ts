import { Injectable, Logger } from "@nestjs/common";
import { extname } from "node:path";

import { StorageService } from "../storage/storage.service";
import { SharePointService } from "./sharepoint.service";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIME = "application/msword";
const PDF_MIME = "application/pdf";

export interface DocumentoParaPdf {
  id: string;
  storageKey: string | null;
  url: string | null;
  fileName: string | null;
  mimeType: string | null;
}

export interface PdfGerado {
  pdfStorageKey: string;
  pdfUrl: string;
}

/**
 * Gera um PDF derivado do documento para ser usado na impressão
 * (iframe + print() nativo do browser).
 *
 * - PDF original: espelha storageKey/url existentes
 * - DOCX/DOC: sobe para SharePoint, converte via Graph /format=pdf,
 *   salva no MinIO e remove do SharePoint
 * - Outros tipos (imagens, etc.): retorna null (imagem já imprime
 *   diretamente pela url original)
 */
@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);

  constructor(
    private readonly sharePointService: SharePointService,
    private readonly storageService: StorageService,
  ) {}

  async gerarParaImpressao(
    documento: DocumentoParaPdf,
  ): Promise<PdfGerado | null> {
    if (!documento.mimeType || !documento.storageKey || !documento.url) {
      return null;
    }

    if (documento.mimeType === PDF_MIME) {
      return {
        pdfStorageKey: documento.storageKey,
        pdfUrl: documento.url,
      };
    }

    if (!this.isWord(documento.mimeType)) {
      return null;
    }

    if (!this.sharePointService.isConfigurado()) {
      this.logger.warn(
        `SharePoint n\u00e3o configurado \u2014 n\u00e3o foi poss\u00edvel gerar PDF para documento ${documento.id}`,
      );
      return null;
    }

    const fileName = documento.fileName ?? "documento.docx";

    let itemId: string | null = null;
    try {
      itemId = await this.sharePointService.uploadParaSharePoint(
        documento.storageKey,
        fileName,
        documento.id,
      );

      const pdfBuffer = await this.sharePointService.converterParaPdf(itemId);

      const pdfFileName = this.trocarExtensaoParaPdf(fileName);
      const upload = await this.storageService.uploadBuffer(
        pdfBuffer,
        pdfFileName,
        PDF_MIME,
        "pdf",
      );

      this.logger.log(
        `PDF de impress\u00e3o gerado para documento ${documento.id}: ${upload.key}`,
      );

      return {
        pdfStorageKey: upload.key,
        pdfUrl: upload.url,
      };
    } finally {
      if (itemId) {
        await this.sharePointService.removerArquivo(itemId).catch(() => {});
      }
    }
  }

  private isWord(mimeType: string): boolean {
    return mimeType === DOCX_MIME || mimeType === DOC_MIME;
  }

  private trocarExtensaoParaPdf(fileName: string): string {
    const ext = extname(fileName);
    if (!ext) return `${fileName}.pdf`;
    return `${fileName.slice(0, -ext.length)}.pdf`;
  }
}
