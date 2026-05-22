import { ConfigService } from "@nestjs/config";
import { Worker } from "bullmq";
import Redis from "ioredis";

import { PdfGeneratorService } from "../../common/sharepoint/pdf-generator.service";
import { PlanoAulaPdfWorkerService } from "./plano-aula-pdf-worker.service";
import { PlanoAulaService } from "./plano-aula.service";

const mockWorkerClose = jest.fn();
const mockWorkerOn = jest.fn();
const mockRedisQuit = jest.fn();

jest.mock("bullmq", () => ({
  Worker: jest.fn().mockImplementation(() => ({
    on: mockWorkerOn,
    close: mockWorkerClose,
  })),
}));

jest.mock("ioredis", () =>
  jest.fn().mockImplementation(() => ({
    quit: mockRedisQuit,
  })),
);

jest.mock("@essencia/db", () => ({
  getDb: jest.fn(),
  and: jest.fn(),
  eq: jest.fn(),
  or: jest.fn(),
  desc: jest.fn(),
  gte: jest.fn(),
  lte: jest.fn(),
  inArray: jest.fn(),
  isNotNull: jest.fn(),
  ne: jest.fn(),
  planoAula: {},
  planoAulaPeriodo: {},
  planoAulaHistorico: {},
  planoDocumento: {},
  documentoComentario: {},
  quinzenaConfig: {},
  turmas: {},
  users: {},
}));

describe("PlanoAulaPdfWorkerService", () => {
  let workerService: PlanoAulaPdfWorkerService;
  let planoAulaServiceMock: {
    buscarDocumentoParaPdf: jest.Mock;
    marcarPdfGerando: jest.Mock;
    marcarPdfPronto: jest.Mock;
    marcarPdfErro: jest.Mock;
    limparEdicaoSharePoint: jest.Mock;
  };
  let pdfGeneratorServiceMock: {
    gerarParaImpressao: jest.Mock;
  };

  const configServiceMock = {
    get: jest.fn((key: string) => {
      if (key === "REDIS_URL") return "redis://redis:6379";
      if (key === "PLANEJAMENTO_PDF_CONCURRENCY") return "2";
      return undefined;
    }),
  };

  const documentoWord = {
    id: "documento-1",
    storageKey: "documentos/plano.docx",
    url: "https://cdn.exemplo.com/plano.docx",
    fileName: "Plano semanal.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    approvedBy: "analista-1",
    approvedAt: new Date("2026-05-22T10:00:00.000Z"),
    pdfStatus: "PENDENTE",
    sharepointItemId: "item-ativo",
    sharepointEditUrl: "https://sharepoint/edit",
    editandoDesde: new Date("2026-05-22T09:50:00.000Z"),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    planoAulaServiceMock = {
      buscarDocumentoParaPdf: jest.fn().mockResolvedValue(documentoWord),
      marcarPdfGerando: jest.fn().mockResolvedValue(undefined),
      marcarPdfPronto: jest.fn().mockResolvedValue(undefined),
      marcarPdfErro: jest.fn().mockResolvedValue(undefined),
      limparEdicaoSharePoint: jest.fn().mockResolvedValue(undefined),
    };
    pdfGeneratorServiceMock = {
      gerarParaImpressao: jest.fn().mockResolvedValue({
        pdfStorageKey: "pdf/documento-1.pdf",
        pdfUrl: "https://cdn.exemplo.com/pdf/documento-1.pdf",
      }),
    };

    workerService = new PlanoAulaPdfWorkerService(
      configServiceMock as unknown as ConfigService,
      planoAulaServiceMock as unknown as PlanoAulaService,
      pdfGeneratorServiceMock as unknown as PdfGeneratorService,
    );
  });

  it("inicializa Worker BullMQ com fila e concorrência configuradas", () => {
    expect(Redis).toHaveBeenCalledWith(
      "redis://redis:6379",
      expect.objectContaining({ maxRetriesPerRequest: null }),
    );
    expect(Worker).toHaveBeenCalledWith(
      "planejamento-pdf-impressao",
      expect.any(Function),
      expect.objectContaining({
        connection: expect.any(Object),
        concurrency: 2,
      }),
    );
  });

  it("ignora documento inexistente", async () => {
    planoAulaServiceMock.buscarDocumentoParaPdf.mockResolvedValue(null);

    await workerService.processarDocumento("documento-inexistente");

    expect(planoAulaServiceMock.marcarPdfGerando).not.toHaveBeenCalled();
    expect(pdfGeneratorServiceMock.gerarParaImpressao).not.toHaveBeenCalled();
  });

  it("ignora documento não aprovado", async () => {
    planoAulaServiceMock.buscarDocumentoParaPdf.mockResolvedValue({
      ...documentoWord,
      approvedBy: null,
      approvedAt: null,
    });

    await workerService.processarDocumento("documento-1");

    expect(planoAulaServiceMock.marcarPdfGerando).not.toHaveBeenCalled();
    expect(pdfGeneratorServiceMock.gerarParaImpressao).not.toHaveBeenCalled();
  });

  it("marca GERANDO antes de chamar conversão", async () => {
    await workerService.processarDocumento("documento-1");

    expect(planoAulaServiceMock.marcarPdfGerando).toHaveBeenCalledWith(
      "documento-1",
    );
    expect(
      planoAulaServiceMock.marcarPdfGerando.mock.invocationCallOrder[0],
    ).toBeLessThan(
      pdfGeneratorServiceMock.gerarParaImpressao.mock.invocationCallOrder[0],
    );
  });

  it("passa dados de edição ativa para o gerador de PDF", async () => {
    await workerService.processarDocumento("documento-1");

    expect(pdfGeneratorServiceMock.gerarParaImpressao).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "documento-1",
        storageKey: "documentos/plano.docx",
        url: "https://cdn.exemplo.com/plano.docx",
        fileName: "Plano semanal.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sharepointItemId: "item-ativo",
        sharepointEditUrl: "https://sharepoint/edit",
        editandoDesde: new Date("2026-05-22T09:50:00.000Z"),
      }),
    );
  });

  it("salva PDF pronto após conversão", async () => {
    await workerService.processarDocumento("documento-1");

    expect(planoAulaServiceMock.marcarPdfPronto).toHaveBeenCalledWith(
      "documento-1",
      {
        pdfStorageKey: "pdf/documento-1.pdf",
        pdfUrl: "https://cdn.exemplo.com/pdf/documento-1.pdf",
      },
    );
  });

  it("salva erro truncado quando conversão falha", async () => {
    const erro = new Error("Graph indisponível");
    pdfGeneratorServiceMock.gerarParaImpressao.mockRejectedValue(erro);

    await workerService.processarDocumento("documento-1");

    expect(planoAulaServiceMock.marcarPdfErro).toHaveBeenCalledWith(
      "documento-1",
      erro,
    );
  });

  it("limpa campos de edição SharePoint ao final quando havia item ativo", async () => {
    await workerService.processarDocumento("documento-1");

    expect(planoAulaServiceMock.limparEdicaoSharePoint).toHaveBeenCalledWith(
      "documento-1",
    );
  });
});
