import { ForbiddenException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { PdfGeneratorService } from "../../common/sharepoint/pdf-generator.service";
import { StorageService } from "../../common/storage/storage.service";
import { ProvaHistoricoService } from "./prova-historico.service";
import { ProvaService } from "./prova.service";

const mockDb = {
  query: {
    prova: {
      findMany: jest.fn(),
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
  const pdfGeneratorServiceMock = {};
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
});
