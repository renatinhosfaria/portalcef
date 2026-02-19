import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { PlanoAulaHistoricoService } from "./plano-aula-historico.service";
import { PlanoAulaService } from "./plano-aula.service";

const mockDb = {
  query: {
    planoDocumento: {
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
  or: jest.fn(),
  desc: jest.fn(),
  gte: jest.fn(),
  lte: jest.fn(),
  inArray: jest.fn(),
  planoAula: {},
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanoAulaService,
        {
          provide: PlanoAulaHistoricoService,
          useValue: historicoServiceMock,
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
        previewStatus: "PRONTO",
        previewUrl: "https://cdn.exemplo.com/doc-2.pdf",
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
});
