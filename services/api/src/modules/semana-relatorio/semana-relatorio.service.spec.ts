import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";

const mockReturning = jest.fn();
const mockValues = jest.fn(() => ({ returning: mockReturning }));
const mockInsert = jest.fn(() => ({ values: mockValues }));
const mockDeleteWhere = jest.fn().mockResolvedValue(undefined);
const mockDelete = jest.fn(() => ({ where: mockDeleteWhere }));

const mockDb = {
  insert: mockInsert,
  delete: mockDelete,
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockResolvedValue([]),
  innerJoin: jest.fn().mockReturnThis(),
};

jest.mock("@essencia/db", () => ({
  getDb: jest.fn(() => mockDb),
  eq: jest.fn(),
  and: jest.fn(),
  asc: jest.fn(),
  sql: jest.fn(() => "sql-count"),
}));

jest.mock("@essencia/db/schema", () => ({
  semanaRelatorio: {
    id: "id",
    unidadeId: "unidadeId",
    etapa: "etapa",
    numero: "numero",
    dataInicio: "dataInicio",
    dataFim: "dataFim",
    dataMaximaEntrega: "dataMaximaEntrega",
    atualizadoEm: "atualizadoEm",
  },
  relatorio: {
    semanaRelatorioId: "relatorio.semanaRelatorioId",
  },
  turmas: {
    id: "turmas.id",
    unitId: "turmas.unitId",
    stageId: "turmas.stageId",
  },
  educationStages: {
    id: "educationStages.id",
    code: "educationStages.code",
  },
}));

import { SemanaRelatorioService } from "./semana-relatorio.service";

describe("SemanaRelatorioService", () => {
  let service: SemanaRelatorioService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockReturning.mockReset();
    mockValues.mockClear();
    mockInsert.mockClear();
    mockDelete.mockClear();
    mockDeleteWhere.mockClear();
    mockDb.where.mockReset();
    mockDb.where.mockResolvedValue([]);
    mockDb.orderBy.mockReset();
    mockDb.orderBy.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [SemanaRelatorioService],
    }).compile();

    service = module.get<SemanaRelatorioService>(SemanaRelatorioService);
  });

  describe("listarPorUnidade", () => {
    it("deve retornar array vazio quando não há semanas", async () => {
      mockDb.where.mockReturnValueOnce({ orderBy: mockDb.orderBy });
      mockDb.orderBy.mockResolvedValueOnce([]);

      const result = await service.listarPorUnidade("unit-123");

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it("deve retornar semanas com quantidade de relatórios vinculados", async () => {
      mockDb.where.mockReturnValueOnce({ orderBy: mockDb.orderBy });
      mockDb.orderBy.mockResolvedValueOnce([
        {
          id: "semana-1",
          unidadeId: "unit-123",
          etapa: "INFANTIL",
          numero: 1,
          dataInicio: "2026-03-01",
          dataFim: "2026-03-07",
          dataMaximaEntrega: "2026-02-25",
        },
      ]);
      // Para contarRelatoriosVinculados: select().from().where()
      mockDb.where.mockResolvedValueOnce([{ id: "rel-1" }, { id: "rel-2" }]);

      const resultado = await service.listarPorUnidade("unit-123");

      expect(resultado).toEqual([
        expect.objectContaining({
          id: "semana-1",
          relatoriosVinculados: 2,
        }),
      ]);
    });
  });

  describe("buscarPorId", () => {
    it("deve lançar exceção quando semana não encontrada", async () => {
      mockDb.where.mockResolvedValueOnce([]);

      await expect(
        service.buscarPorId("semana-inexistente", "unit-123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("deve retornar semana quando encontrada", async () => {
      const semana = {
        id: "semana-1",
        unidadeId: "unit-123",
        etapa: "INFANTIL",
        numero: 1,
      };
      mockDb.where.mockResolvedValueOnce([semana]);

      const result = await service.buscarPorId("semana-1", "unit-123");

      expect(result).toEqual(semana);
    });
  });

  describe("criar", () => {
    it("deve criar semana de relatório com dados válidos", async () => {
      const dto = {
        etapa: "INFANTIL",
        numero: 1,
        dataInicio: "2026-03-01",
        dataFim: "2026-03-07",
        dataMaximaEntrega: "2026-02-25",
      };

      mockReturning.mockResolvedValueOnce([
        {
          id: "semana-nova",
          unidadeId: "unit-123",
          ...dto,
        },
      ]);

      const result = await service.criar(dto, "unit-123", "user-456");

      expect(result).toEqual(expect.objectContaining({ id: "semana-nova" }));
      expect(mockInsert).toHaveBeenCalled();
    });

    it("deve lançar exceção quando a inserção falha", async () => {
      const dto = {
        etapa: "INFANTIL",
        numero: 1,
        dataInicio: "2026-03-01",
        dataFim: "2026-03-07",
        dataMaximaEntrega: "2026-02-25",
      };

      mockReturning.mockResolvedValueOnce([]);

      await expect(
        service.criar(dto, "unit-123", "user-456"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("excluir", () => {
    it("deve bloquear exclusão quando há relatórios vinculados", async () => {
      // contarRelatoriosVinculados retorna registros
      mockDb.where.mockResolvedValueOnce([{ id: "rel-1" }]);

      await expect(
        service.excluir("semana-1", "unit-123"),
      ).rejects.toThrow(BadRequestException);

      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("deve excluir semana sem relatórios vinculados", async () => {
      // contarRelatoriosVinculados retorna vazio
      mockDb.where.mockResolvedValueOnce([]);
      // buscarPorId
      mockDb.where.mockResolvedValueOnce([
        { id: "semana-1", unidadeId: "unit-123", etapa: "INFANTIL" },
      ]);

      const result = await service.excluir("semana-1", "unit-123");

      expect(result).toEqual({ success: true });
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
