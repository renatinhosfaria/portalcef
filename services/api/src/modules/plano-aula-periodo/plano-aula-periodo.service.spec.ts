import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";

const mockReturning = jest.fn();
const mockValues = jest.fn(() => ({ returning: mockReturning }));
const mockInsert = jest.fn(() => ({ values: mockValues }));

const mockDb = {
  insert: mockInsert,
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockResolvedValue([]),
};

jest.mock("@essencia/db", () => ({
  getDb: jest.fn(() => mockDb),
  eq: jest.fn(),
  and: jest.fn(),
  asc: jest.fn(),
}));

jest.mock("@essencia/db/schema", () => ({
  planoAulaPeriodo: {
    id: "id",
    unidadeId: "unidadeId",
    etapa: "etapa",
    numero: "numero",
    dataInicio: "dataInicio",
    dataFim: "dataFim",
    atualizadoEm: "atualizadoEm",
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

import { PlanoAulaPeriodoService } from "./plano-aula-periodo.service";

describe("PlanoAulaPeriodoService", () => {
  let service: PlanoAulaPeriodoService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockReturning.mockReset();
    mockValues.mockClear();
    mockInsert.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [PlanoAulaPeriodoService],
    }).compile();

    service = module.get<PlanoAulaPeriodoService>(PlanoAulaPeriodoService);
  });

  const configurarCriacaoValida = (
    dto: {
      etapa: string;
      dataInicio: string;
      dataFim: string;
      dataMaximaEntrega: string;
    },
  ) => {
    jest.spyOn(service as any, "verificarSobreposicao").mockResolvedValue([]);
    jest.spyOn(service as any, "calcularProximoNumero").mockResolvedValue(1);
    jest
      .spyOn(service as any, "renumerarPeriodosSeNecessario")
      .mockResolvedValue(undefined);

    mockReturning.mockResolvedValue([
      {
        id: "periodo-id",
        unidadeId: "unidade-id",
        etapa: dto.etapa,
        numero: 1,
        descricao: null,
        dataInicio: dto.dataInicio,
        dataFim: dto.dataFim,
        dataMaximaEntrega: dto.dataMaximaEntrega,
        criadoPor: "user-id",
        criadoEm: new Date("2026-01-01T00:00:00.000Z"),
        atualizadoEm: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
  };

  describe("criarPeriodo", () => {
    it("deve lançar erro se dataInicio >= dataFim", async () => {
      const dto = {
        etapa: "INFANTIL",
        dataInicio: "2026-03-15",
        dataFim: "2026-03-10",
        dataMaximaEntrega: "2026-03-12",
      };

      await expect(
        service.criarPeriodo("unidade-id", "user-id", dto),
      ).rejects.toThrow(BadRequestException);
    });

    it("deve aceitar dataMaximaEntrega antes do início", async () => {
      const dto = {
        etapa: "INFANTIL",
        dataInicio: "2026-03-10",
        dataFim: "2026-03-20",
        dataMaximaEntrega: "2026-03-08", // ✅ ANTES do início
      };

      configurarCriacaoValida(dto);

      const result = await service.criarPeriodo("unidade-id", "user-id", dto);
      expect(result).toEqual(expect.objectContaining({ id: "periodo-id" }));
    });

    it("deve lançar erro se datas forem inválidas", async () => {
      const dto = {
        etapa: "INFANTIL",
        dataInicio: "2026-99-99", // Data inválida
        dataFim: "2026-03-15",
        dataMaximaEntrega: "2026-03-12",
      };

      await expect(
        service.criarPeriodo("unidade-id", "user-id", dto),
      ).rejects.toThrow(BadRequestException);
    });

    it("deve lançar erro se dataMaximaEntrega >= dataInicio", async () => {
      const dto = {
        etapa: "INFANTIL",
        dataInicio: "2026-03-10",
        dataFim: "2026-03-20",
        dataMaximaEntrega: "2026-03-15", // ❌ Durante o período (inválido)
      };

      await expect(
        service.criarPeriodo("unidade-id", "user-id", dto),
      ).rejects.toThrow(BadRequestException);
    });

    it("deve lançar erro se dataMaximaEntrega == dataInicio", async () => {
      const dto = {
        etapa: "INFANTIL",
        dataInicio: "2026-03-10",
        dataFim: "2026-03-20",
        dataMaximaEntrega: "2026-03-10", // ❌ Igual ao início (inválido)
      };

      await expect(
        service.criarPeriodo("unidade-id", "user-id", dto),
      ).rejects.toThrow(BadRequestException);
    });

    it("deve aceitar datas válidas com dataMaximaEntrega antes do início", async () => {
      const dto = {
        etapa: "INFANTIL",
        dataInicio: "2026-03-10",
        dataFim: "2026-03-20",
        dataMaximaEntrega: "2026-03-05", // ✅ Antes do início (válido)
      };

      configurarCriacaoValida(dto);

      const result = await service.criarPeriodo("unidade-id", "user-id", dto);
      expect(result).toEqual(expect.objectContaining({ id: "periodo-id" }));
    });
  });

  describe("verificarSobreposicao", () => {
    it("deve retornar períodos sobrepostos quando houver conflito", async () => {
      // Mock: assumir que já existe período de 01/03 a 15/03
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service as any, "buscarPeriodosPorEtapa").mockResolvedValue([
        {
          id: "periodo-1",
          dataInicio: new Date("2026-03-01"),
          dataFim: new Date("2026-03-15"),
        },
      ]);

      const resultado = await service["verificarSobreposicao"](
        "unidade-id",
        "INFANTIL",
        new Date("2026-03-10"),
        new Date("2026-03-20"),
      );

      expect(resultado).toHaveLength(1);
    });

    it("deve retornar vazio quando não houver sobreposição", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service as any, "buscarPeriodosPorEtapa").mockResolvedValue([
        {
          id: "periodo-1",
          dataInicio: new Date("2026-03-01"),
          dataFim: new Date("2026-03-15"),
        },
      ]);

      const resultado = await service["verificarSobreposicao"](
        "unidade-id",
        "INFANTIL",
        new Date("2026-03-16"),
        new Date("2026-03-30"),
      );

      expect(resultado).toHaveLength(0);
    });
  });

  describe("calcularProximoNumero", () => {
    it("deve retornar 1 quando não há períodos", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest
        .spyOn(service as any, "buscarPeriodosPorEtapa")
        .mockResolvedValue([]);
      const numero = await service["calcularProximoNumero"](
        "unidade-id",
        "INFANTIL",
        new Date("2026-03-01"),
      );
      expect(numero).toBe(1);
    });

    it("deve retornar próximo número em ordem cronológica", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service as any, "buscarPeriodosPorEtapa").mockResolvedValue([
        { numero: 1, dataInicio: new Date("2026-03-01") },
        { numero: 2, dataInicio: new Date("2026-03-15") },
      ]);
      const numero = await service["calcularProximoNumero"](
        "unidade-id",
        "INFANTIL",
        new Date("2026-03-30"),
      );
      expect(numero).toBe(3);
    });

    it("deve inserir no meio quando data está entre períodos existentes", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service as any, "buscarPeriodosPorEtapa").mockResolvedValue([
        { numero: 1, dataInicio: new Date("2026-03-01") },
        { numero: 2, dataInicio: new Date("2026-03-20") },
      ]);
      const numero = await service["calcularProximoNumero"](
        "unidade-id",
        "INFANTIL",
        new Date("2026-03-10"),
      );
      expect(numero).toBe(2);
    });
  });
});
