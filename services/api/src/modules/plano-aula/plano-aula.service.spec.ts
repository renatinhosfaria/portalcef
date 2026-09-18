import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { PdfGeneratorService } from "../../common/sharepoint/pdf-generator.service";
import { SharePointService } from "../../common/sharepoint/sharepoint.service";
import { StorageService } from "../../common/storage/storage.service";
import { isNull, type DocumentoTipo } from "@essencia/db";
import { PlanoAulaHistoricoService } from "./plano-aula-historico.service";
import { PlanoAulaPdfQueueService } from "./plano-aula-pdf-queue.service";
import { PlanoAulaService } from "./plano-aula.service";

const mockTx = {
  query: {
    planoDocumento: {
      findFirst: jest.fn(),
    },
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
  delete: jest.fn().mockReturnThis(),
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
    units: {
      findFirst: jest.fn(),
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
  transaction: jest.fn(async (cb: (tx: typeof mockTx) => unknown) =>
    cb(mockTx),
  ),
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
  isNull: jest.fn(),
  ne: jest.fn(),
  planoAula: {},
  planoAulaPeriodo: {},
  planoAulaHistorico: {},
  planoDocumento: {
    approvedBy: "planoDocumento.approvedBy",
    approvedAt: "planoDocumento.approvedAt",
  },
  documentoComentario: {},
  units: {},
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
  const storageServiceMock = {
    deleteFile: jest.fn().mockResolvedValue(undefined),
  };
  const sharePointServiceMock = {
    removerArquivo: jest.fn().mockResolvedValue(true),
  };

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
        {
          provide: SharePointService,
          useValue: sharePointServiceMock,
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

    it("marca erro recuperável quando Redis falha ao enfileirar PDF", async () => {
      mockDb.query.planoDocumento.findFirst.mockResolvedValue({
        id: "doc-word-falha-fila",
        planoId: "plano-1",
        storageKey: "documentos/plano.docx",
        url: "https://cdn.exemplo.com/plano.docx",
        fileName: "Plano semanal.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        plano: { unitId: "unit-1" },
      });
      mockDb.returning.mockResolvedValue([
        { id: "doc-word-falha-fila", pdfStatus: "PENDENTE" },
      ]);
      planoAulaPdfQueueServiceMock.adicionar.mockRejectedValueOnce(
        new Error("Redis indisponível"),
      );

      await expect(
        service.aprovarDocumento(usuarioLogado, "doc-word-falha-fila"),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          pdfStatus: "ERRO",
          pdfError: "Falha ao enfileirar PDF para processamento",
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

  describe("persistência do PDF de impressão", () => {
    beforeEach(() => {
      mockDb.query.planoDocumento.findFirst.mockReset();
      mockDb.returning.mockReset();
    });

    it("busca documento para geração de PDF", async () => {
      mockDb.query.planoDocumento.findFirst.mockResolvedValue({
        id: "doc-pdf",
        pdfStatus: "PENDENTE",
      });

      const resultado = await service.buscarDocumentoParaPdf("doc-pdf");

      expect(resultado).toEqual({
        id: "doc-pdf",
        pdfStatus: "PENDENTE",
      });
      expect(mockDb.query.planoDocumento.findFirst).toHaveBeenCalled();
    });

    it("marca PDF como pronto com chave e URL geradas", async () => {
      mockDb.returning.mockResolvedValue([
        { id: "doc-pdf", pdfStatus: "PRONTO" },
      ]);

      await service.marcarPdfPronto("doc-pdf", {
        pdfStorageKey: "pdf/doc-pdf.pdf",
        pdfUrl: "https://cdn.exemplo.com/pdf/doc-pdf.pdf",
      });

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          pdfStorageKey: "pdf/doc-pdf.pdf",
          pdfUrl: "https://cdn.exemplo.com/pdf/doc-pdf.pdf",
          pdfStatus: "PRONTO",
          pdfError: null,
          pdfGeneratedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      );
    });

    it("marca erro de PDF com mensagem truncada", async () => {
      const mensagemLonga = "x".repeat(1200);

      await service.marcarPdfErro("doc-pdf", new Error(mensagemLonga));

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          pdfStatus: "ERRO",
          pdfError: "x".repeat(1000),
          updatedAt: expect.any(Date),
        }),
      );
    });
  });

  describe("regerarPdfDocumento", () => {
    beforeEach(() => {
      mockDb.query.planoDocumento.findFirst.mockReset();
      mockDb.returning.mockReset();
      planoAulaPdfQueueServiceMock.adicionar.mockReset();
      pdfGeneratorServiceMock.gerarParaImpressao.mockReset();
    });

    it("exige documento aprovado", async () => {
      mockDb.query.planoDocumento.findFirst.mockResolvedValue({
        id: "doc-word",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        approvedBy: null,
        approvedAt: null,
        plano: { unitId: "unit-1" },
      });

      await expect(
        service.regerarPdfDocumento(usuarioLogado, "doc-word"),
      ).rejects.toThrow(BadRequestException);

      expect(planoAulaPdfQueueServiceMock.adicionar).not.toHaveBeenCalled();
    });

    it("exige documento Word", async () => {
      mockDb.query.planoDocumento.findFirst.mockResolvedValue({
        id: "doc-pdf",
        mimeType: "application/pdf",
        approvedBy: "analista-1",
        approvedAt: new Date("2026-05-22T10:00:00.000Z"),
        plano: { unitId: "unit-1" },
      });

      await expect(
        service.regerarPdfDocumento(usuarioLogado, "doc-pdf"),
      ).rejects.toThrow(BadRequestException);

      expect(planoAulaPdfQueueServiceMock.adicionar).not.toHaveBeenCalled();
    });

    it("marca PDF como pendente, limpa erro e enfileira sem gerar PDF síncrono", async () => {
      mockDb.query.planoDocumento.findFirst.mockResolvedValue({
        id: "doc-word",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        approvedBy: "analista-1",
        approvedAt: new Date("2026-05-22T10:00:00.000Z"),
        plano: { unitId: "unit-1" },
      });
      mockDb.returning.mockResolvedValue([
        {
          id: "doc-word",
          pdfStatus: "PENDENTE",
          pdfError: null,
        },
      ]);

      const resultado = await service.regerarPdfDocumento(
        usuarioLogado,
        "doc-word",
      );

      expect(pdfGeneratorServiceMock.gerarParaImpressao).not.toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          pdfStatus: "PENDENTE",
          pdfError: null,
          pdfRequestedAt: expect.any(Date),
          pdfGeneratedAt: null,
          pdfStorageKey: null,
          pdfUrl: null,
          updatedAt: expect.any(Date),
        }),
      );
      expect(planoAulaPdfQueueServiceMock.adicionar).toHaveBeenCalledWith(
        "doc-word",
      );
      expect(resultado).toEqual(
        expect.objectContaining({
          id: "doc-word",
          pdfStatus: "PENDENTE",
          pdfError: null,
        }),
      );
    });
  });

  describe("removerDocumento", () => {
    const documentoUpload = {
      id: "doc-1",
      planoId: "plano-1",
      tipo: "ARQUIVO",
      storageKey: "planos/doc-1.docx",
      pdfStorageKey: "planos/doc-1.pdf",
      fileName: "Plano semanal.docx",
      fileSize: 4096,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      approvedBy: null,
      approvedAt: null,
    };
    const planoComAcesso = {
      id: "plano-1",
      unitId: "unit-1",
      status: "RASCUNHO",
      user: { id: "autora-1", name: "Professora Autora" },
      turma: { id: "turma-1", name: "Turma 1", code: "T1", stageId: "stage-1" },
      documentos: [],
    };

    beforeEach(() => {
      jest
        .spyOn(service, "getPlanoById")
        .mockResolvedValue(planoComAcesso as never);
      mockDb.query.planoDocumento.findFirst.mockResolvedValue(documentoUpload);
      mockDb.query.units.findFirst.mockResolvedValue({
        id: "unit-1",
        schoolId: "school-1",
      });
      mockDb.query.users.findFirst.mockResolvedValue({
        id: usuarioLogado.userId,
        name: "Analista Responsável",
      });
      historicoServiceMock.registrar.mockResolvedValue({});
      mockDb.transaction.mockImplementation(async (callback) =>
        callback(mockTx),
      );
      mockTx.returning.mockResolvedValue([documentoUpload]);
    });

    it("mantém no contrato os tipos legados e canônicos de documento", () => {
      const tiposAceitosPeloBanco: DocumentoTipo[] = [
        "ARQUIVO",
        "UPLOAD",
        "LINK_YOUTUBE",
        "YOUTUBE",
      ];

      expect(tiposAceitosPeloBanco).toEqual([
        "ARQUIVO",
        "UPLOAD",
        "LINK_YOUTUBE",
        "YOUTUBE",
      ]);
    });

    it("rejeita motivo inválido antes de consultar o documento", async () => {
      await expect(
        service.removerDocumento(usuarioLogado, "plano-1", "doc-1", "curto"),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "MOTIVO_EXCLUSAO_INVALIDO",
        }),
      });

      expect(service.getPlanoById).not.toHaveBeenCalled();
      expect(mockDb.query.planoDocumento.findFirst).not.toHaveBeenCalled();
    });

    it("bloqueia documento aprovado e não altera banco nem storage", async () => {
      mockDb.query.planoDocumento.findFirst.mockResolvedValue({
        ...documentoUpload,
        approvedBy: "analista-1",
        approvedAt: new Date("2026-05-20T10:00:00.000Z"),
      });

      await expect(
        service.removerDocumento(
          usuarioLogado,
          "plano-1",
          "doc-1",
          "Arquivo enviado incorretamente",
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "DOCUMENTO_APROVADO",
          message: "Este arquivo já foi aprovado e não pode ser excluído.",
        }),
      });

      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(storageServiceMock.deleteFile).not.toHaveBeenCalled();
    });

    it("bloqueia link do YouTube e não altera banco nem storage", async () => {
      mockDb.query.planoDocumento.findFirst.mockResolvedValue({
        ...documentoUpload,
        tipo: "LINK_YOUTUBE",
        storageKey: null,
        pdfStorageKey: null,
        fileName: "Vídeo da aula",
        fileSize: null,
        mimeType: null,
      });

      await expect(
        service.removerDocumento(
          usuarioLogado,
          "plano-1",
          "doc-1",
          "Link não é arquivo enviado",
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "DOCUMENTO_LINK",
          message: "Links do YouTube não podem ser excluídos por esta opção.",
        }),
      });

      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(storageServiceMock.deleteFile).not.toHaveBeenCalled();
    });

    it("rejeita tipo de documento desconhecido com mensagem clara", async () => {
      mockDb.query.planoDocumento.findFirst.mockResolvedValue({
        ...documentoUpload,
        tipo: "ANEXO_LEGADO",
      });

      await expect(
        service.removerDocumento(
          usuarioLogado,
          "plano-1",
          "doc-1",
          "Tipo de documento não é compatível com a exclusão",
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "TIPO_DOCUMENTO_NAO_PERMITIDO",
          message:
            "Este item não é um arquivo enviado e não pode ser excluído por esta opção.",
        }),
      });

      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(storageServiceMock.deleteFile).not.toHaveBeenCalled();
    });

    it("retorna erro claro quando documento não pertence ao plano", async () => {
      mockDb.query.planoDocumento.findFirst.mockResolvedValue(null);

      await expect(
        service.removerDocumento(
          usuarioLogado,
          "plano-1",
          "doc-fora-do-plano",
          "Documento foi anexado no plano errado",
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "DOCUMENTO_NAO_ENCONTRADO",
          message:
            "Este arquivo não foi encontrado. Atualize a página e tente novamente.",
        }),
      });

      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(storageServiceMock.deleteFile).not.toHaveBeenCalled();
    });

    it("bloqueia usuário sem acesso antes de localizar ou excluir o documento", async () => {
      jest
        .spyOn(service, "getPlanoById")
        .mockRejectedValueOnce(
          new ForbiddenException(
            "Você não tem permissão para acessar este plano",
          ),
        );

      await expect(
        service.removerDocumento(
          usuarioLogado,
          "plano-fora-da-unidade",
          "doc-1",
          "Tentativa de exclusão sem acesso",
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(mockDb.query.planoDocumento.findFirst).not.toHaveBeenCalled();
      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(storageServiceMock.deleteFile).not.toHaveBeenCalled();
    });

    it("bloqueia proprietário que está fora da unidade da sessão", async () => {
      const proprietariaForaDaUnidade = {
        ...usuarioLogado,
        userId: "autora-1",
        role: "professora",
      };
      jest.spyOn(service, "getPlanoById").mockResolvedValueOnce({
        ...planoComAcesso,
        unitId: "unit-2",
        user: {
          id: proprietariaForaDaUnidade.userId,
          name: "Professora Autora",
        },
      } as never);

      await expect(
        service.removerDocumento(
          proprietariaForaDaUnidade,
          "plano-fora-da-unidade",
          "doc-1",
          "Tentativa de exclusão fora da unidade",
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "PERMISSAO_EXCLUSAO_DOCUMENTO",
          message: "Você não tem permissão para excluir este arquivo.",
        }),
      });

      expect(mockDb.query.planoDocumento.findFirst).not.toHaveBeenCalled();
      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(storageServiceMock.deleteFile).not.toHaveBeenCalled();
    });

    it("não expõe detalhes técnicos quando a validação de acesso falha inesperadamente", async () => {
      jest
        .spyOn(service, "getPlanoById")
        .mockRejectedValueOnce(new Error("falha técnica ao consultar o plano"));

      const erro = await service
        .removerDocumento(
          usuarioLogado,
          "plano-1",
          "doc-1",
          "Falha inesperada durante a validação",
        )
        .catch((erro: unknown) => erro);

      expect(erro).toMatchObject({
        response: expect.objectContaining({
          code: "FALHA_EXCLUSAO_DOCUMENTO",
          message:
            "Não foi possível excluir o arquivo agora. Tente novamente. Se o problema continuar, procure o suporte.",
        }),
      });
      expect(erro).not.toHaveProperty(
        "message",
        expect.stringContaining("falha técnica ao consultar o plano"),
      );
    });

    it("não expõe detalhes técnicos quando a busca do documento falha inesperadamente", async () => {
      mockDb.query.planoDocumento.findFirst.mockRejectedValueOnce(
        new Error("falha técnica ao consultar o documento"),
      );

      const erro = await service
        .removerDocumento(
          usuarioLogado,
          "plano-1",
          "doc-1",
          "Falha inesperada durante a busca",
        )
        .catch((erro: unknown) => erro);

      expect(erro).toMatchObject({
        response: expect.objectContaining({
          code: "FALHA_EXCLUSAO_DOCUMENTO",
          message:
            "Não foi possível excluir o arquivo agora. Tente novamente. Se o problema continuar, procure o suporte.",
        }),
      });
      expect(erro).not.toHaveProperty(
        "message",
        expect.stringContaining("falha técnica ao consultar o documento"),
      );
    });

    it("não expõe detalhes técnicos quando a identificação do usuário falha inesperadamente", async () => {
      mockDb.query.users.findFirst.mockRejectedValueOnce(
        new Error("falha técnica ao consultar o usuário"),
      );

      const erro = await service
        .removerDocumento(
          usuarioLogado,
          "plano-1",
          "doc-1",
          "Falha inesperada durante a identificação",
        )
        .catch((erro: unknown) => erro);

      expect(erro).toMatchObject({
        response: expect.objectContaining({
          code: "FALHA_EXCLUSAO_DOCUMENTO",
          message:
            "Não foi possível excluir o arquivo agora. Tente novamente. Se o problema continuar, procure o suporte.",
        }),
      });
      expect(erro).not.toHaveProperty(
        "message",
        expect.stringContaining("falha técnica ao consultar o usuário"),
      );
    });

    it("remove documento, comentários e arquivos, registrando histórico com metadados", async () => {
      const resultado = await service.removerDocumento(
        usuarioLogado,
        "plano-1",
        "doc-1",
        "Arquivo enviado com conteúdo incorreto",
      );

      expect(resultado).toBeUndefined();
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.delete).toHaveBeenCalledTimes(2);
      expect(historicoServiceMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          planoId: "plano-1",
          userId: usuarioLogado.userId,
          userName: "Analista Responsável",
          userRole: usuarioLogado.role,
          acao: "DOCUMENTO_EXCLUIDO",
          statusAnterior: "RASCUNHO",
          statusNovo: "RASCUNHO",
          detalhes: {
            documentoId: "doc-1",
            documentoNome: "Plano semanal.docx",
            documentoTipo: "ARQUIVO",
            tamanhoBytes: 4096,
            motivo: "Arquivo enviado com conteúdo incorreto",
          },
        }),
        mockTx,
      );
      expect(storageServiceMock.deleteFile).toHaveBeenCalledWith(
        "planos/doc-1.docx",
      );
      expect(storageServiceMock.deleteFile).toHaveBeenCalledWith(
        "planos/doc-1.pdf",
      );
      expect(sharePointServiceMock.removerArquivo).not.toHaveBeenCalled();
    });

    it("limpa as chaves e o SharePoint retornados pelo DELETE", async () => {
      mockDb.query.planoDocumento.findFirst.mockResolvedValue({
        ...documentoUpload,
        storageKey: "planos/doc-1-antigo.docx",
        pdfStorageKey: "planos/doc-1-antigo.pdf",
        sharepointItemId: "item-sharepoint-antigo",
      });
      mockTx.returning.mockResolvedValueOnce([
        {
          ...documentoUpload,
          storageKey: "planos/doc-1-atualizado.docx",
          pdfStorageKey: "planos/doc-1-atualizado.pdf",
          sharepointItemId: "item-sharepoint-atualizado",
        },
      ]);

      await service.removerDocumento(
        usuarioLogado,
        "plano-1",
        "doc-1",
        "Arquivo atualizado durante a exclusão",
      );

      expect(storageServiceMock.deleteFile).toHaveBeenCalledWith(
        "planos/doc-1-atualizado.docx",
      );
      expect(storageServiceMock.deleteFile).not.toHaveBeenCalledWith(
        "planos/doc-1-antigo.docx",
      );
      expect(sharePointServiceMock.removerArquivo).toHaveBeenCalledWith(
        "item-sharepoint-atualizado",
      );
    });

    it("tenta remover item ativo do SharePoint sem bloquear a exclusão local", async () => {
      mockDb.query.planoDocumento.findFirst.mockResolvedValue({
        ...documentoUpload,
        sharepointItemId: "item-sharepoint-1",
      });
      mockTx.returning.mockResolvedValueOnce([
        { ...documentoUpload, sharepointItemId: "item-sharepoint-1" },
      ]);
      sharePointServiceMock.removerArquivo.mockRejectedValueOnce(
        new Error("SharePoint indisponível"),
      );

      await expect(
        service.removerDocumento(
          usuarioLogado,
          "plano-1",
          "doc-1",
          "Arquivo não deve mais ser utilizado",
        ),
      ).resolves.toBeUndefined();

      expect(sharePointServiceMock.removerArquivo).toHaveBeenCalledWith(
        "item-sharepoint-1",
      );
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(storageServiceMock.deleteFile).toHaveBeenCalled();
    });

    it.each(["ARQUIVO", "UPLOAD"] as const)(
      "remove upload %s mesmo sem storageKey quando existe PDF derivado",
      async (tipo) => {
        mockDb.query.planoDocumento.findFirst.mockResolvedValue({
          ...documentoUpload,
          tipo,
          storageKey: null,
          pdfStorageKey: "planos/doc-1.pdf",
        });
        mockTx.returning.mockResolvedValueOnce([
          {
            ...documentoUpload,
            tipo,
            storageKey: null,
            pdfStorageKey: "planos/doc-1.pdf",
          },
        ]);

        await expect(
          service.removerDocumento(
            usuarioLogado,
            "plano-1",
            "doc-1",
            "Arquivo original indisponível, remover registro",
          ),
        ).resolves.toBeUndefined();

        expect(storageServiceMock.deleteFile).toHaveBeenCalledTimes(1);
        expect(storageServiceMock.deleteFile).toHaveBeenCalledWith(
          "planos/doc-1.pdf",
        );
        expect(historicoServiceMock.registrar).toHaveBeenCalledWith(
          expect.objectContaining({
            detalhes: expect.objectContaining({ documentoTipo: tipo }),
          }),
          mockTx,
        );
      },
    );

    it("retorna erro de documento aprovado quando a aprovação ocorre antes do DELETE", async () => {
      mockTx.returning.mockResolvedValueOnce([]);
      mockTx.query.planoDocumento.findFirst.mockResolvedValue({
        ...documentoUpload,
        approvedBy: "analista-2",
        approvedAt: new Date("2026-06-01T12:00:00.000Z"),
      });

      await expect(
        service.removerDocumento(
          usuarioLogado,
          "plano-1",
          "doc-1",
          "Arquivo aprovado durante a tentativa de exclusão",
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "DOCUMENTO_APROVADO",
          message: "Este arquivo já foi aprovado e não pode ser excluído.",
        }),
      });

      expect(mockTx.returning).toHaveBeenCalledTimes(1);
      expect(isNull).toHaveBeenNthCalledWith(1, "planoDocumento.approvedBy");
      expect(isNull).toHaveBeenNthCalledWith(2, "planoDocumento.approvedAt");
      // O histórico é tentado antes do DELETE, mas a transação é revertida
      // quando a aprovação concorrente é detectada.
      expect(historicoServiceMock.registrar).toHaveBeenCalled();
      expect(mockTx.delete).toHaveBeenCalledTimes(1);
      expect(storageServiceMock.deleteFile).not.toHaveBeenCalled();
    });

    it("não expõe detalhes quando a transação falha inesperadamente", async () => {
      mockDb.transaction.mockRejectedValueOnce(
        new Error("detalhe interno que não deve chegar ao usuário"),
      );

      const erro = await service
        .removerDocumento(
          usuarioLogado,
          "plano-1",
          "doc-1",
          "Falha inesperada durante a exclusão",
        )
        .catch((erro: unknown) => erro);

      expect(erro).toMatchObject({
        response: expect.objectContaining({
          code: "FALHA_EXCLUSAO_DOCUMENTO",
          message:
            "Não foi possível excluir o arquivo agora. Tente novamente. Se o problema continuar, procure o suporte.",
        }),
      });
      expect(erro).not.toHaveProperty(
        "message",
        expect.stringContaining(
          "detalhe interno que não deve chegar ao usuário",
        ),
      );
    });

    it("não limpa storage nem SharePoint quando o histórico faz a transação falhar", async () => {
      historicoServiceMock.registrar.mockRejectedValueOnce(
        new Error("falha ao registrar histórico"),
      );
      mockDb.query.planoDocumento.findFirst.mockResolvedValue({
        ...documentoUpload,
        sharepointItemId: "item-sharepoint-2",
      });

      await expect(
        service.removerDocumento(
          usuarioLogado,
          "plano-1",
          "doc-1",
          "Exclusão não deve ser concluída sem histórico",
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "FALHA_EXCLUSAO_DOCUMENTO",
        }),
      });

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(historicoServiceMock.registrar).toHaveBeenCalled();
      const transacao = mockDb.transaction.mock.results[0]?.value as
        | Promise<unknown>
        | undefined;
      await expect(transacao).rejects.toThrow("falha ao registrar histórico");
      expect(mockTx.delete).not.toHaveBeenCalled();
      expect(storageServiceMock.deleteFile).not.toHaveBeenCalled();
      expect(sharePointServiceMock.removerArquivo).not.toHaveBeenCalled();
    });

    it("conclui a exclusão mesmo quando a remoção no storage falha", async () => {
      storageServiceMock.deleteFile.mockRejectedValue(
        new Error("Storage indisponível"),
      );

      await expect(
        service.removerDocumento(
          usuarioLogado,
          "plano-1",
          "doc-1",
          "Arquivo não deve mais ser utilizado",
        ),
      ).resolves.toBeUndefined();

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.delete).toHaveBeenCalledTimes(2);
    });

    it("bloqueia coordenadora ao excluir plano fora do seu segmento", async () => {
      const coordenadoraInfantil = {
        ...usuarioLogado,
        role: "coordenadora_infantil",
        stageId: "stage-infantil",
      };
      mockDb.query.turmas.findFirst.mockResolvedValue({
        id: "turma-1",
        stage: { code: "FUNDAMENTAL_I" },
      });

      await expect(
        service.removerDocumento(
          coordenadoraInfantil,
          "plano-1",
          "doc-1",
          "Arquivo não pertence ao segmento da coordenadora",
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "PERMISSAO_EXCLUSAO_DOCUMENTO",
        }),
      });

      expect(mockDb.query.planoDocumento.findFirst).not.toHaveBeenCalled();
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("permite coordenadora ao excluir plano do seu segmento", async () => {
      const coordenadoraInfantil = {
        ...usuarioLogado,
        role: "coordenadora_infantil",
        stageId: "stage-infantil",
      };
      mockDb.query.turmas.findFirst.mockResolvedValue({
        id: "turma-1",
        stage: { code: "INFANTIL" },
      });

      await expect(
        service.removerDocumento(
          coordenadoraInfantil,
          "plano-1",
          "doc-1",
          "Arquivo precisa ser substituído",
        ),
      ).resolves.toBeUndefined();

      expect(mockDb.query.turmas.findFirst).toHaveBeenCalled();
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it("permite master global ao excluir documento", async () => {
      const master = {
        userId: "master-1",
        role: "master",
        schoolId: null,
        unitId: null,
        stageId: null,
      };

      await expect(
        service.removerDocumento(
          master,
          "plano-1",
          "doc-1",
          "Arquivo removido pela administração global",
        ),
      ).resolves.toBeUndefined();

      expect(mockDb.query.units.findFirst).not.toHaveBeenCalled();
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it("permite diretora geral ao excluir documento de outra unidade da mesma escola", async () => {
      const diretora = {
        userId: "diretora-1",
        role: "diretora_geral",
        schoolId: "school-1",
        unitId: null,
        stageId: null,
      };
      jest.spyOn(service, "getPlanoById").mockResolvedValueOnce({
        ...planoComAcesso,
        unitId: "unit-2",
      } as never);
      mockDb.query.units.findFirst.mockResolvedValue({
        id: "unit-2",
        schoolId: "school-1",
      });

      await expect(
        service.removerDocumento(
          diretora,
          "plano-1",
          "doc-1",
          "Arquivo removido pela direção da escola",
        ),
      ).resolves.toBeUndefined();

      expect(mockDb.query.units.findFirst).toHaveBeenCalled();
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe("acesso ao plano por escopo", () => {
    const planoDeOutraUnidade = {
      id: "plano-outra-unidade",
      userId: "professora-outra",
      turmaId: "turma-outra",
      unitId: "unit-2",
      status: "RASCUNHO",
      user: { id: "professora-outra", name: "Professora de outra unidade" },
      turma: {
        id: "turma-outra",
        name: "Turma da outra unidade",
        code: "T2",
        stageId: "stage-2",
      },
      documentos: [],
    };

    it("permite que master consulte plano de qualquer escola sem unidade na sessão", async () => {
      mockDb.query.planoAula.findFirst.mockResolvedValue(planoDeOutraUnidade);

      await expect(
        service.getPlanoById(
          {
            userId: "master-1",
            role: "master",
            schoolId: null,
            unitId: null,
            stageId: null,
          },
          planoDeOutraUnidade.id,
        ),
      ).resolves.toEqual(
        expect.objectContaining({ id: planoDeOutraUnidade.id }),
      );

      expect(mockDb.query.units.findFirst).not.toHaveBeenCalled();
    });

    it("permite que diretora geral consulte plano de outra unidade da mesma escola", async () => {
      mockDb.query.planoAula.findFirst.mockResolvedValue(planoDeOutraUnidade);
      mockDb.query.units.findFirst.mockResolvedValue({
        id: "unit-2",
        schoolId: "school-1",
      });

      await expect(
        service.getPlanoById(
          {
            userId: "diretora-1",
            role: "diretora_geral",
            schoolId: "school-1",
            unitId: null,
            stageId: null,
          },
          planoDeOutraUnidade.id,
        ),
      ).resolves.toEqual(
        expect.objectContaining({ id: planoDeOutraUnidade.id }),
      );
    });

    it("bloqueia diretora geral ao consultar plano de escola diferente", async () => {
      mockDb.query.planoAula.findFirst.mockResolvedValue(planoDeOutraUnidade);
      mockDb.query.units.findFirst.mockResolvedValue(null);

      await expect(
        service.getPlanoById(
          {
            userId: "diretora-1",
            role: "diretora_geral",
            schoolId: "school-diferente",
            unitId: null,
            stageId: null,
          },
          planoDeOutraUnidade.id,
        ),
      ).rejects.toThrow(ForbiddenException);
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
