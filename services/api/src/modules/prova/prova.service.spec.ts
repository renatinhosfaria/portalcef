import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { PdfGeneratorService } from "../../common/sharepoint/pdf-generator.service";
import { SharePointService } from "../../common/sharepoint/sharepoint.service";
import { StorageService } from "../../common/storage/storage.service";
import { ProvaHistoricoService } from "./prova-historico.service";
import { ProvaService } from "./prova.service";

const mockTx = {
  query: {
    provaDocumento: {
      findFirst: jest.fn(),
    },
  },
  delete: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  returning: jest.fn(),
};

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
    units: {
      findFirst: jest.fn(),
    },
    turmas: {
      findFirst: jest.fn(),
    },
  },
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  transaction: jest.fn(),
};

jest.mock("@essencia/db", () => ({
  getDb: jest.fn(() => mockDb),
  and: jest.fn(),
  eq: jest.fn(),
  isNull: jest.fn(),
  desc: jest.fn(),
  gte: jest.fn(),
  lte: jest.fn(),
  inArray: jest.fn(),
  isNotNull: jest.fn(),
  prova: {},
  provaDocumento: {},
  provaCiclo: {},
  turmas: {},
  units: {},
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
  const storageServiceMock = {
    deleteFile: jest.fn(),
  };
  const sharePointServiceMock = {
    removerArquivo: jest.fn(),
  };

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
        {
          provide: SharePointService,
          useValue: sharePointServiceMock,
        },
      ],
    }).compile();

    service = module.get<ProvaService>(ProvaService);
    jest.clearAllMocks();
    mockDb.transaction.mockImplementation(
      async (callback: (tx: typeof mockTx) => Promise<unknown>) =>
        callback(mockTx),
    );
    mockDb.query.units.findFirst.mockResolvedValue({
      id: "unit-1",
      schoolId: "school-1",
    });
    mockTx.returning.mockResolvedValue([
      {
        id: "doc-1",
      },
    ]);
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

  describe("removerDocumento", () => {
    const usuarioAnalista = {
      userId: "analista-1",
      role: "analista_pedagogico",
      schoolId: "school-1",
      unitId: "unit-1",
      stageId: null,
    };

    const provaComAcesso = {
      id: "prova-1",
      userId: "prof-1",
      turmaId: "turma-1",
      unitId: "unit-1",
      status: "RASCUNHO",
      user: { id: "prof-1", name: "Professora" },
      turma: { id: "turma-1", name: "Turma 1", code: "T1" },
      documentos: [],
    };

    const documentoUpload = {
      id: "doc-1",
      provaId: "prova-1",
      tipo: "UPLOAD",
      storageKey: "provas/doc-1.docx",
      pdfStorageKey: "provas/doc-1.pdf",
      fileName: "Prova.docx",
      fileSize: 4096,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sharepointItemId: null,
      approvedBy: null,
      approvedAt: null,
    };

    beforeEach(() => {
      mockDb.query.prova.findFirst.mockResolvedValue(provaComAcesso);
      mockDb.query.provaDocumento.findFirst.mockResolvedValue(documentoUpload);
      mockDb.query.users.findFirst.mockResolvedValue({
        name: "Analista Responsável",
      });
      historicoServiceMock.registrar.mockResolvedValue(undefined);
    });

    const executarRemocao = (
      user: {
        userId: string;
        role: string;
        schoolId: string | null;
        unitId: string | null;
        stageId: string | null;
      },
      provaId: string,
      documentoId: string,
      motivo: string,
    ) =>
      (service.removerDocumento as unknown as (
        user: {
          userId: string;
          role: string;
          schoolId: string | null;
          unitId: string | null;
          stageId: string | null;
        },
        provaId: string,
        documentoId: string,
        motivo: string,
      ) => Promise<void>)(user, provaId, documentoId, motivo);

    it("rejeita motivo inválido antes de consultar a prova", async () => {
      const removerDocumento = service.removerDocumento.bind(service) as unknown as (
        user: typeof usuarioAnalista,
        provaId: string,
        documentoId: string,
        motivo: string,
      ) => Promise<void>;

      await expect(
        removerDocumento(usuarioAnalista, "prova-1", "doc-1", "curto"),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "MOTIVO_EXCLUSAO_INVALIDO",
          message: "Informe o motivo da exclusão com pelo menos 10 caracteres.",
        }),
      });

      expect(mockDb.query.prova.findFirst).not.toHaveBeenCalled();
    });

    it("bloqueia documento aprovado", async () => {
      mockDb.query.provaDocumento.findFirst.mockResolvedValue({
        ...documentoUpload,
        approvedBy: "analista-2",
        approvedAt: new Date("2026-06-18T11:00:00.000Z"),
      });

      await expect(
        executarRemocao(
          usuarioAnalista,
          "prova-1",
          "doc-1",
          "Arquivo já foi aprovado",
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

    it.each(["LINK_YOUTUBE", "YOUTUBE"])(
      "bloqueia link do YouTube do tipo %s",
      async (tipo) => {
        mockDb.query.provaDocumento.findFirst.mockResolvedValue({
          ...documentoUpload,
          tipo,
          storageKey: null,
          pdfStorageKey: null,
          fileName: "Vídeo da prova",
          fileSize: null,
        });

        await expect(
          executarRemocao(
            usuarioAnalista,
            "prova-1",
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
      },
    );

    it("bloqueia tipo de documento desconhecido com mensagem clara", async () => {
      mockDb.query.provaDocumento.findFirst.mockResolvedValue({
        ...documentoUpload,
        tipo: "ANEXO_LEGADO",
      });

      await expect(
        executarRemocao(
          usuarioAnalista,
          "prova-1",
          "doc-1",
          "Tipo de documento não é compatível",
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

    it("permite excluir upload do tipo ARQUIVO", async () => {
      mockDb.query.provaDocumento.findFirst.mockResolvedValue({
        ...documentoUpload,
        tipo: "ARQUIVO",
      });

      await expect(
        executarRemocao(
          usuarioAnalista,
          "prova-1",
          "doc-1",
          "Arquivo enviado com conteúdo incorreto",
        ),
      ).resolves.toBeUndefined();

      expect(historicoServiceMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: "DOCUMENTO_EXCLUIDO",
          detalhes: expect.objectContaining({ documentoTipo: "ARQUIVO" }),
        }),
        mockTx,
      );
      expect(storageServiceMock.deleteFile).toHaveBeenCalledWith(
        "provas/doc-1.docx",
      );
    });

    it("retorna erro claro para documento fora da prova", async () => {
      mockDb.query.provaDocumento.findFirst.mockResolvedValue(null);

      await expect(
        executarRemocao(
          usuarioAnalista,
          "prova-1",
          "doc-fora-da-prova",
          "Documento está em outra prova",
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

    it("bloqueia usuário sem acesso à prova", async () => {
      mockDb.query.prova.findFirst.mockResolvedValue({
        ...provaComAcesso,
        unitId: "unit-2",
      });

      await expect(
        executarRemocao(
          usuarioAnalista,
          "prova-fora-da-unidade",
          "doc-1",
          "Tentativa de exclusão sem acesso",
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "PERMISSAO_EXCLUSAO_DOCUMENTO",
          message: "Você não tem permissão para excluir este arquivo.",
        }),
      });

      expect(mockDb.query.provaDocumento.findFirst).not.toHaveBeenCalled();
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("remove documento e registra histórico com ator e motivo", async () => {
      await expect(
        executarRemocao(
          usuarioAnalista,
          "prova-1",
          "doc-1",
          "Arquivo enviado com conteúdo incorreto",
        ),
      ).resolves.toBeUndefined();

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.delete).toHaveBeenCalledWith(expect.anything());
      expect(historicoServiceMock.registrar).toHaveBeenCalledWith(
        {
          provaId: "prova-1",
          userId: "analista-1",
          userName: "Analista Responsável",
          userRole: "analista_pedagogico",
          acao: "DOCUMENTO_EXCLUIDO",
          statusAnterior: null,
          statusNovo: "RASCUNHO",
          detalhes: {
            documentoId: "doc-1",
            documentoNome: "Prova.docx",
            documentoTipo: "UPLOAD",
            tamanhoBytes: 4096,
            motivo: "Arquivo enviado com conteúdo incorreto",
          },
        },
        mockTx,
      );
      expect(storageServiceMock.deleteFile).toHaveBeenCalledWith(
        "provas/doc-1.docx",
      );
      expect(storageServiceMock.deleteFile).toHaveBeenCalledWith(
        "provas/doc-1.pdf",
      );
    });

    it("remove item do SharePoint sem impedir a exclusão local", async () => {
      mockDb.query.provaDocumento.findFirst.mockResolvedValue({
        ...documentoUpload,
        sharepointItemId: "item-sharepoint-1",
      });
      sharePointServiceMock.removerArquivo.mockRejectedValueOnce(
        new Error("SharePoint indisponível"),
      );

      await expect(
        executarRemocao(
          usuarioAnalista,
          "prova-1",
          "doc-1",
          "Arquivo não deve mais ser utilizado",
        ),
      ).resolves.toBeUndefined();

      expect(sharePointServiceMock.removerArquivo).toHaveBeenCalledWith(
        "item-sharepoint-1",
      );
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it("impede aprovação concorrente durante a transação", async () => {
      mockTx.returning.mockResolvedValueOnce([]);
      mockTx.query.provaDocumento.findFirst.mockResolvedValue({
        ...documentoUpload,
        approvedBy: "analista-2",
        approvedAt: new Date("2026-06-18T11:00:00.000Z"),
      });

      await expect(
        executarRemocao(
          usuarioAnalista,
          "prova-1",
          "doc-1",
          "Arquivo aprovado durante a tentativa",
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "DOCUMENTO_APROVADO" }),
      });

      expect(storageServiceMock.deleteFile).not.toHaveBeenCalled();
    });

    it("não expõe detalhes técnicos quando a transação falha", async () => {
      mockDb.transaction.mockRejectedValueOnce(
        new Error("detalhe interno que não deve chegar ao usuário"),
      );

      const erro = await executarRemocao(
          usuarioAnalista,
          "prova-1",
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
      expect(storageServiceMock.deleteFile).not.toHaveBeenCalled();
    });

    it("permite master global e diretora geral na mesma escola", async () => {
      const master = {
        userId: "master-1",
        role: "master",
        schoolId: null,
        unitId: null,
        stageId: null,
      };
      await expect(
        executarRemocao(
          master,
          "prova-1",
          "doc-1",
          "Arquivo removido pela administração global",
        ),
      ).resolves.toBeUndefined();

      jest.clearAllMocks();
      mockDb.transaction.mockImplementation(
        async (callback: (tx: typeof mockTx) => Promise<unknown>) =>
          callback(mockTx),
      );
      mockDb.query.prova.findFirst.mockResolvedValue({
        ...provaComAcesso,
        unitId: "unit-2",
      });
      mockDb.query.provaDocumento.findFirst.mockResolvedValue(documentoUpload);
      mockDb.query.users.findFirst.mockResolvedValue({ name: "Diretora" });
      mockDb.query.units.findFirst.mockResolvedValue({
        id: "unit-2",
        schoolId: "school-1",
      });
      mockTx.returning.mockResolvedValue([{ id: "doc-1" }]);

      await expect(
        executarRemocao(
          {
            userId: "diretora-1",
            role: "diretora_geral",
            schoolId: "school-1",
            unitId: null,
            stageId: null,
          },
          "prova-1",
          "doc-1",
          "Arquivo removido pela diretora da escola",
        ),
      ).resolves.toBeUndefined();

      expect(mockDb.query.units.findFirst).toHaveBeenCalled();
    });

    it("bloqueia coordenadora quando a turma está fora do seu segmento", async () => {
      mockDb.query.turmas.findFirst.mockResolvedValue({
        id: "turma-1",
        stage: { code: "FUNDAMENTAL_I" },
      });

      await expect(
        executarRemocao(
          {
            userId: "coordenadora-1",
            role: "coordenadora_infantil",
            schoolId: "school-1",
            unitId: "unit-1",
            stageId: "stage-infantil",
          },
          "prova-1",
          "doc-1",
          "Documento fora do segmento da coordenadora",
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "PERMISSAO_EXCLUSAO_DOCUMENTO",
          message: "Você não tem permissão para excluir este arquivo.",
        }),
      });

      expect(mockDb.query.provaDocumento.findFirst).not.toHaveBeenCalled();
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("permite coordenadora quando a turma está no seu segmento", async () => {
      mockDb.query.turmas.findFirst.mockResolvedValue({
        id: "turma-1",
        stage: { code: "INFANTIL" },
      });

      await expect(
        executarRemocao(
          {
            userId: "coordenadora-1",
            role: "coordenadora_infantil",
            schoolId: "school-1",
            unitId: "unit-1",
            stageId: "stage-infantil",
          },
          "prova-1",
          "doc-1",
          "Arquivo precisa ser substituído",
        ),
      ).resolves.toBeUndefined();

      expect(mockDb.query.turmas.findFirst).toHaveBeenCalled();
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["professora", "prof-1"],
      ["auxiliar_sala", "prof-1"],
    ])("permite %s autora na própria unidade", async (role, userId) => {
      await expect(
        executarRemocao(
          {
            userId,
            role,
            schoolId: "school-1",
            unitId: "unit-1",
            stageId: null,
          },
          "prova-1",
          "doc-1",
          "Arquivo precisa ser substituído",
        ),
      ).resolves.toBeUndefined();

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it.each(["gerente_unidade", "gerente_financeiro", "coordenadora_geral"])(
      "permite %s na própria unidade",
      async (role) => {
        await expect(
          executarRemocao(
            {
              userId: `${role}-1`,
              role,
              schoolId: "school-1",
              unitId: "unit-1",
              stageId: null,
            },
            "prova-1",
            "doc-1",
            "Arquivo precisa ser substituído",
          ),
        ).resolves.toBeUndefined();

        expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      },
    );

    it("bloqueia autora que mudou para outra unidade", async () => {
      await expect(
        executarRemocao(
          {
            userId: "prof-1",
            role: "professora",
            schoolId: "school-1",
            unitId: "unit-2",
            stageId: null,
          },
          "prova-1",
          "doc-1",
          "Tentativa de exclusão fora da unidade",
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "PERMISSAO_EXCLUSAO_DOCUMENTO",
        }),
      });

      expect(mockDb.query.provaDocumento.findFirst).not.toHaveBeenCalled();
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("bloqueia diretora de outra escola", async () => {
      mockDb.query.units.findFirst.mockResolvedValue(null);

      await expect(
        executarRemocao(
          {
            userId: "diretora-2",
            role: "diretora_geral",
            schoolId: "school-2",
            unitId: null,
            stageId: null,
          },
          "prova-1",
          "doc-1",
          "Tentativa de exclusão em outra escola",
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "PERMISSAO_EXCLUSAO_DOCUMENTO",
        }),
      });

      expect(mockDb.query.provaDocumento.findFirst).not.toHaveBeenCalled();
      expect(mockDb.transaction).not.toHaveBeenCalled();
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
