import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { PdfGeneratorService } from "../../common/sharepoint/pdf-generator.service";
import { StorageService } from "../../common/storage/storage.service";
import { PlanoAulaHistoricoService } from "./plano-aula-historico.service";
import { PlanoAulaPdfQueueService } from "./plano-aula-pdf-queue.service";
import { PlanoAulaService } from "./plano-aula.service";

const mockTx = {
  query: {
    planoAula: {
      findMany: jest.fn(),
    },
    users: {
      findMany: jest.fn(),
    },
  },
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
};

const mockDb = {
  query: {
    planoDocumento: {
      findFirst: jest.fn(),
    },
    users: {
      findFirst: jest.fn(),
    },
    planoAula: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    planoAulaPeriodo: {
      findFirst: jest.fn(),
    },
    turmas: {
      findFirst: jest.fn(),
    },
  },
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  transaction: jest.fn(async (cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
};

jest.mock("@essencia/db", () => ({
  getDb: jest.fn(() => mockDb),
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

describe("PlanoAulaService", () => {
  let service: PlanoAulaService;
  const historicoServiceMock = {
    registrar: jest.fn(),
  };

  const usuarioLogado = {
    userId: "user-1",
    role: "analista_pedagogico",
    schoolId: "school-1",
    unitId: "unit-1",
    stageId: null,
  };

  const pdfGeneratorServiceMock = {
    gerarParaImpressao: jest.fn(),
  };
  const planoAulaPdfQueueServiceMock = {
    adicionar: jest.fn(),
  };
  const storageServiceMock = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanoAulaService,
        {
          provide: PlanoAulaHistoricoService,
          useValue: historicoServiceMock,
        },
        {
          provide: PdfGeneratorService,
          useValue: pdfGeneratorServiceMock,
        },
        {
          provide: PlanoAulaPdfQueueService,
          useValue: planoAulaPdfQueueServiceMock,
        },
        {
          provide: StorageService,
          useValue: storageServiceMock,
        },
      ],
    }).compile();

    service = module.get<PlanoAulaService>(PlanoAulaService);
    jest.clearAllMocks();
  });

  describe("criarPlano", () => {
    const usuarioProfessoraUnit1 = {
      userId: "professora-1",
      role: "professora",
      schoolId: "school-1",
      unitId: "unit-1",
      stageId: null,
    };

    beforeEach(() => {
      mockDb.query.planoAula.findFirst.mockResolvedValue(null);
      mockDb.returning.mockResolvedValue([
        {
          id: "plano-1",
          turmaId: "turma-1",
          unitId: "unit-1",
          quinzenaId: "periodo-1",
          planoAulaPeriodoId: "periodo-1",
          status: "RASCUNHO",
        },
      ]);
    });

    it("bloqueia período de outra unidade ao criar plano", async () => {
      mockDb.query.turmas.findFirst.mockResolvedValue({
        id: "turma-1",
        unitId: "unit-1",
        stage: { code: "INFANTIL" },
      });
      mockDb.query.planoAulaPeriodo.findFirst.mockResolvedValue(null);

      await expect(
        service.criarPlano(usuarioProfessoraUnit1, {
          turmaId: "turma-1",
          quinzenaId: "periodo-outra-unidade",
        }),
      ).rejects.toThrow("Período de plano de aula não encontrado");
    });

    it("bloqueia período de etapa diferente da turma", async () => {
      mockDb.query.turmas.findFirst.mockResolvedValue({
        id: "turma-1",
        unitId: "unit-1",
        stage: { code: "INFANTIL" },
      });
      mockDb.query.planoAulaPeriodo.findFirst.mockResolvedValue({
        id: "periodo-1",
        unidadeId: "unit-1",
        etapa: "FUNDAMENTAL_I",
      });

      await expect(
        service.criarPlano(usuarioProfessoraUnit1, {
          turmaId: "turma-1",
          quinzenaId: "periodo-1",
        }),
      ).rejects.toThrow("Período não pertence à etapa da turma");
    });
  });

  describe("registrarImpressaoDocumento", () => {
    it("deve marcar documento como impresso e registrar no histórico", async () => {
      mockDb.query.planoDocumento.findFirst.mockResolvedValue({
        id: "doc-1",
        planoId: "plano-1",
        fileName: "Plano semanal.pdf",
        mimeType: "application/pdf",
        url: "https://cdn.exemplo.com/doc-1.pdf",
        approvedBy: "analista-1",
        approvedAt: new Date("2026-02-06T14:00:00.000Z"),
        plano: {
          status: "APROVADO",
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service as any, "getPlanoById").mockResolvedValue({
        id: "plano-1",
        status: "APROVADO",
      });

      mockDb.query.users.findFirst.mockResolvedValue({
        id: usuarioLogado.userId,
        name: "Analista Teste",
      });

      mockDb.returning.mockResolvedValue([
        {
          id: "doc-1",
          planoId: "plano-1",
          printedBy: usuarioLogado.userId,
          printedAt: new Date("2026-02-06T18:00:00.000Z"),
        },
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resultado = await (service as any).registrarImpressaoDocumento(
        usuarioLogado,
        "doc-1",
      );

      expect(resultado).toBeDefined();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          printedBy: usuarioLogado.userId,
          printedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      );
      expect(historicoServiceMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          planoId: "plano-1",
          acao: "DOCUMENTO_IMPRESSO",
        }),
      );
    });

    it("deve falhar ao imprimir documento não aprovado", async () => {
      mockDb.query.planoDocumento.findFirst.mockResolvedValue({
        id: "doc-2",
        planoId: "plano-1",
        fileName: "Plano semanal.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        url: "https://cdn.exemplo.com/doc-2.docx",
        approvedBy: null,
        approvedAt: null,
        plano: {
          status: "AGUARDANDO_ANALISTA",
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service as any, "getPlanoById").mockResolvedValue({
        id: "plano-1",
        status: "AGUARDANDO_ANALISTA",
      });

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).registrarImpressaoDocumento(usuarioLogado, "doc-2"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("aprovarDocumento", () => {
    beforeEach(() => {
      mockDb.query.planoDocumento.findFirst.mockReset();
      mockDb.returning.mockReset();
      pdfGeneratorServiceMock.gerarParaImpressao.mockReset();
      planoAulaPdfQueueServiceMock.adicionar.mockReset();
    });

    it("aprova Word como PDF pendente e enfileira geração sem bloquear", async () => {
      mockDb.query.planoDocumento.findFirst.mockResolvedValue({
        id: "doc-word",
        planoId: "plano-1",
        storageKey: "documentos/plano.docx",
        url: "https://cdn.exemplo.com/plano.docx",
        fileName: "Plano semanal.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        plano: { unitId: "unit-1" },
      });
      mockDb.returning.mockResolvedValue([
        {
          id: "doc-word",
          approvedBy: usuarioLogado.userId,
          pdfStatus: "PENDENTE",
        },
      ]);

      await service.aprovarDocumento(usuarioLogado, "doc-word");

      expect(pdfGeneratorServiceMock.gerarParaImpressao).not.toHaveBeenCalled();
      expect(planoAulaPdfQueueServiceMock.adicionar).toHaveBeenCalledWith(
        "doc-word",
      );
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          approvedBy: usuarioLogado.userId,
          approvedAt: expect.any(Date),
          pdfStatus: "PENDENTE",
          pdfStorageKey: null,
          pdfUrl: null,
          pdfError: null,
          pdfRequestedAt: expect.any(Date),
          pdfGeneratedAt: null,
          updatedAt: expect.any(Date),
        }),
      );
    });

    it("aprova PDF nativo como pronto e espelha arquivo original", async () => {
      mockDb.query.planoDocumento.findFirst.mockResolvedValue({
        id: "doc-pdf",
        planoId: "plano-1",
        storageKey: "documentos/plano.pdf",
        url: "https://cdn.exemplo.com/plano.pdf",
        fileName: "Plano semanal.pdf",
        mimeType: "application/pdf",
        plano: { unitId: "unit-1" },
      });
      mockDb.returning.mockResolvedValue([
        {
          id: "doc-pdf",
          approvedBy: usuarioLogado.userId,
          pdfStatus: "PRONTO",
        },
      ]);

      await service.aprovarDocumento(usuarioLogado, "doc-pdf");

      expect(pdfGeneratorServiceMock.gerarParaImpressao).not.toHaveBeenCalled();
      expect(planoAulaPdfQueueServiceMock.adicionar).not.toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          approvedBy: usuarioLogado.userId,
          pdfStatus: "PRONTO",
          pdfStorageKey: "documentos/plano.pdf",
          pdfUrl: "https://cdn.exemplo.com/plano.pdf",
          pdfError: null,
          pdfRequestedAt: expect.any(Date),
          pdfGeneratedAt: expect.any(Date),
        }),
      );
    });

    it("aprova link sem geração de PDF", async () => {
      mockDb.query.planoDocumento.findFirst.mockResolvedValue({
        id: "doc-link",
        planoId: "plano-1",
        storageKey: null,
        url: "https://youtube.com/watch?v=123",
        fileName: null,
        mimeType: null,
        plano: { unitId: "unit-1" },
      });
      mockDb.returning.mockResolvedValue([
        {
          id: "doc-link",
          approvedBy: usuarioLogado.userId,
          pdfStatus: "NAO_APLICAVEL",
        },
      ]);

      await service.aprovarDocumento(usuarioLogado, "doc-link");

      expect(pdfGeneratorServiceMock.gerarParaImpressao).not.toHaveBeenCalled();
      expect(planoAulaPdfQueueServiceMock.adicionar).not.toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          approvedBy: usuarioLogado.userId,
          pdfStatus: "NAO_APLICAVEL",
          pdfStorageKey: null,
          pdfUrl: null,
          pdfError: null,
          pdfRequestedAt: null,
          pdfGeneratedAt: null,
        }),
      );
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
      mockDb.query.planoAula.findMany.mockResolvedValue([]);

      await expect(service.getDashboard(user, "unit-2")).rejects.toThrow(
        ForbiddenException,
      );

      expect(mockDb.query.planoAula.findMany).not.toHaveBeenCalled();
    });
  });

  describe("transferirPlanosPendentes", () => {
    const ator = {
      userId: "coord-1",
      userName: "Coordenadora Ana",
      userRole: "coordenadora_geral",
    };

    it("transfere planos não-aprovados, atualiza userId e cria histórico TRANSFERIDO", async () => {
      // Planos pendentes da turma
      mockTx.query.planoAula.findMany.mockResolvedValue([
        { id: "plano-1", status: "RASCUNHO" },
        { id: "plano-2", status: "DEVOLVIDO_ANALISTA" },
      ]);

      // Nomes das professoras
      mockTx.query.users.findMany.mockResolvedValue([
        { id: "prof-antiga", name: "Maria da Silva" },
        { id: "prof-nova", name: "Joana Souza" },
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (service as any).transferirPlanosPendentes(
        mockTx,
        "turma-1",
        "prof-antiga",
        "prof-nova",
        ator,
      );

      expect(result.planosTransferidos).toEqual(["plano-1", "plano-2"]);
      // Confirma UPDATE
      expect(mockTx.update).toHaveBeenCalled();
      expect(mockTx.set).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "prof-nova" }),
      );
      // Confirma INSERT no histórico — uma chamada por plano transferido
      expect(mockTx.insert).toHaveBeenCalledTimes(2);
      expect(mockTx.values).toHaveBeenCalledWith(
        expect.objectContaining({
          planoId: "plano-1",
          userId: "coord-1",
          userName: "Coordenadora Ana",
          userRole: "coordenadora_geral",
          acao: "TRANSFERIDO",
          statusAnterior: "RASCUNHO",
          statusNovo: "RASCUNHO",
          detalhes: expect.objectContaining({
            professoraAnteriorId: "prof-antiga",
            professoraAnteriorNome: "Maria da Silva",
            novaProfessoraId: "prof-nova",
            novaProfessoraNome: "Joana Souza",
            motivo: "troca_titular_turma",
          }),
        }),
      );
    });

    it("retorna lista vazia e não cria histórico quando turma não tem planos pendentes", async () => {
      mockTx.query.planoAula.findMany.mockResolvedValue([]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (service as any).transferirPlanosPendentes(
        mockTx,
        "turma-1",
        "prof-antiga",
        "prof-nova",
        ator,
      );

      expect(result.planosTransferidos).toEqual([]);
      expect(mockTx.update).not.toHaveBeenCalled();
      expect(mockTx.insert).not.toHaveBeenCalled();
    });

    it("chama findMany com filtro WHERE para excluir APROVADOS", async () => {
      mockTx.query.planoAula.findMany.mockResolvedValue([
        { id: "plano-1", status: "RASCUNHO" },
      ]);
      mockTx.query.users.findMany.mockResolvedValue([
        { id: "prof-antiga", name: "Maria" },
        { id: "prof-nova", name: "Joana" },
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (service as any).transferirPlanosPendentes(
        mockTx,
        "turma-1",
        "prof-antiga",
        "prof-nova",
        ator,
      );

      expect(mockTx.query.planoAula.findMany).toHaveBeenCalledTimes(1);
      expect(mockTx.query.planoAula.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          columns: expect.objectContaining({ id: true, status: true }),
        }),
      );
      const callArg = mockTx.query.planoAula.findMany.mock.calls[0][0];
      expect(callArg).toHaveProperty("where");
    });
  });
});
