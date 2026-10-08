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
  transaction: jest.fn(),
};

mockDb.transaction.mockImplementation(
  async (callback: (tx: typeof mockDb) => unknown) => callback(mockDb),
);

jest.mock("@essencia/db", () => ({
  getDb: jest.fn(() => mockDb),
  eq: jest.fn((column: unknown, value: unknown) => ({ column, value })),
  and: jest.fn((...conditions: unknown[]) => conditions),
  inArray: jest.fn((column: unknown, values: unknown[]) => ({ column, values })),
  asc: jest.fn(),
  sql: jest.fn(() => "sql-count"),
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
  planoAula: {
    planoAulaPeriodoId: "planoAula.planoAulaPeriodoId",
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

type PeriodoParaTeste = {
  id?: string;
  numero?: number;
  dataInicio: Date | string;
  dataFim?: Date | string;
};

type PlanoAulaPeriodoServiceInterno = {
  verificarSobreposicao: (
    unidadeId: string,
    etapa: string,
    dataInicio: Date,
    dataFim: Date,
    excluirId?: string,
  ) => Promise<PeriodoParaTeste[]>;
  buscarPeriodosPorEtapa: (
    unidadeId: string,
    etapa: string,
  ) => Promise<PeriodoParaTeste[]>;
  calcularProximoNumero: (
    unidadeId: string,
    etapa: string,
    dataInicio: Date,
  ) => Promise<number>;
  renumerarPeriodosSeNecessario: (
    unidadeId: string,
    etapa: string,
  ) => Promise<void>;
};

describe("PlanoAulaPeriodoService", () => {
  let service: PlanoAulaPeriodoService;
  let serviceInterno: PlanoAulaPeriodoServiceInterno;

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
    mockDb.transaction.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [PlanoAulaPeriodoService],
    }).compile();

    service = module.get<PlanoAulaPeriodoService>(PlanoAulaPeriodoService);
    serviceInterno = service as unknown as PlanoAulaPeriodoServiceInterno;
  });

  const configurarCriacaoValida = (
    dto: {
      etapa: string;
      dataInicio: string;
      dataFim: string;
      dataMaximaEntrega: string;
    },
  ) => {
    jest.spyOn(serviceInterno, "verificarSobreposicao").mockResolvedValue([]);
    jest.spyOn(serviceInterno, "calcularProximoNumero").mockResolvedValue(1);
    jest
      .spyOn(serviceInterno, "renumerarPeriodosSeNecessario")
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
      jest.spyOn(serviceInterno, "buscarPeriodosPorEtapa").mockResolvedValue([
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
      jest.spyOn(serviceInterno, "buscarPeriodosPorEtapa").mockResolvedValue([
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
      jest
        .spyOn(serviceInterno, "buscarPeriodosPorEtapa")
        .mockResolvedValue([]);
      const numero = await service["calcularProximoNumero"](
        "unidade-id",
        "INFANTIL",
        new Date("2026-03-01"),
      );
      expect(numero).toBe(1);
    });

    it("deve retornar próximo número em ordem cronológica", async () => {
      jest.spyOn(serviceInterno, "buscarPeriodosPorEtapa").mockResolvedValue([
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
      jest.spyOn(serviceInterno, "buscarPeriodosPorEtapa").mockResolvedValue([
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

  describe("listarPorUnidade", () => {
    it("deve retornar quantidade de planos vinculados por período", async () => {
      mockDb.where.mockReturnValueOnce({ orderBy: mockDb.orderBy });
      mockDb.orderBy.mockResolvedValueOnce([
        {
          id: "periodo-1",
          unidadeId: "unidade-id",
          etapa: "INFANTIL",
          numero: 1,
          dataInicio: "2026-03-01",
          dataFim: "2026-03-15",
          dataMaximaEntrega: "2026-02-25",
        },
      ]);
      mockDb.where.mockResolvedValueOnce([
        { periodoId: "periodo-1" },
        { periodoId: "periodo-1" },
        { periodoId: "periodo-1" },
      ]);

      const resultado = await service.listarPorUnidade("unidade-id");

      expect(resultado).toEqual([
        expect.objectContaining({
          id: "periodo-1",
          planosVinculados: 3,
        }),
      ]);
    });
  });

  describe("excluirPeriodo", () => {
    it("deve bloquear exclusão quando há planos vinculados ao período", async () => {
      mockDb.where
        .mockResolvedValueOnce([
          {
            id: "periodo-id",
            unidadeId: "unidade-id",
            etapa: "INFANTIL",
          },
        ])
        .mockResolvedValueOnce([
          { periodoId: "periodo-id" },
          { periodoId: "periodo-id" },
        ]);
      jest
        .spyOn(serviceInterno, "renumerarPeriodosSeNecessario")
        .mockResolvedValue(undefined);

      await expect(
        service.excluirPeriodo("periodo-id", "unidade-id"),
      ).rejects.toThrow("Não é possível excluir");

      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("deve excluir período sem planos vinculados e renumerar a etapa", async () => {
      mockDb.where
        .mockResolvedValueOnce([
          {
            id: "periodo-id",
            unidadeId: "unidade-id",
            etapa: "INFANTIL",
          },
        ])
        .mockResolvedValueOnce([]);
      jest
        .spyOn(serviceInterno, "renumerarPeriodosSeNecessario")
        .mockResolvedValue(undefined);

      await expect(
        service.excluirPeriodo("periodo-id", "unidade-id"),
      ).resolves.toEqual({
        success: true,
        message: "Período excluído com sucesso",
      });

      expect(mockDelete).toHaveBeenCalled();
      expect(
        serviceInterno.renumerarPeriodosSeNecessario,
      ).toHaveBeenCalledWith("unidade-id", "INFANTIL", expect.anything());
    });

    it("deve bloquear exclusão quando o período não pertence à unidade informada", async () => {
      jest
        .spyOn(service, "buscarPorId")
        .mockRejectedValue(new BadRequestException("Período não encontrado"));
      mockDb.where
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: "periodo-id",
            unidadeId: "unidade-1",
            etapa: "INFANTIL",
          },
        ]);
      jest
        .spyOn(serviceInterno, "renumerarPeriodosSeNecessario")
        .mockResolvedValue(undefined);

      await expect(
        service.excluirPeriodo("periodo-id", "unidade-2"),
      ).rejects.toThrow("Período não encontrado");

      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  describe("renumerarPeriodosSeNecessario", () => {
    it("deve liberar os números atuais antes de aplicar a nova ordem", async () => {
      const periodos = [
        {
          id: "periodo-antes",
          numero: 1,
          dataInicio: "2026-03-01",
          dataFim: "2026-03-05",
        },
        {
          id: "periodo-novo",
          numero: -1,
          dataInicio: "2026-03-10",
          dataFim: "2026-03-15",
        },
        {
          id: "periodo-depois",
          numero: 2,
          dataInicio: "2026-03-20",
          dataFim: "2026-03-25",
        },
      ];
      const numerosPorId = new Map(
        periodos.map((periodo) => [periodo.id, periodo.numero]),
      );

      mockDb.where.mockReturnValueOnce({ orderBy: mockDb.orderBy });
      mockDb.orderBy.mockResolvedValueOnce(periodos);
      mockDb.update.mockImplementation(() => ({
        set: jest.fn((valores: { numero: number }) => ({
          where: jest.fn(async (condicao: { value: string }) => {
            const id = condicao.value;
            if (
              valores.numero > 0 &&
              Array.from(numerosPorId.entries()).some(
                ([idAtual, numero]) =>
                  idAtual !== id && numero === valores.numero,
              )
            ) {
              throw new Error("violação do índice único");
            }
            numerosPorId.set(id, valores.numero);
          }),
        })),
      }));

      await serviceInterno.renumerarPeriodosSeNecessario(
        "unidade-id",
        "INFANTIL",
      );

      const chamadas = mockDb.update.mock.results.map(
        (resultado: { value: unknown }) => resultado.value,
      );
      expect(chamadas.length).toBe(4);
      expect(Array.from(numerosPorId.values()).sort()).toEqual([1, 2, 3]);
      mockDb.update.mockImplementation(() => mockDb);
    });
  });

  describe("editarPeriodo", () => {
    it("deve validar a data máxima de entrega existente ao editar apenas o início", async () => {
      const periodoExistente = {
        id: "periodo-id",
        unidadeId: "unidade-id",
        etapa: "INFANTIL",
        dataInicio: "2026-03-10",
        dataFim: "2026-03-20",
        dataMaximaEntrega: "2026-03-08",
      };

      jest.spyOn(service, "buscarPorId").mockResolvedValue(periodoExistente as never);

      await expect(
        service.editarPeriodo("periodo-id", "unidade-id", {
          dataInicio: "2026-03-05",
        }),
      ).rejects.toThrow("Data máxima de entrega deve ser anterior ao início do período");

      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("deve bloquear edição quando o período não pertence à unidade informada", async () => {
      jest
        .spyOn(service, "buscarPorId")
        .mockRejectedValue(new BadRequestException("Período não encontrado"));
      mockDb.where
        .mockResolvedValueOnce([
          {
            id: "periodo-id",
            unidadeId: "unidade-1",
            etapa: "INFANTIL",
            dataInicio: "2026-03-01",
            dataFim: "2026-03-15",
          },
        ])
        .mockReturnValueOnce({ returning: mockReturning });
      mockReturning.mockResolvedValueOnce([{ id: "periodo-id" }]);

      await expect(
        service.editarPeriodo("periodo-id", "unidade-2", {
          descricao: "Nova descrição",
        }),
      ).rejects.toThrow("Período não encontrado");

      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });
});
