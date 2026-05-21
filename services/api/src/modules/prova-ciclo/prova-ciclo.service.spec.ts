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
};

jest.mock("@essencia/db", () => ({
  getDb: jest.fn(() => mockDb),
  eq: jest.fn(),
  and: jest.fn(),
  asc: jest.fn(),
  sql: jest.fn(() => "sql-count"),
}));

jest.mock("@essencia/db/schema", () => ({
  provaCiclo: {
    id: "id",
    unidadeId: "unidadeId",
    etapa: "etapa",
    numero: "numero",
    dataInicio: "dataInicio",
    dataFim: "dataFim",
    atualizadoEm: "atualizadoEm",
  },
  prova: {
    provaCicloId: "prova.provaCicloId",
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

import { ProvaCicloService } from "./prova-ciclo.service";

type CicloParaTeste = {
  id?: string;
  unidadeId?: string;
  etapa?: string;
  numero?: number;
  dataInicio: Date | string;
  dataFim?: Date | string;
};

type ProvaCicloServiceInterno = {
  verificarSobreposicao: (
    unidadeId: string,
    etapa: string,
    dataInicio: Date,
    dataFim: Date,
    excluirId?: string,
  ) => Promise<CicloParaTeste[]>;
  buscarCiclosPorEtapa: (
    unidadeId: string,
    etapa: string,
  ) => Promise<CicloParaTeste[]>;
  calcularProximoNumero: (
    unidadeId: string,
    etapa: string,
    dataInicio: Date,
  ) => Promise<number>;
  renumerarCiclosSeNecessario: (
    unidadeId: string,
    etapa: string,
  ) => Promise<void>;
};

describe("ProvaCicloService", () => {
  let service: ProvaCicloService;
  let serviceInterno: ProvaCicloServiceInterno;

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
      providers: [ProvaCicloService],
    }).compile();

    service = module.get<ProvaCicloService>(ProvaCicloService);
    serviceInterno = service as unknown as ProvaCicloServiceInterno;
  });

  describe("listarPorUnidade", () => {
    it("deve retornar quantidade de provas vinculadas por ciclo", async () => {
      mockDb.where.mockReturnValueOnce({ orderBy: mockDb.orderBy });
      mockDb.orderBy.mockResolvedValueOnce([
        {
          id: "ciclo-1",
          unidadeId: "unidade-id",
          etapa: "INFANTIL",
          numero: 1,
          dataInicio: "2026-03-01",
          dataFim: "2026-03-15",
          dataMaximaEntrega: "2026-02-25",
        },
      ]);
      mockDb.where.mockResolvedValueOnce([{ total: 4 }]);

      const resultado = await service.listarPorUnidade("unidade-id");

      expect(resultado).toEqual([
        expect.objectContaining({
          id: "ciclo-1",
          provasVinculadas: 4,
        }),
      ]);
    });
  });

  describe("excluirCiclo", () => {
    it("deve bloquear exclusão quando há provas vinculadas ao ciclo", async () => {
      mockDb.where
        .mockResolvedValueOnce([
          {
            id: "ciclo-id",
            unidadeId: "unidade-id",
            etapa: "INFANTIL",
          },
        ])
        .mockResolvedValueOnce([{ total: 1 }]);
      jest
        .spyOn(serviceInterno, "renumerarCiclosSeNecessario")
        .mockResolvedValue(undefined);

      await expect(
        (service as any).excluirCiclo("ciclo-id", "unidade-id"),
      ).rejects.toThrow("Não é possível excluir");

      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("deve excluir ciclo sem provas vinculadas e renumerar a etapa", async () => {
      mockDb.where
        .mockResolvedValueOnce([
          {
            id: "ciclo-id",
            unidadeId: "unidade-id",
            etapa: "INFANTIL",
          },
        ])
        .mockResolvedValueOnce([{ total: 0 }]);
      jest
        .spyOn(serviceInterno, "renumerarCiclosSeNecessario")
        .mockResolvedValue(undefined);

      await expect(
        (service as any).excluirCiclo("ciclo-id", "unidade-id"),
      ).resolves.toEqual({
        success: true,
        message: "Ciclo de prova excluido com sucesso",
      });

      expect(mockDelete).toHaveBeenCalled();
      expect(serviceInterno.renumerarCiclosSeNecessario).toHaveBeenCalledWith(
        "unidade-id",
        "INFANTIL",
      );
    });

    it("deve bloquear exclusão quando o ciclo não pertence à unidade informada", async () => {
      jest
        .spyOn(service, "buscarPorId")
        .mockRejectedValue(
          new BadRequestException("Ciclo de prova nao encontrado"),
        );
      mockDb.where
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([
          {
            id: "ciclo-id",
            unidadeId: "unidade-1",
            etapa: "INFANTIL",
          },
        ]);
      jest
        .spyOn(serviceInterno, "renumerarCiclosSeNecessario")
        .mockResolvedValue(undefined);

      await expect(
        (service as any).excluirCiclo("ciclo-id", "unidade-2"),
      ).rejects.toThrow("Ciclo de prova nao encontrado");

      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  describe("editarCiclo", () => {
    it("deve bloquear edição quando o ciclo não pertence à unidade informada", async () => {
      jest
        .spyOn(service, "buscarPorId")
        .mockRejectedValue(
          new BadRequestException("Ciclo de prova nao encontrado"),
        );
      mockDb.where
        .mockResolvedValueOnce([
          {
            id: "ciclo-id",
            unidadeId: "unidade-1",
            etapa: "INFANTIL",
            dataInicio: "2026-03-01",
            dataFim: "2026-03-15",
          },
        ])
        .mockReturnValueOnce({ returning: mockReturning });
      mockReturning.mockResolvedValueOnce([{ id: "ciclo-id" }]);

      await expect(
        (service as any).editarCiclo("ciclo-id", "unidade-2", {
          descricao: "Nova descrição",
        }),
      ).rejects.toThrow("Ciclo de prova nao encontrado");

      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe("criarCiclo", () => {
    it("deve lançar erro se dataInicio >= dataFim", async () => {
      await expect(
        service.criarCiclo("unidade-id", "user-id", {
          etapa: "INFANTIL",
          dataInicio: "2026-03-15",
          dataFim: "2026-03-10",
          dataMaximaEntrega: "2026-03-12",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
