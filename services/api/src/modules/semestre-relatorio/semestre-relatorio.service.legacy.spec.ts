import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";

const mockReturning = jest.fn();
const mockValues = jest.fn(() => ({ returning: mockReturning }));
const mockInsert = jest.fn(() => ({ values: mockValues }));
const mockDeleteWhere = jest.fn().mockResolvedValue(undefined);
const mockDelete = jest.fn(() => ({ where: mockDeleteWhere }));
const mockUpdateReturning = jest.fn();
const mockUpdateWhere = jest.fn(() => ({ returning: mockUpdateReturning }));
const mockSet = jest.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = jest.fn(() => ({ set: mockSet }));

const mockDb = {
  insert: mockInsert,
  delete: mockDelete,
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([]),
  update: mockUpdate,
  set: mockSet,
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
  semestreRelatorio: {
    id: "id",
    unidadeId: "unidadeId",
    etapa: "etapa",
    anoLetivo: "anoLetivo",
    semestre: "semestre",
    dataInicio: "dataInicio",
    dataFim: "dataFim",
    dataMaximaEntrega: "dataMaximaEntrega",
    atualizadoEm: "atualizadoEm",
  },
  relatorio: {
    semestreRelatorioId: "relatorio.semestreRelatorioId",
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

import { SemestreRelatorioService } from "./semestre-relatorio.service";

describe("SemestreRelatorioService", () => {
  let service: SemestreRelatorioService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockReturning.mockReset();
    mockValues.mockClear();
    mockInsert.mockClear();
    mockDelete.mockClear();
    mockDeleteWhere.mockClear();
    mockUpdateReturning.mockReset();
    mockUpdateWhere.mockClear();
    mockSet.mockClear();
    mockUpdate.mockClear();
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
    mockDb.where.mockReset();
    mockDb.where.mockResolvedValue([]);
    mockDb.orderBy.mockReset();
    mockDb.orderBy.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [SemestreRelatorioService],
    }).compile();

    service = module.get<SemestreRelatorioService>(SemestreRelatorioService);
  });

  describe("listarPorUnidade", () => {
    it("deve retornar array vazio quando não há semestres", async () => {
      mockDb.where.mockReturnValueOnce({ orderBy: mockDb.orderBy });
      mockDb.orderBy.mockResolvedValueOnce([]);

      const result = await service.listarPorUnidade("unit-123");

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it("deve retornar semestres com quantidade de relatórios vinculados", async () => {
      mockDb.where.mockReturnValueOnce({ orderBy: mockDb.orderBy });
      mockDb.orderBy.mockResolvedValueOnce([
        {
          id: "semestre-1",
          unidadeId: "unit-123",
          etapa: "INFANTIL",
          anoLetivo: 2026,
          semestre: 1,
          dataInicio: "2026-03-01",
          dataFim: "2026-03-07",
          dataMaximaEntrega: "2026-02-25",
        },
      ]);
      // Para contarRelatoriosVinculados: select({ total }).from().where() → COUNT(*)
      mockDb.where.mockResolvedValueOnce([{ total: 2 }]);

      const resultado = await service.listarPorUnidade("unit-123");

      expect(resultado).toEqual([
        expect.objectContaining({
          id: "semestre-1",
          relatoriosVinculados: 2,
        }),
      ]);
    });
  });

  describe("buscarPorId", () => {
    it("deve lançar exceção quando semestre não encontrado", async () => {
      mockDb.where.mockResolvedValueOnce([]);

      await expect(
        service.buscarPorId("semestre-inexistente", "unit-123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("deve retornar semestre quando encontrada", async () => {
      const semestre = {
        id: "semestre-1",
        unidadeId: "unit-123",
        etapa: "INFANTIL",
        anoLetivo: 2026,
        semestre: 1,
      };
      mockDb.where.mockResolvedValueOnce([semestre]);

      const result = await service.buscarPorId("semestre-1", "unit-123");

      expect(result).toEqual(semestre);
    });
  });

  describe("criar", () => {
    it("deve criar semestre de relatório com dados válidos", async () => {
      const dto = {
        etapa: "INFANTIL",
        anoLetivo: 2026,
        semestre: 1,
        dataInicio: "2026-03-01",
        dataFim: "2026-03-07",
        dataMaximaEntrega: "2026-02-25",
      };

      mockReturning.mockResolvedValueOnce([
        {
          id: "semestre-nova",
          unidadeId: "unit-123",
          ...dto,
        },
      ]);

      const result = await service.criar(dto, "unit-123", "user-456");

      expect(result).toEqual(expect.objectContaining({ id: "semestre-nova" }));
      expect(mockInsert).toHaveBeenCalled();
    });

    it("deve lançar exceção quando a inserção falha", async () => {
      const dto = {
        etapa: "INFANTIL",
        anoLetivo: 2026,
        semestre: 1,
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
      // buscarPorId é chamado PRIMEIRO (validação de tenant)
      mockDb.where.mockResolvedValueOnce([
        { id: "semestre-1", unidadeId: "unit-123", etapa: "INFANTIL" },
      ]);
      // contarRelatoriosVinculados retorna count > 0
      mockDb.where.mockResolvedValueOnce([{ total: 2 }]);

      await expect(
        service.excluir("semestre-1", "unit-123"),
      ).rejects.toThrow(BadRequestException);

      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("deve excluir semestre sem relatórios vinculados", async () => {
      // buscarPorId é chamado PRIMEIRO
      mockDb.where.mockResolvedValueOnce([
        { id: "semestre-1", unidadeId: "unit-123", etapa: "INFANTIL" },
      ]);
      // contarRelatoriosVinculados retorna count = 0
      mockDb.where.mockResolvedValueOnce([{ total: 0 }]);

      await expect(
        service.excluir("semestre-1", "unit-123"),
      ).resolves.toBeUndefined();
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe("editar", () => {
    it("deve lançar exceção quando semestre não encontrado", async () => {
      // buscarPorId retorna vazio
      mockDb.where.mockResolvedValueOnce([]);

      await expect(
        service.editar("semestre-inexistente", { dataInicio: "2026-03-01" }, "unit-123"),
      ).rejects.toThrow(BadRequestException);

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("deve chamar buscarPorId antes de atualizar", async () => {
      // buscarPorId retorna o semestre
      const semestre = { id: "semestre-1", unidadeId: "unit-123", etapa: "INFANTIL" };
      mockDb.where.mockResolvedValueOnce([semestre]);

      const semestreAtualizada = { ...semestre, dataInicio: "2026-04-01", atualizadoEm: expect.any(Date) };
      mockUpdateReturning.mockResolvedValueOnce([semestreAtualizada]);

      await service.editar("semestre-1", { dataInicio: "2026-04-01" }, "unit-123");

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ atualizadoEm: expect.any(Date) }),
      );
    });

    it("deve atualizar somente os campos fornecidos no DTO", async () => {
      const semestre = { id: "semestre-1", unidadeId: "unit-123", etapa: "INFANTIL" };
      mockDb.where.mockResolvedValueOnce([semestre]);

      const dto = { dataFim: "2026-03-14", dataMaximaEntrega: "2026-03-10" };
      const semestreAtualizada = { ...semestre, ...dto, atualizadoEm: new Date() };
      mockUpdateReturning.mockResolvedValueOnce([semestreAtualizada]);

      const result = await service.editar("semestre-1", dto, "unit-123");

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          dataFim: "2026-03-14",
          dataMaximaEntrega: "2026-03-10",
          atualizadoEm: expect.any(Date),
        }),
      );
      expect(result).toEqual(semestreAtualizada);
    });

    it("deve incluir atualizadoEm no set independente dos campos fornecidos", async () => {
      const semestre = { id: "semestre-1", unidadeId: "unit-123", etapa: "BERCARIO" };
      mockDb.where.mockResolvedValueOnce([semestre]);

      const semestreAtualizada = { ...semestre, descricao: "nova desc", atualizadoEm: new Date() };
      mockUpdateReturning.mockResolvedValueOnce([semestreAtualizada]);

      await service.editar("semestre-1", { descricao: "nova desc" }, "unit-123");

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ atualizadoEm: expect.any(Date) }),
      );
    });
  });

  describe("buscarPorTurma", () => {
    it("deve lançar exceção quando turma não encontrada", async () => {
      // innerJoin().where() retorna vazio = turma não existe
      mockDb.where.mockResolvedValueOnce([]);

      await expect(
        service.buscarPorTurma("turma-inexistente", "unit-123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("deve lançar exceção quando turma pertence a etapa FUNDAMENTAL_I", async () => {
      // innerJoin().where() retorna turma com etapa inválida
      mockDb.where.mockResolvedValueOnce([
        { turmaId: "turma-1", stageId: "stage-1", etapaCode: "FUNDAMENTAL_I" },
      ]);

      await expect(
        service.buscarPorTurma("turma-1", "unit-123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("deve retornar semestres para turma BERCARIO", async () => {
      // innerJoin().where() retorna turma BERCARIO
      mockDb.where.mockResolvedValueOnce([
        { turmaId: "turma-1", stageId: "stage-bercario", etapaCode: "BERCARIO" },
      ]);

      const semestresMock = [
        {
          id: "semestre-1",
          unidadeId: "unit-123",
          etapa: "BERCARIO",
          anoLetivo: 2026,
          semestre: 1,
        },
        {
          id: "semestre-2",
          unidadeId: "unit-123",
          etapa: "BERCARIO",
          anoLetivo: 2026,
          semestre: 2,
        },
      ];

      // select().from().where().orderBy() — where retorna chainable com orderBy
      mockDb.where.mockReturnValueOnce({ orderBy: mockDb.orderBy });
      mockDb.orderBy.mockResolvedValueOnce(semestresMock);

      const result = await service.buscarPorTurma("turma-1", "unit-123");

      expect(result).toEqual(semestresMock);
    });

    it("deve retornar semestres para turma INFANTIL", async () => {
      // innerJoin().where() retorna turma INFANTIL
      mockDb.where.mockResolvedValueOnce([
        { turmaId: "turma-2", stageId: "stage-infantil", etapaCode: "INFANTIL" },
      ]);

      const semestresMock = [
        {
          id: "semestre-3",
          unidadeId: "unit-123",
          etapa: "INFANTIL",
          anoLetivo: 2026,
          semestre: 1,
        },
      ];

      mockDb.where.mockReturnValueOnce({ orderBy: mockDb.orderBy });
      mockDb.orderBy.mockResolvedValueOnce(semestresMock);

      const result = await service.buscarPorTurma("turma-2", "unit-123");

      expect(result).toEqual(semestresMock);
    });
  });
});
