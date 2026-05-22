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
  sharepointItemId?: string | null;
  sharepointEditUrl?: string | null;
  editandoDesde?: Date | null;
}

export interface PdfGerado {
  pdfStorageKey: string;
  pdfUrl: string;
}

export interface PdfGeneratorEtapa {
  etapa: string;
  duracaoMs: number;
  detalhes?: Record<string, unknown>;
}

export interface PdfGeneratorObservabilidade {
  onEtapa?: (etapa: PdfGeneratorEtapa) => void | Promise<void>;
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
    observabilidade?: PdfGeneratorObservabilidade,
  ): Promise<PdfGerado | null> {
    if (!documento.mimeType || !documento.storageKey || !documento.url) {
      return null;
    }

    if (documento.mimeType === PDF_MIME) {
      await this.registrarEtapa(observabilidade, {
        etapa: "pdf_nativo",
        duracaoMs: 0,
      });

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

    const storageKey = documento.storageKey;
    const fileName = documento.fileName ?? "documento.docx";
    const itemAtivo =
      documento.sharepointItemId && documento.editandoDesde
        ? {
            id: documento.sharepointItemId,
            editandoDesde: documento.editandoDesde,
          }
        : null;

    let itemId: string | null = itemAtivo?.id ?? null;
    try {
      if (itemAtivo) {
        await this.registrarEtapa(observabilidade, {
          etapa: "sharepoint_item_ativo",
          duracaoMs: 0,
          detalhes: { itemAtivo: true },
        });
        await this.sincronizarItemAtivoSeNecessario(
          documento,
          itemAtivo.id,
          itemAtivo.editandoDesde,
          fileName,
          observabilidade,
        );
      } else {
        itemId = await this.medirEtapa(
          observabilidade,
          "upload_sharepoint",
          () =>
            this.sharePointService.uploadParaSharePoint(
              storageKey,
              fileName,
              documento.id,
            ),
        );
      }

      if (!itemId) {
        throw new Error(
          `Item SharePoint não definido para documento ${documento.id}`,
        );
      }

      const itemIdParaConverter = itemId;
      const pdfBuffer = await this.medirEtapa(
        observabilidade,
        "converter_pdf",
        () => this.sharePointService.converterParaPdf(itemIdParaConverter),
      );

      const pdfFileName = this.trocarExtensaoParaPdf(fileName);
      const upload = await this.medirEtapa(
        observabilidade,
        "upload_pdf_storage",
        () =>
          this.storageService.uploadBuffer(
            pdfBuffer,
            pdfFileName,
            PDF_MIME,
            "pdf",
          ),
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
        await this.medirEtapa(
          observabilidade,
          "remover_sharepoint",
          async () => {
            await this.sharePointService.removerArquivo(itemId!).catch(() => {});
          },
        );
      }
    }
  }

  private isWord(mimeType: string): boolean {
    return mimeType === DOCX_MIME || mimeType === DOC_MIME;
  }

  private async sincronizarItemAtivoSeNecessario(
    documento: DocumentoParaPdf,
    itemId: string,
    editandoDesde: Date,
    fileName: string,
    observabilidade?: PdfGeneratorObservabilidade,
  ): Promise<void> {
    const foiModificado = await this.medirEtapa(
      observabilidade,
      "verificar_modificacao_sharepoint",
      () => this.sharePointService.foiModificadoApos(itemId, editandoDesde),
    );

    if (!foiModificado) return;

    await this.medirEtapa(
      observabilidade,
      "sincronizar_word",
      async () => {
        const buffer = await this.sharePointService.baixarArquivo(itemId);
        await this.storageService.replaceFile(
          documento.storageKey!,
          buffer,
          documento.mimeType ?? DOCX_MIME,
          fileName,
        );
      },
      { modificado: true },
    );
  }

  private async medirEtapa<T>(
    observabilidade: PdfGeneratorObservabilidade | undefined,
    etapa: string,
    executar: () => Promise<T>,
    detalhes?: Record<string, unknown>,
  ): Promise<T> {
    const inicio = Date.now();
    try {
      const resultado = await executar();
      await this.registrarEtapa(observabilidade, {
        etapa,
        duracaoMs: Date.now() - inicio,
        detalhes,
      });
      return resultado;
    } catch (error) {
      await this.registrarEtapa(observabilidade, {
        etapa,
        duracaoMs: Date.now() - inicio,
        detalhes: {
          ...(detalhes ?? {}),
          erro: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  private async registrarEtapa(
    observabilidade: PdfGeneratorObservabilidade | undefined,
    etapa: PdfGeneratorEtapa,
  ): Promise<void> {
    if (!observabilidade?.onEtapa) return;

    try {
      await observabilidade.onEtapa(etapa);
    } catch {
      return;
    }
  }

  private trocarExtensaoParaPdf(fileName: string): string {
    const ext = extname(fileName);
    if (!ext) return `${fileName}.pdf`;
    return `${fileName.slice(0, -ext.length)}.pdf`;
  }
}
