import { StorageService } from "../storage/storage.service";
import {
  DocumentoParaPdf,
  PdfGeneratorService,
} from "./pdf-generator.service";
import { SharePointService } from "./sharepoint.service";

describe("PdfGeneratorService", () => {
  let service: PdfGeneratorService;
  let sharePointService: {
    isConfigurado: jest.Mock;
    uploadParaSharePoint: jest.Mock;
    converterParaPdf: jest.Mock;
    removerArquivo: jest.Mock;
    foiModificadoApos: jest.Mock;
    baixarArquivo: jest.Mock;
  };
  let storageService: {
    uploadBuffer: jest.Mock;
    replaceFile: jest.Mock;
  };

  type DocumentoParaPdfComEdicao = DocumentoParaPdf & {
    sharepointItemId?: string | null;
    sharepointEditUrl?: string | null;
    editandoDesde?: Date | null;
  };

  const documentoWord = (
    overrides: Partial<DocumentoParaPdfComEdicao> = {},
  ): DocumentoParaPdfComEdicao => ({
    id: "documento-1",
    storageKey: "documentos/original.docx",
    url: "https://storage.test/original.docx",
    fileName: "planejamento.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ...overrides,
  });

  beforeEach(() => {
    sharePointService = {
      isConfigurado: jest.fn().mockReturnValue(true),
      uploadParaSharePoint: jest.fn().mockResolvedValue("item-novo"),
      converterParaPdf: jest.fn().mockResolvedValue(Buffer.from("%PDF")),
      removerArquivo: jest.fn().mockResolvedValue(true),
      foiModificadoApos: jest.fn().mockResolvedValue(false),
      baixarArquivo: jest.fn().mockResolvedValue(Buffer.from("docx atualizado")),
    };

    storageService = {
      uploadBuffer: jest.fn().mockResolvedValue({
        key: "pdf/documento-1.pdf",
        url: "https://storage.test/pdf/documento-1.pdf",
        name: "planejamento.pdf",
      }),
      replaceFile: jest.fn().mockResolvedValue(undefined),
    };

    service = new PdfGeneratorService(
      sharePointService as unknown as SharePointService,
      storageService as unknown as StorageService,
    );
  });

  it("converte item ativo do SharePoint sem fazer novo upload", async () => {
    const resultado = await service.gerarParaImpressao(
      documentoWord({
        sharepointItemId: "item-ativo",
        editandoDesde: new Date("2026-05-22T10:00:00.000Z"),
      }),
    );

    expect(sharePointService.uploadParaSharePoint).not.toHaveBeenCalled();
    expect(sharePointService.converterParaPdf).toHaveBeenCalledWith(
      "item-ativo",
    );
    expect(sharePointService.removerArquivo).toHaveBeenCalledWith(
      "item-ativo",
    );
    expect(resultado).toEqual({
      pdfStorageKey: "pdf/documento-1.pdf",
      pdfUrl: "https://storage.test/pdf/documento-1.pdf",
    });
  });

  it("sincroniza arquivo ativo modificado antes de salvar PDF", async () => {
    const editandoDesde = new Date("2026-05-22T10:00:00.000Z");
    sharePointService.foiModificadoApos.mockResolvedValue(true);

    await service.gerarParaImpressao(
      documentoWord({
        sharepointItemId: "item-ativo",
        editandoDesde,
      }),
    );

    expect(sharePointService.foiModificadoApos).toHaveBeenCalledWith(
      "item-ativo",
      editandoDesde,
    );
    expect(sharePointService.baixarArquivo).toHaveBeenCalledWith("item-ativo");
    expect(storageService.replaceFile).toHaveBeenCalledWith(
      "documentos/original.docx",
      Buffer.from("docx atualizado"),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "planejamento.docx",
    );
  });

  it("faz upload do storage quando não existe item ativo", async () => {
    await service.gerarParaImpressao(documentoWord());

    expect(sharePointService.uploadParaSharePoint).toHaveBeenCalledWith(
      "documentos/original.docx",
      "planejamento.docx",
      "documento-1",
    );
    expect(sharePointService.converterParaPdf).toHaveBeenCalledWith(
      "item-novo",
    );
    expect(sharePointService.removerArquivo).toHaveBeenCalledWith("item-novo");
  });

  it("remove item temporário mesmo quando conversão falha", async () => {
    sharePointService.converterParaPdf.mockRejectedValue(
      new Error("Graph indisponível"),
    );

    await expect(service.gerarParaImpressao(documentoWord())).rejects.toThrow(
      "Graph indisponível",
    );

    expect(sharePointService.removerArquivo).toHaveBeenCalledWith("item-novo");
  });

  it("preserva PDF nativo sem chamar SharePoint", async () => {
    const resultado = await service.gerarParaImpressao({
      id: "documento-pdf",
      storageKey: "documentos/original.pdf",
      url: "https://storage.test/original.pdf",
      fileName: "original.pdf",
      mimeType: "application/pdf",
    });

    expect(resultado).toEqual({
      pdfStorageKey: "documentos/original.pdf",
      pdfUrl: "https://storage.test/original.pdf",
    });
    expect(sharePointService.uploadParaSharePoint).not.toHaveBeenCalled();
    expect(sharePointService.converterParaPdf).not.toHaveBeenCalled();
    expect(storageService.uploadBuffer).not.toHaveBeenCalled();
  });
});
