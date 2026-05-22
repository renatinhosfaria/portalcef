// services/api/src/modules/relatorio/relatorio.service.spec.ts

import { BadRequestException, ForbiddenException } from "@nestjs/common";

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
  relatorio: {
    id: "id",
    userId: "userId",
    turmaId: "turmaId",
    unitId: "unitId",
    semanaId: "semanaId",
    status: "status",
    semanaRelatorioId: "semanaRelatorioId",
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
}));

import { RelatorioService } from "./relatorio.service";
import type { RelatorioHistoricoService } from "./relatorio-historico.service";
import type { StorageService } from "../../common/storage/storage.service";
import type { RelatorioPdfQueueService } from "./relatorio-pdf-queue.service";

describe("RelatorioService", () => {
  let service: RelatorioService;
  let mockHistorico: jest.Mocked<RelatorioHistoricoService>;
  let mockStorage: jest.Mocked<StorageService>;
  let mockQueue: jest.Mocked<RelatorioPdfQueueService>;

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

    service = new RelatorioService(mockHistorico, mockStorage, mockQueue);
  });

  describe("criar", () => {
    const session = {
      userId: "u-1",
      role: "professora",
      unitId: "unit-1",
      schoolId: null,
      stageId: null,
    };

    it("rejeita turma de etapa FUNDAMENTAL_I", async () => {
      mockDb.select.mockReturnValueOnce(mockTurmaQueryBuilder("FUNDAMENTAL_I"));

      await expect(
        service.criar(
          { turmaId: "t-1", semanaId: "s-1" },
          session,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejeita quando unitId não está na sessão", async () => {
      await expect(
        service.criar(
          { turmaId: "t-1", semanaId: "s-1" },
          { ...session, unitId: null },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejeita quando turma não pertence à unidade", async () => {
      mockDb.select.mockReturnValueOnce(mockEmptyTurmaQuery());

      await expect(
        service.criar(
          { turmaId: "t-1", semanaId: "s-1" },
          session,
        ),
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
          semanaId: "s-1",
          status: "RASCUNHO",
        },
      ]);
      mockDb.query.users.findFirst.mockResolvedValueOnce({ name: "Professora" });

      const result = await service.criar(
        { turmaId: "t-1", semanaId: "s-1" },
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
        semanaId: "s-1",
        status: "RASCUNHO",
      };
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce(existente);

      const result = await service.criar(
        { turmaId: "t-1", semanaId: "s-1" },
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
        service.removerDocumento("r-1", "doc-1", session),
      ).rejects.toThrow("Relatório não encontrado");
    });

    it("rejeita quando o usuário não é o autor do relatório", async () => {
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce({
        id: "r-1",
        userId: "outro",
        status: "RASCUNHO",
      });

      await expect(
        service.removerDocumento("r-1", "doc-1", session),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejeita quando documento não encontrado", async () => {
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce({
        id: "r-1",
        userId: "u-1",
        status: "RASCUNHO",
      });
      mockDb.query.relatorioDocumento.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.removerDocumento("r-1", "doc-1", session),
      ).rejects.toThrow("Documento não encontrado");
    });

    it("remove documento com sucesso quando autor e documento existem", async () => {
      mockDb.query.relatorio.findFirst.mockResolvedValueOnce({
        id: "r-1",
        userId: "u-1",
        status: "RASCUNHO",
      });
      mockDb.query.relatorioDocumento.findFirst.mockResolvedValueOnce({
        id: "doc-1",
        relatorioId: "r-1",
        storageKey: null,
        pdfStorageKey: null,
      });

      await expect(
        service.removerDocumento("r-1", "doc-1", session),
      ).resolves.toBeUndefined();
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
});
