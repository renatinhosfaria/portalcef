import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { PdfGeneratorService } from "../../common/sharepoint/pdf-generator.service";
import { StorageService } from "../../common/storage/storage.service";
import { PlanoAulaHistoricoService } from "./plano-aula-historico.service";
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
      findMany: jest.fn(),
    },
  },
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

  const pdfGeneratorServiceMock = {};
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
          provide: StorageService,
          useValue: storageServiceMock,
        },
      ],
    }).compile();

    service = module.get<PlanoAulaService>(PlanoAulaService);
    jest.clearAllMocks();
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
