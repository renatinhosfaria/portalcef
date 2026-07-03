import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { PdfGeneratorService } from "../../common/sharepoint/pdf-generator.service";
import { StorageService } from "../../common/storage/storage.service";
import { ProvaHistoricoService } from "./prova-historico.service";
import { ProvaService } from "./prova.service";

const mockDb = {
  query: {
    prova: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    provaDocumento: {
      findFirst: jest.fn(),
    },
    users: {
      findFirst: jest.fn(),
    },
  },
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  returning: jest.fn(),
};

jest.mock("@essencia/db", () => ({
  getDb: jest.fn(() => mockDb),
  and: jest.fn(),
  eq: jest.fn(),
  desc: jest.fn(),
  gte: jest.fn(),
  lte: jest.fn(),
  inArray: jest.fn(),
  isNotNull: jest.fn(),
  prova: {},
  provaDocumento: {},
  provaCiclo: {},
  turmas: {},
  users: {},
}));

describe("ProvaService", () => {
  let service: ProvaService;
  const historicoServiceMock = {
    registrar: jest.fn(),
  };
  const pdfGeneratorServiceMock = {
    gerarParaImpressao: jest.fn(),
  };
  const storageServiceMock = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvaService,
        {
          provide: ProvaHistoricoService,
          useValue: historicoServiceMock,
        },
        {
          provide: PdfGeneratorService,
          useValue: pdfGeneratorServiceMock,
        },
        {
          provide: StorageService,
          useValue: storageServiceMock,
        },
      ],
    }).compile();

    service = module.get<ProvaService>(ProvaService);
    jest.clearAllMocks();
  });

  describe("enviarParaImpressao", () => {
    it("gera PDF dos documentos antes de liberar a prova para impressão", async () => {
      const user = {
        userId: "prof-1",
        role: "professora",
        schoolId: "school-1",
        unitId: "unit-1",
        stageId: null,
      };

      mockDb.query.prova.findFirst.mockResolvedValue({
        id: "prova-1",
        userId: "prof-1",
        unitId: "unit-1",
        status: "RASCUNHO",
        documentos: [
          {
            id: "doc-1",
            storageKey: "provas/doc-1.docx",
            url: "https://cdn/doc-1.docx",
            fileName: "Prova.docx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            pdfStorageKey: null,
            pdfUrl: null,
          },
        ],
      });
      pdfGeneratorServiceMock.gerarParaImpressao.mockResolvedValue({
        pdfStorageKey: "pdf/doc-1.pdf",
        pdfUrl: "https://cdn/doc-1.pdf",
      });
      mockDb.query.users.findFirst.mockResolvedValue({ name: "Professora" });
      mockDb.returning.mockResolvedValueOnce([
        {
          id: "prova-1",
          status: "AGUARDANDO_IMPRESSAO",
        },
      ]);

      const resultado = await service.enviarParaImpressao(user, "prova-1");

      expect(pdfGeneratorServiceMock.gerarParaImpressao).toHaveBeenCalledWith({
        id: "doc-1",
        storageKey: "provas/doc-1.docx",
        url: "https://cdn/doc-1.docx",
        fileName: "Prova.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sharepointItemId: undefined,
        sharepointEditUrl: undefined,
        editandoDesde: undefined,
      });
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          pdfStorageKey: "pdf/doc-1.pdf",
          pdfUrl: "https://cdn/doc-1.pdf",
        }),
      );
      expect(historicoServiceMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: "SUBMETIDO_IMPRESSAO",
          statusNovo: "AGUARDANDO_IMPRESSAO",
        }),
      );
      expect(resultado.status).toBe("AGUARDANDO_IMPRESSAO");
    });
  });

  describe("enviarParaResponder", () => {
    const userGestao = {
      userId: "gestao-1",
      role: "gerente_unidade",
      schoolId: "school-1",
      unitId: "unit-1",
      stageId: null,
    };

    it("envia prova totalmente impressa direto para análise", async () => {
      mockDb.query.prova.findFirst.mockResolvedValue({
        id: "prova-1",
        unitId: "unit-1",
        status: "AGUARDANDO_IMPRESSAO",
        documentos: [
          {
            id: "doc-1",
            tipo: "ARQUIVO",
            printedAt: new Date("2026-06-17T14:29:00.000Z"),
          },
          {
            id: "doc-youtube",
            tipo: "LINK_YOUTUBE",
            printedAt: null,
          },
        ],
      });
      mockDb.query.users.findFirst.mockResolvedValue({ name: "Gestão" });
      mockDb.returning.mockResolvedValueOnce([
        {
          id: "prova-1",
          status: "AGUARDANDO_ANALISTA",
        },
      ]);

      const resultado = await service.enviarParaResponder(userGestao, "prova-1");

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "AGUARDANDO_ANALISTA",
        }),
      );
      expect(historicoServiceMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: "SUBMETIDO_ANALISTA",
          statusAnterior: "AGUARDANDO_IMPRESSAO",
          statusNovo: "AGUARDANDO_ANALISTA",
          detalhes: expect.objectContaining({
            origem: "gestao_impressao",
          }),
        }),
      );
      expect(resultado.status).toBe("AGUARDANDO_ANALISTA");
    });

    it("bloqueia envio para análise quando há documento sem impressão confirmada", async () => {
      mockDb.query.prova.findFirst.mockResolvedValue({
        id: "prova-1",
        unitId: "unit-1",
        status: "AGUARDANDO_IMPRESSAO",
        documentos: [
          {
            id: "doc-1",
            tipo: "ARQUIVO",
            printedAt: null,
          },
        ],
      });

      await expect(
        service.enviarParaResponder(userGestao, "prova-1"),
      ).rejects.toThrow(BadRequestException);

      expect(mockDb.update).not.toHaveBeenCalled();
      expect(historicoServiceMock.registrar).not.toHaveBeenCalled();
    });
  });

  describe("regerarPdfDocumento", () => {
    const userAnalista = {
      userId: "analista-1",
      role: "analista_pedagogico",
      schoolId: "school-1",
      unitId: "unit-1",
      stageId: null,
    };

    it("gera novamente o PDF de impressão de um documento Word da prova", async () => {
      mockDb.query.provaDocumento.findFirst.mockResolvedValue({
        id: "doc-1",
        provaId: "prova-1",
        tipo: "ARQUIVO",
        storageKey: "provas/doc-1.docx",
        url: "https://cdn/doc-1.docx",
        fileName: "Prova.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sharepointItemId: null,
        sharepointEditUrl: null,
        editandoDesde: null,
        approvedBy: "analista-1",
        approvedAt: new Date("2026-06-18T11:00:00.000Z"),
        prova: {
          unitId: "unit-1",
        },
      });
      pdfGeneratorServiceMock.gerarParaImpressao.mockResolvedValue({
        pdfStorageKey: "pdf/doc-1.pdf",
        pdfUrl: "https://cdn/doc-1.pdf",
      });
      mockDb.returning.mockResolvedValueOnce([
        {
          id: "doc-1",
          pdfStorageKey: "pdf/doc-1.pdf",
          pdfUrl: "https://cdn/doc-1.pdf",
        },
      ]);

      const resultado = await service.regerarPdfDocumento(userAnalista, "doc-1");

      expect(pdfGeneratorServiceMock.gerarParaImpressao).toHaveBeenCalledWith({
        id: "doc-1",
        storageKey: "provas/doc-1.docx",
        url: "https://cdn/doc-1.docx",
        fileName: "Prova.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sharepointItemId: null,
        sharepointEditUrl: null,
        editandoDesde: null,
      });
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          pdfStorageKey: "pdf/doc-1.pdf",
          pdfUrl: "https://cdn/doc-1.pdf",
        }),
      );
      expect(resultado.pdfUrl).toBe("https://cdn/doc-1.pdf");
    });
  });

  describe("getDashboard", () => {
    it("bloqueia gerente_unidade consultando dashboard de outra unidade", async () => {
      const user = {
        userId: "user-1",
        role: "gerente_unidade",
        schoolId: "school-1",
        unitId: "unit-1",
        stageId: null,
      };
      mockDb.query.prova.findMany.mockResolvedValue([]);

      await expect(service.getDashboard(user, "unit-2")).rejects.toThrow(
        ForbiddenException,
      );

      expect(mockDb.query.prova.findMany).not.toHaveBeenCalled();
    });
  });

  describe("listarProvasGestao", () => {
    it("permite coordenadora listar somente provas do seu segmento", async () => {
      const user = {
        userId: "coord-1",
        role: "coordenadora_infantil",
        schoolId: "school-1",
        unitId: "unit-1",
        stageId: null,
      };

      mockDb.query.prova.findMany.mockResolvedValue([
        {
          id: "prova-infantil",
          provaCicloId: "ciclo-1",
          status: "AGUARDANDO_IMPRESSAO",
          submittedAt: new Date("2026-06-10T12:00:00.000Z"),
          createdAt: new Date("2026-06-09T12:00:00.000Z"),
          updatedAt: new Date("2026-06-10T12:00:00.000Z"),
          user: { name: "Maria Silva" },
          turma: {
            name: "Infantil 1",
            code: "INF1",
            stage: { name: "Infantil", code: "INFANTIL" },
          },
          documentos: [{ id: "doc-1" }],
        },
        {
          id: "prova-fundamental",
          provaCicloId: "ciclo-2",
          status: "AGUARDANDO_IMPRESSAO",
          submittedAt: new Date("2026-06-10T12:00:00.000Z"),
          createdAt: new Date("2026-06-09T12:00:00.000Z"),
          updatedAt: new Date("2026-06-10T12:00:00.000Z"),
          user: { name: "Ana Souza" },
          turma: {
            name: "1º Ano",
            code: "1A",
            stage: { name: "Fundamental I", code: "FUNDAMENTAL_I" },
          },
          documentos: [{ id: "doc-2" }],
        },
      ]);

      const resultado = await service.listarProvasGestao(user, {
        status: "todos",
        page: 1,
        limit: 20,
      });

      expect(resultado.data).toHaveLength(1);
      expect(resultado.data[0]?.id).toBe("prova-infantil");
    });
  });
});
