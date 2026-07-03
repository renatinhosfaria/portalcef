import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { Worker } from "bullmq";
import Redis from "ioredis";

import { PdfGeneratorService } from "../../common/sharepoint/pdf-generator.service";
import { PlanejamentoObservabilidadeService } from "../planejamento-observabilidade/planejamento-observabilidade.service";
import { RelatorioPdfWorkerService } from "./relatorio-pdf-worker.service";
import { RelatorioService } from "./relatorio.service";

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

jest.mock("./relatorio.service", () => ({
  RelatorioService: class RelatorioService {},
}));

describe("RelatorioPdfWorkerService", () => {
  let workersCriados: Array<{
    onModuleDestroy: () => Promise<void>;
  }>;
  let relatorioServiceMock: {
    buscarDocumentoParaPdf: jest.Mock;
    marcarPdfGerando: jest.Mock;
    marcarPdfPronto: jest.Mock;
    marcarPdfErro: jest.Mock;
    limparEdicaoSharePoint: jest.Mock;
  };
  let pdfGeneratorServiceMock: {
    gerarParaImpressao: jest.Mock;
  };
  let observabilidadeServiceMock: {
    registrarEvento: jest.Mock;
  };

  const configServiceMock = {
    get: jest.fn((key: string) => {
      if (key === "REDIS_URL") return "redis://redis:6379";
      return undefined;
    }),
  };

  const documentoWord = {
    id: "documento-1",
    relatorioId: "relatorio-1",
    storageKey: "documentos/relatorio.docx",
    url: "https://cdn.exemplo.com/relatorio.docx",
    fileName: "Relatorio semestral.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileSize: 2048,
    approvedBy: "analista-1",
    approvedAt: new Date("2026-05-22T10:00:00.000Z"),
    pdfStatus: "PENDENTE",
    sharepointItemId: "item-ativo",
    sharepointEditUrl: "https://sharepoint/edit",
    editandoDesde: new Date("2026-05-22T09:50:00.000Z"),
  };

  function criarWorker() {
    const WorkerComArgsLivres =
      RelatorioPdfWorkerService as unknown as new (
        ...args: unknown[]
      ) => RelatorioPdfWorkerService;

    const worker = new WorkerComArgsLivres(
      configServiceMock,
      relatorioServiceMock,
      pdfGeneratorServiceMock,
      observabilidadeServiceMock,
    ) as unknown as {
      onModuleDestroy: () => Promise<void>;
      processarDocumento: (documentoId: string) => Promise<void>;
    };

    workersCriados.push(worker);

    return worker;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    workersCriados = [];

    relatorioServiceMock = {
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
    observabilidadeServiceMock = {
      registrarEvento: jest.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(async () => {
    await Promise.all(workersCriados.map((worker) => worker.onModuleDestroy()));
  });

  it("declara observabilidade como dependência injetável", () => {
    const parametros = Reflect.getMetadata(
      "design:paramtypes",
      RelatorioPdfWorkerService,
    );

    expect(parametros).toEqual([
      ConfigService,
      RelatorioService,
      PdfGeneratorService,
      PlanejamentoObservabilidadeService,
    ]);
  });

  it("inicializa Worker BullMQ com fila de relatório", () => {
    criarWorker();

    expect(Redis).toHaveBeenCalledWith(
      "redis://redis:6379",
      expect.objectContaining({ maxRetriesPerRequest: null }),
    );
    expect(Worker).toHaveBeenCalledWith(
      "relatorio-pdf-impressao",
      expect.any(Function),
      expect.objectContaining({
        connection: expect.any(Object),
        concurrency: 2,
      }),
    );
  });

  it("registra eventos pdf_impressao de início, etapa interna e fim", async () => {
    const workerService = criarWorker();
    pdfGeneratorServiceMock.gerarParaImpressao.mockImplementationOnce(
      async (_documento, opcoes) => {
        await opcoes.onEtapa({
          etapa: "converter_pdf",
          duracaoMs: 42,
        });
        return {
          pdfStorageKey: "pdf/documento-1.pdf",
          pdfUrl: "https://cdn.exemplo.com/pdf/documento-1.pdf",
        };
      },
    );

    await workerService.processarDocumento("documento-1");

    expect(observabilidadeServiceMock.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        origem: "api",
        evento: "pdf_impressao",
        nivel: "info",
        arquivo: expect.objectContaining({
          relatorioId: "relatorio-1",
          documentoId: "documento-1",
          nome: "Relatorio semestral.docx",
        }),
        detalhes: expect.objectContaining({
          etapa: "inicio",
          duracaoMs: expect.any(Number),
        }),
      }),
    );
    expect(observabilidadeServiceMock.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        evento: "pdf_impressao",
        detalhes: expect.objectContaining({
          etapa: "converter_pdf",
          duracaoMs: 42,
        }),
      }),
    );
    expect(observabilidadeServiceMock.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        evento: "pdf_impressao",
        nivel: "info",
        detalhes: expect.objectContaining({
          etapa: "fim",
          duracaoMs: expect.any(Number),
        }),
      }),
    );
  });
});
