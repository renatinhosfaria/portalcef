// services/api/src/modules/relatorio/relatorio.service.spec.ts

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";

const mockTurmaQueryBuilder = (etapaCode: string) => ({
  from: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  where: jest
    .fn()
    .mockResolvedValue([{ turmaId: "t-1", stageId: "s-1", etapaCode }]),
});

const mockEmptyTurmaQuery = () => ({
  from: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([]),
});

const mockDb = {
  select: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  delete: jest.fn().mockReturnThis(),
  transaction: jest.fn(),
  query: {
    relatorio: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    relatorioDocumento: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    turmas: {
      findFirst: jest.fn(),
    },
    users: {
      findFirst: jest.fn(),
    },
    units: {
      findFirst: jest.fn(),
    },
  },
};

const mockTx = {
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  delete: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  query: {
    relatorioDocumento: {
      findFirst: jest.fn(),
    },
  },
};

jest.mock("@essencia/db", () => ({
  getDb: jest.fn(() => mockDb),
  eq: jest.fn((a, b) => ({ eq: [a, b] })),
  and: jest.fn((...args) => ({ and: args })),
  or: jest.fn((...args) => ({ or: args })),
  desc: jest.fn((c) => c),
  ne: jest.fn(),
  inArray: jest.fn(),
  isNotNull: jest.fn(),
  isNull: jest.fn(),
  relatorio: {
    id: "id",
    userId: "userId",
    turmaId: "turmaId",
    unitId: "unitId",
    semestreId: "semestreId",
    status: "status",
    semestreRelatorioId: "semestreRelatorioId",
  },
  relatorioDocumento: {
    id: "id",
    relatorioId: "relatorioId",
    pdfStatus: "pdfStatus",
    storageKey: "storageKey",
    approvedAt: "approvedAt",
    approvedBy: "approvedBy",
  },
  turmas: {
    id: "id",
    unitId: "unitId",
    stageId: "stageId",
  },
  educationStages: {
    id: "id",
    code: "code",
  },
  users: { id: "id", name: "name" },
  units: { id: "id", schoolId: "schoolId" },
}));

import { RelatorioService } from "./relatorio.service";
import type { RelatorioHistoricoService } from "./relatorio-historico.service";
import type { StorageService } from "../../common/storage/storage.service";
import type { RelatorioPdfQueueService } from "./relatorio-pdf-queue.service";
import type { SharePointService } from "../../common/sharepoint/sharepoint.service";

describe("RelatorioService", () => {
  type SessaoTeste = {
    userId: string;
    role: string;
    unitId: string | null;
    schoolId: string | null;
    stageId: string | null;
  };

  let service: RelatorioService;
  let mockHistorico: jest.Mocked<RelatorioHistoricoService>;
  let mockStorage: jest.Mocked<StorageService>;
  let mockQueue: jest.Mocked<RelatorioPdfQueueService>;
  let mockSharePoint: jest.Mocked<SharePointService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockHistorico = {
      registrar: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<RelatorioHistoricoService>;

    mockStorage = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
      uploadFile: jest.fn(),
      getPresignedUrl: jest.fn(),
    } as unknown as jest.Mocked<StorageService>;

    mockSharePoint = {
      removerArquivo: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SharePointService>;

    mockQueue = {
      adicionar: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RelatorioPdfQueueService>;

    mockDb.select.mockReset();
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.delete.mockReturnThis();
    mockDb.returning.mockReset();
    mockDb.query.relatorio.findFirst.mockReset();
    mockDb.query.relatorio.findMany.mockReset();
    mockDb.query.relatorioDocumento.findFirst.mockReset();
    mockDb.query.relatorioDocumento.findMany.mockReset();
    mockDb.query.turmas.findFirst.mockReset();
    mockDb.query.users.findFirst.mockReset();
    mockDb.query.units.findFirst.mockReset();
    mockTx.returning.mockReset();
    mockTx.returning.mockResolvedValue([{ id: "doc-1" }]);
    mockTx.query.relatorioDocumento.findFirst.mockReset();
    mockTx.query.relatorioDocumento.findFirst.mockResolvedValue(null);
    mockDb.transaction = jest.fn(
      async (callback: (tx: typeof mockTx) => Promise<unknown>) =>
        callback(mockTx),
    );

    const RelatorioServiceComArgs = RelatorioService as unknown as new (
      ...args: unknown[]
    ) => RelatorioService;
    service = new RelatorioServiceComArgs(
      mockHistorico,
      mockStorage,
      mockQueue,
      mockSharePoint,
    );
  });

  describe("criar", () => {
    const session: SessaoTeste = {
      userId: "u-1",
      role: "professora",
      unitId: "unit-1",
      schoolId: "school-1",
      stageId: null,
    };

    it("rejeita turma de etapa FUNDAMENTAL_I", async () => {
      mockDb.select.mockReturnValueOnce(mockTurmaQueryBuilder("FUNDAMENTAL_I"));

      await expect(
        service.criar({ turmaId: "t-1", semestreId: "s-1" }, session),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejeita quando unitId não está na sessão", async () => {
      await expect(
        service.criar(
          { turmaId: "t-1", semestreId: "s-1" },
          { ...session, unitId: null },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejeita quando turma não pertence à unidade", async () => {
      mockDb.select.mockReturnValueOnce(mockEmptyTurmaQuery());

      await expect(
        service.criar({ turmaId: "t-1", semestreId: "s-1" }, session),
      ).rejects.toThrow();
    });

    it("aceita turma de etapa BERCARIO e cria novo relatório", async () => {
      mockDb.select.mockReturnValueOnce(mockTurmaQueryBuilder("BERCARIO"));
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce(null);
      mockDb.returning.mockResolvedValueOnce([
        {
          id: "r-1",
          userId: "u-1",
          turmaId: "t-1",
          unitId: "unit-1",
          semestreId: "s-1",
          status: "RASCUNHO",
        },
      ]);
      mockDb.query.users.findFirst.mockResolvedValueOnce({
        name: "Professora",
      });

      const result = await service.criar(
        { turmaId: "t-1", semestreId: "s-1" },
        session,
      );

      expect(result.status).toBe("RASCUNHO");
      expect(mockHistorico.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ acao: "CRIADO" }),
      );
    });

    it("aceita turma de etapa INFANTIL e retorna existente", async () => {
      mockDb.select.mockReturnValueOnce(mockTurmaQueryBuilder("INFANTIL"));
      const existente = {
        id: "r-1",
        userId: "u-1",
        turmaId: "t-1",
        unitId: "unit-1",
        semestreId: "s-1",
        status: "RASCUNHO",
      };
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce(existente);

      const result = await service.criar(
        { turmaId: "t-1", semestreId: "s-1" },
        session,
      );

      expect(result).toBe(existente);
      expect(mockHistorico.registrar).not.toHaveBeenCalled();
    });
  });

  describe("buscarPorId", () => {
    const session = {
      userId: "u-1",
      role: "professora",
      unitId: "unit-1",
      schoolId: null,
      stageId: null,
    };

    it("retorna relatório quando o usuário é o autor", async () => {
      const relatorio = {
        id: "r-1",
        userId: "u-1",
        unitId: "unit-1",
        turmaId: "t-1",
        status: "RASCUNHO",
        user: { id: "u-1", name: "Pro" },
        turma: { id: "t-1", name: "Berçário 1", code: "B1", stageId: "s-1" },
        documentos: [],
      };
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce(relatorio);

      const result = (await service.buscarPorId("r-1", session)) as unknown as {
        id: string;
      };
      expect(result.id).toBe("r-1");
    });

    it("rejeita quando relatório não pertence ao usuário e role não tem acesso", async () => {
      const relatorio = {
        id: "r-1",
        userId: "outro",
        unitId: "unit-1",
        turmaId: "t-1",
        status: "RASCUNHO",
        user: { id: "outro", name: "Outra" },
        turma: { id: "t-1", name: "B1", code: "B1", stageId: "s-1" },
        documentos: [],
      };
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce(relatorio);

      await expect(service.buscarPorId("r-1", session)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("adicionarDocumentoUpload", () => {
    const session = {
      userId: "u-1",
      role: "professora",
      unitId: "unit-1",
      schoolId: null,
      stageId: null,
    };

    const dadosUpload = {
      fileName: "arquivo.pdf",
      storageKey: "relatorios/arquivo.pdf",
      url: "https://storage.example.com/arquivo.pdf",
      fileSize: 12345,
      mimeType: "application/pdf",
    };

    it("rejeita quando relatório não encontrado", async () => {
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.adicionarDocumentoUpload("r-1", dadosUpload, session),
      ).rejects.toThrow("Relatório não encontrado");
    });

    it("rejeita quando o usuário não é o autor", async () => {
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce({
        id: "r-1",
        userId: "outro",
        status: "RASCUNHO",
      });

      await expect(
        service.adicionarDocumentoUpload("r-1", dadosUpload, session),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejeita quando status não permite edição", async () => {
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce({
        id: "r-1",
        userId: "u-1",
        status: "AGUARDANDO_ANALISTA",
      });

      await expect(
        service.adicionarDocumentoUpload("r-1", dadosUpload, session),
      ).rejects.toThrow(BadRequestException);
    });

    it("adiciona documento com sucesso quando autor e status permitem", async () => {
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce({
        id: "r-1",
        userId: "u-1",
        status: "RASCUNHO",
      });
      mockDb.returning.mockResolvedValueOnce([
        {
          id: "doc-1",
          relatorioId: "r-1",
          tipo: "ARQUIVO",
          fileName: "arquivo.pdf",
          storageKey: "relatorios/arquivo.pdf",
          url: "https://storage.example.com/arquivo.pdf",
          fileSize: 12345,
          mimeType: "application/pdf",
        },
      ]);

      const result = await service.adicionarDocumentoUpload(
        "r-1",
        dadosUpload,
        session,
      );

      expect(result.tipo).toBe("ARQUIVO");
    });
  });

  describe("adicionarYoutube", () => {
    const session = {
      userId: "u-1",
      role: "professora",
      unitId: "unit-1",
      schoolId: null,
      stageId: null,
    };

    it("rejeita quando relatório não encontrado", async () => {
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.adicionarYoutube(
          "r-1",
          { url: "https://youtube.com/watch?v=abc" },
          session,
        ),
      ).rejects.toThrow("Relatório não encontrado");
    });

    it("rejeita quando o usuário não é o autor", async () => {
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce({
        id: "r-1",
        userId: "outro",
        status: "RASCUNHO",
      });

      await expect(
        service.adicionarYoutube(
          "r-1",
          { url: "https://youtube.com/watch?v=abc" },
          session,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejeita quando status não permite edição", async () => {
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce({
        id: "r-1",
        userId: "u-1",
        status: "AGUARDANDO_ANALISTA",
      });

      await expect(
        service.adicionarYoutube(
          "r-1",
          { url: "https://youtube.com/watch?v=abc" },
          session,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("adiciona YouTube com sucesso quando autor e status permitem", async () => {
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce({
        id: "r-1",
        userId: "u-1",
        status: "RASCUNHO",
      });
      mockDb.returning.mockResolvedValueOnce([
        {
          id: "doc-1",
          relatorioId: "r-1",
          tipo: "LINK_YOUTUBE",
          url: "https://youtube.com/watch?v=abc",
          fileName: "Meu vídeo",
        },
      ]);

      const result = await service.adicionarYoutube(
        "r-1",
        { url: "https://youtube.com/watch?v=abc", titulo: "Meu vídeo" },
        session,
      );

      expect(result.tipo).toBe("LINK_YOUTUBE");
    });
  });

  describe("removerDocumento", () => {
    const session: SessaoTeste = {
      userId: "u-1",
      role: "professora",
      unitId: "unit-1",
      schoolId: "school-1",
      stageId: null,
    };

    const relatorioBase = {
      id: "r-1",
      userId: "u-1",
      turmaId: "t-1",
      unitId: "unit-1",
      schoolId: "school-1",
      status: "RASCUNHO",
      user: { id: "outro", name: "Outra" },
      turma: { id: "t-1", name: "Berçário 1", code: "B1", stageId: "s-1" },
      documentos: [],
    };

    const documentoBase = {
      id: "doc-1",
      relatorioId: "r-1",
      tipo: "ARQUIVO",
      fileName: "relatorio.docx",
      fileSize: 2048,
      storageKey: "relatorios/original.docx",
      pdfStorageKey: "relatorios/impresso.pdf",
      approvedBy: null,
      approvedAt: null,
      sharepointItemId: "sharepoint-1",
    };

    const removerDocumento = (...args: [SessaoTeste, string, string, string]) =>
      (
        service.removerDocumento as unknown as (
          session: SessaoTeste,
          relatorioId: string,
          documentoId: string,
          motivo: string,
        ) => Promise<void>
      )(...args);

    const prepararExclusao = (
      relatorioSobTeste = relatorioBase,
      documento: Record<string, unknown> = documentoBase,
    ) => {
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce(relatorioSobTeste);
      mockDb.query.relatorioDocumento.findFirst.mockResolvedValueOnce(
        documento,
      );
      mockDb.query.users.findFirst.mockResolvedValueOnce({
        id: session.userId,
        name: "Usuária da Sessão",
      });
      mockDb.query.units.findFirst.mockResolvedValue({ id: "unit-1" });
    };

    it("rejeita motivo inválido antes de consultar o banco", async () => {
      await expect(
        removerDocumento(session, "r-1", "doc-1", "curto"),
      ).rejects.toThrow(BadRequestException);
      expect(mockDb.query.relatorio.findFirst).not.toHaveBeenCalled();
    });

    it("rejeita quando relatório não encontrado", async () => {
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce(null);

      await expect(
        removerDocumento(
          session,
          "r-1",
          "doc-1",
          "motivo válido para exclusão",
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it.each(["professora", "auxiliar_sala"])(
      "rejeita exclusão de relatório de terceiro para o perfil %s",
      async (role) => {
        prepararExclusao({ ...relatorioBase, userId: "outro" });

        await expect(
          removerDocumento(
            { ...session, role },
            "r-1",
            "doc-1",
            "arquivo anexado por outra professora",
          ),
        ).rejects.toThrow(ForbiddenException);
        expect(mockDb.transaction).not.toHaveBeenCalled();
      },
    );

    it.each([
      ["approvedBy", { approvedBy: "analista-1", approvedAt: null }],
      ["approvedAt", { approvedBy: null, approvedAt: new Date() }],
    ])("rejeita documento aprovado por %s", async (_campo, aprovacao) => {
      prepararExclusao(relatorioBase, { ...documentoBase, ...aprovacao });

      await expect(
        removerDocumento(
          session,
          "r-1",
          "doc-1",
          "arquivo aprovado não deve sair",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it.each(["LINK_YOUTUBE", "YOUTUBE"])(
      "rejeita documento do tipo %s",
      async (tipo) => {
        prepararExclusao(relatorioBase, { ...documentoBase, tipo });

        await expect(
          removerDocumento(
            session,
            "r-1",
            "doc-1",
            "não excluir links do relatório",
          ),
        ).rejects.toThrow(BadRequestException);
      },
    );

    it("rejeita tipo de documento desconhecido", async () => {
      prepararExclusao(relatorioBase, { ...documentoBase, tipo: "PLANILHA" });

      await expect(
        removerDocumento(
          session,
          "r-1",
          "doc-1",
          "tipo não permitido para exclusão",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejeita quando documento não encontrado", async () => {
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce(relatorioBase);
      mockDb.query.relatorioDocumento.findFirst.mockResolvedValueOnce(null);
      mockDb.query.units.findFirst.mockResolvedValue({ id: "unit-1" });

      await expect(
        removerDocumento(
          session,
          "r-1",
          "doc-1",
          "documento ausente no relatório",
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("remove original, PDF, SharePoint e registra histórico em uma exclusão bem-sucedida", async () => {
      prepararExclusao({ ...relatorioBase, userId: session.userId });

      await expect(
        removerDocumento(
          session,
          "r-1",
          "doc-1",
          "arquivo duplicado no relatório",
        ),
      ).resolves.toBeUndefined();

      expect(mockHistorico.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          relatorioId: "r-1",
          userId: "u-1",
          userName: "Usuária da Sessão",
          userRole: "professora",
          acao: "DOCUMENTO_EXCLUIDO",
          statusAnterior: "RASCUNHO",
          statusNovo: "RASCUNHO",
          detalhes: {
            documentoId: "doc-1",
            documentoNome: "relatorio.docx",
            documentoTipo: "ARQUIVO",
            tamanhoBytes: 2048,
            motivo: "arquivo duplicado no relatório",
          },
        }),
        mockTx,
      );
      expect(mockStorage.deleteFile).toHaveBeenCalledWith(
        "relatorios/original.docx",
      );
      expect(mockStorage.deleteFile).toHaveBeenCalledWith(
        "relatorios/impresso.pdf",
      );
      expect(mockSharePoint.removerArquivo).toHaveBeenCalledWith(
        "sharepoint-1",
      );
    });

    it.each([
      [
        "chaves iguais",
        "relatorios/mesmo-arquivo.docx",
        "relatorios/mesmo-arquivo.docx",
        1,
      ],
      ["ambas nulas", null, null, 0],
      ["somente chave original", "relatorios/original.docx", null, 1],
      ["somente chave do PDF", null, "relatorios/impresso.pdf", 1],
    ])(
      "remove storage corretamente quando há %s",
      async (_descricao, storageKey, pdfStorageKey, quantidadeChamadas) => {
        prepararExclusao(
          { ...relatorioBase, userId: session.userId },
          {
            ...documentoBase,
            storageKey,
            pdfStorageKey,
            sharepointItemId: null,
          },
        );

        await expect(
          removerDocumento(
            session,
            "r-1",
            "doc-1",
            "limpeza de arquivos associados",
          ),
        ).resolves.toBeUndefined();

        expect(mockStorage.deleteFile).toHaveBeenCalledTimes(
          quantidadeChamadas,
        );
        for (const chave of [storageKey, pdfStorageKey]) {
          if (chave) {
            expect(mockStorage.deleteFile).toHaveBeenCalledWith(chave);
          }
        }
      },
    );

    it("permite a exclusão para todos os perfis autorizados do módulo", async () => {
      const perfis = [
        "professora",
        "auxiliar_sala",
        "analista_pedagogico",
        "coordenadora_bercario",
        "coordenadora_infantil",
        "coordenadora_geral",
        "gerente_unidade",
        "gerente_financeiro",
        "diretora_geral",
        "master",
      ];

      for (const role of perfis) {
        jest.clearAllMocks();
        mockTx.returning.mockResolvedValue([{ id: "doc-1" }]);
        mockDb.query.relatorio.findFirst.mockResolvedValueOnce({
          ...relatorioBase,
          userId:
            role === "professora" || role === "auxiliar_sala"
              ? session.userId
              : relatorioBase.userId,
          unitId: role === "diretora_geral" ? "unit-2" : "unit-1",
        });
        mockDb.query.relatorioDocumento.findFirst.mockResolvedValueOnce(
          documentoBase,
        );
        mockDb.query.users.findFirst.mockResolvedValueOnce({ name: "Usuária" });
        mockDb.query.units.findFirst.mockResolvedValue({ id: "unit-1" });
        if (
          role === "coordenadora_bercario" ||
          role === "coordenadora_infantil"
        ) {
          mockDb.select.mockReturnValueOnce({
            from: jest.fn().mockReturnThis(),
            innerJoin: jest.fn().mockReturnThis(),
            where: jest.fn().mockResolvedValue([
              {
                etapaCode:
                  role === "coordenadora_bercario" ? "BERCARIO" : "INFANTIL",
              },
            ]),
          });
        }

        await expect(
          removerDocumento(
            {
              ...session,
              role,
              schoolId: role === "master" ? null : "school-1",
              unitId:
                role === "master" || role === "diretora_geral"
                  ? null
                  : "unit-1",
            },
            "r-1",
            "doc-1",
            "remoção autorizada pelo perfil",
          ),
        ).resolves.toBeUndefined();
      }
    });

    it("rejeita auxiliar administrativo mesmo que seja proprietário", async () => {
      prepararExclusao({ ...relatorioBase, userId: session.userId });

      await expect(
        removerDocumento(
          { ...session, role: "auxiliar_administrativo" },
          "r-1",
          "doc-1",
          "tentativa de exclusão não autorizada",
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("não permite proprietário fora da unidade", async () => {
      prepararExclusao({
        ...relatorioBase,
        userId: session.userId,
        unitId: "unit-2",
      });
      mockDb.query.units.findFirst.mockResolvedValue({ id: "unit-2" });

      await expect(
        removerDocumento(session, "r-1", "doc-1", "documento fora da unidade"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("permite diretora geral em outra unidade da mesma escola", async () => {
      prepararExclusao({ ...relatorioBase, unitId: "unit-2" });
      mockDb.query.units.findFirst.mockResolvedValue({ id: "unit-2" });

      await expect(
        removerDocumento(
          { ...session, role: "diretora_geral", unitId: "unit-1" },
          "r-1",
          "doc-1",
          "ajuste solicitado pela direção",
        ),
      ).resolves.toBeUndefined();
    });

    it("permite master global sem escola ou unidade", async () => {
      prepararExclusao({ ...relatorioBase, unitId: "unit-remota" });

      await expect(
        removerDocumento(
          { ...session, role: "master", schoolId: null, unitId: null },
          "r-1",
          "doc-1",
          "remoção global solicitada pelo master",
        ),
      ).resolves.toBeUndefined();
    });

    it("rejeita coordenadora quando a etapa do relatório não pertence ao seu segmento", async () => {
      prepararExclusao();
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ etapaCode: "INFANTIL" }]),
      });

      await expect(
        removerDocumento(
          { ...session, role: "coordenadora_bercario" },
          "r-1",
          "doc-1",
          "segmento incompatível para exclusão",
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("não interrompe a remoção local quando Storage ou SharePoint falham", async () => {
      prepararExclusao();
      mockStorage.deleteFile.mockRejectedValue(
        new Error("storage indisponível"),
      );
      mockSharePoint.removerArquivo.mockRejectedValue(
        new Error("SharePoint indisponível"),
      );

      await expect(
        removerDocumento(
          session,
          "r-1",
          "doc-1",
          "limpeza externa pode falhar",
        ),
      ).resolves.toBeUndefined();
      expect(mockHistorico.registrar).toHaveBeenCalled();
    });

    it("bloqueia aprovação concorrente dentro da transação", async () => {
      prepararExclusao();
      mockTx.returning.mockResolvedValueOnce([]);
      mockTx.query.relatorioDocumento.findFirst.mockResolvedValueOnce({
        ...documentoBase,
        approvedAt: new Date(),
      });

      await expect(
        removerDocumento(
          session,
          "r-1",
          "doc-1",
          "documento aprovado durante operação",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockStorage.deleteFile).not.toHaveBeenCalled();
    });

    it("converte falhas técnicas em mensagem genérica", async () => {
      mockDb.query.relatorio.findFirst.mockRejectedValueOnce(
        new Error("SQL secreto"),
      );

      await expect(
        removerDocumento(session, "r-1", "doc-1", "falha técnica do relatório"),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "FALHA_EXCLUSAO_DOCUMENTO",
        }),
      });
    });
  });

  describe("submeter", () => {
    const session = {
      userId: "u-1",
      role: "professora",
      unitId: "unit-1",
      schoolId: null,
      stageId: null,
    };

    it("rejeita quando o usuário não é o autor", async () => {
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce({
        id: "r-1",
        userId: "outro",
        status: "RASCUNHO",
        documentos: [{ id: "d-1" }],
      });

      await expect(service.submeter("r-1", session)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("rejeita quando relatório não tem documentos", async () => {
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce({
        id: "r-1",
        userId: "u-1",
        status: "RASCUNHO",
        documentos: [],
      });

      await expect(service.submeter("r-1", session)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("muda status para AGUARDANDO_ANALISTA quando submete", async () => {
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce({
        id: "r-1",
        userId: "u-1",
        status: "RASCUNHO",
        documentos: [{ id: "d-1" }],
      });
      mockDb.returning.mockResolvedValueOnce([
        {
          id: "r-1",
          status: "AGUARDANDO_ANALISTA",
        },
      ]);
      mockDb.query.users.findFirst.mockResolvedValueOnce({ name: "Pro" });

      const result = await service.submeter("r-1", session);
      expect(result.status).toBe("AGUARDANDO_ANALISTA");
    });
  });

  describe("devolverAnalista", () => {
    const session = {
      userId: "analista-1",
      role: "analista_pedagogico",
      unitId: "unit-1",
      schoolId: null,
      stageId: null,
    };

    it("devolve sem exigir motivo e registra histórico sem detalhes", async () => {
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce({
        id: "r-1",
        unitId: "unit-1",
        status: "AGUARDANDO_ANALISTA",
      });
      mockDb.returning.mockResolvedValueOnce([
        {
          id: "r-1",
          status: "DEVOLVIDO_ANALISTA",
        },
      ]);
      mockDb.query.users.findFirst.mockResolvedValueOnce({ name: "Analista" });
      const devolverAnalista = service.devolverAnalista as unknown as (
        relatorioId: string,
        user: typeof session,
      ) => Promise<{ status: string }>;

      const result = await devolverAnalista.call(service, "r-1", session);

      expect(result.status).toBe("DEVOLVIDO_ANALISTA");
      expect(mockHistorico.registrar).toHaveBeenCalledWith({
        relatorioId: "r-1",
        userId: "analista-1",
        userName: "Analista",
        userRole: "analista_pedagogico",
        acao: "DEVOLVIDO_ANALISTA",
        statusAnterior: "AGUARDANDO_ANALISTA",
        statusNovo: "DEVOLVIDO_ANALISTA",
      });
    });
  });
});
