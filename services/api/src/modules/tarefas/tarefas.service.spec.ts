import { Test, TestingModule } from "@nestjs/testing";
import { DatabaseService } from "../../common/database/database.service";
import { TarefasService } from "./tarefas.service";

// Mock do @essencia/db
const mockDb = {
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  query: {
    tarefas: {
      findFirst: jest.fn(),
    },
  },
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
};

jest.mock("@essencia/db", () => ({
  tarefas: {},
  tarefaContextos: {},
  eq: jest.fn(),
  and: jest.fn(),
}));

describe("TarefasService", () => {
  let service: TarefasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TarefasService,
        {
          provide: DatabaseService,
          useValue: {
            db: mockDb,
          },
        },
      ],
    }).compile();

    service = module.get<TarefasService>(TarefasService);

    // Limpar mocks
    jest.clearAllMocks();
  });

  it("deve estar definido", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("deve criar uma tarefa com contextos", async () => {
      const mockTarefaDb = {
        id: "tarefa-uuid-1",
        schoolId: "school-uuid-1",
        unitId: "unit-uuid-1",
        titulo: "Revisar planejamento da quinzena 2026-01",
        descricao: "Revisar e aprovar planejamentos pendentes",
        status: "PENDENTE",
        prioridade: "ALTA",
        prazo: new Date("2026-01-25T23:59:59Z"),
        criadoPor: "user-uuid-1",
        responsavel: "user-uuid-2",
        tipoOrigem: "AUTOMATICA",
        createdAt: new Date("2026-01-21T10:00:00Z"),
        updatedAt: new Date("2026-01-21T10:00:00Z"),
        concluidaEm: null,
      };

      // Mock para inserção da tarefa e contexto
      mockDb.returning.mockResolvedValue([mockTarefaDb]);

      const params = {
        schoolId: "school-uuid-1",
        unitId: "unit-uuid-1",
        titulo: "Revisar planejamento da quinzena 2026-01",
        descricao: "Revisar e aprovar planejamentos pendentes",
        prioridade: "ALTA" as const,
        prazo: new Date("2026-01-25T23:59:59Z"),
        criadoPor: "user-uuid-1",
        responsavel: "user-uuid-2",
        tipoOrigem: "AUTOMATICA" as const,
        contextos: [
          {
            modulo: "PLANEJAMENTO" as const,
            quinzenaId: "2026-01",
            etapaId: "etapa-uuid-1",
            professoraId: "user-uuid-3",
          },
        ],
      };

      const resultado = await service.create(params);

      expect(resultado).toBeDefined();
      expect(resultado.id).toBe("tarefa-uuid-1");
      expect(resultado.titulo).toBe("Revisar planejamento da quinzena 2026-01");
      expect(resultado.status).toBe("PENDENTE");
      expect(resultado.prioridade).toBe("ALTA");
      expect(resultado.prazo).toBe("2026-01-25T23:59:59.000Z");
      expect(typeof resultado.prazo).toBe("string");
      expect(resultado.createdAt).toBe("2026-01-21T10:00:00.000Z");
      expect(typeof resultado.createdAt).toBe("string");
      expect(resultado.concluidaEm).toBeNull();

      // Verificar que insert foi chamado 2 vezes (tarefa + contexto)
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
      expect(mockDb.values).toHaveBeenCalledTimes(2);
      expect(mockDb.returning).toHaveBeenCalled();
    });

    it("deve criar tarefa sem contextos", async () => {
      const mockTarefaDb = {
        id: "tarefa-uuid-2",
        schoolId: "school-uuid-1",
        unitId: null,
        titulo: "Tarefa manual simples",
        descricao: null,
        status: "PENDENTE",
        prioridade: "BAIXA",
        prazo: new Date("2026-02-01T23:59:59Z"),
        criadoPor: "user-uuid-1",
        responsavel: "user-uuid-1",
        tipoOrigem: "MANUAL",
        createdAt: new Date("2026-01-21T11:00:00Z"),
        updatedAt: new Date("2026-01-21T11:00:00Z"),
        concluidaEm: null,
      };

      mockDb.returning.mockResolvedValueOnce([mockTarefaDb]);

      const params = {
        schoolId: "school-uuid-1",
        unitId: null,
        titulo: "Tarefa manual simples",
        descricao: null,
        prioridade: "BAIXA" as const,
        prazo: new Date("2026-02-01T23:59:59Z"),
        criadoPor: "user-uuid-1",
        responsavel: "user-uuid-1",
        tipoOrigem: "MANUAL" as const,
        contextos: [],
      };

      const resultado = await service.create(params);

      expect(resultado).toBeDefined();
      expect(resultado.id).toBe("tarefa-uuid-2");
      expect(resultado.tipoOrigem).toBe("MANUAL");
      expect(resultado.descricao).toBeNull();

      // Apenas 1 insert (tarefa)
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it("deve lançar erro se tarefa não for criada", async () => {
      // Resetar mock e configurar para retornar array vazio
      jest.clearAllMocks();
      mockDb.returning.mockResolvedValue([]);

      const params = {
        schoolId: "school-uuid-1",
        unitId: "unit-uuid-1",
        titulo: "Tarefa teste",
        descricao: null,
        prioridade: "MEDIA" as const,
        prazo: new Date("2026-01-30T23:59:59Z"),
        criadoPor: "user-uuid-1",
        responsavel: "user-uuid-2",
        tipoOrigem: "MANUAL" as const,
        contextos: [],
      };

      await expect(service.create(params)).rejects.toThrow(
        "Falha ao criar tarefa"
      );
    });
  });

  describe("findById", () => {
    it("deve buscar tarefa por ID", async () => {
      const mockTarefaDb = {
        id: "tarefa-uuid-1",
        schoolId: "school-uuid-1",
        unitId: "unit-uuid-1",
        titulo: "Revisar planejamento",
        descricao: "Descrição da tarefa",
        status: "PENDENTE",
        prioridade: "ALTA",
        prazo: new Date("2026-01-25T23:59:59Z"),
        criadoPor: "user-uuid-1",
        responsavel: "user-uuid-2",
        tipoOrigem: "AUTOMATICA",
        createdAt: new Date("2026-01-21T10:00:00Z"),
        updatedAt: new Date("2026-01-21T10:00:00Z"),
        concluidaEm: null,
      };

      mockDb.query.tarefas.findFirst.mockResolvedValue(mockTarefaDb);

      const resultado = await service.findById("tarefa-uuid-1");

      expect(resultado).toBeDefined();
      expect(resultado?.id).toBe("tarefa-uuid-1");
      expect(resultado?.titulo).toBe("Revisar planejamento");
      expect(resultado?.status).toBe("PENDENTE");
      expect(resultado?.prazo).toBe("2026-01-25T23:59:59.000Z");
      expect(typeof resultado?.prazo).toBe("string");

      expect(mockDb.query.tarefas.findFirst).toHaveBeenCalled();
    });

    it("deve retornar null se tarefa não existir", async () => {
      mockDb.query.tarefas.findFirst.mockResolvedValue(null);

      const resultado = await service.findById("00000000-0000-0000-0000-999999999999");

      expect(resultado).toBeNull();
    });
  });

  describe("concluir", () => {
    it("deve concluir tarefa quando usuário é responsável", async () => {
      const mockTarefaDb = {
        id: "tarefa-uuid-1",
        schoolId: "school-uuid-1",
        unitId: "unit-uuid-1",
        titulo: "Revisar planejamento",
        descricao: null,
        status: "PENDENTE",
        prioridade: "ALTA",
        prazo: new Date("2026-01-25T23:59:59Z"),
        criadoPor: "user-uuid-1",
        responsavel: "user-uuid-2",
        tipoOrigem: "AUTOMATICA",
        createdAt: new Date("2026-01-21T10:00:00Z"),
        updatedAt: new Date("2026-01-21T10:00:00Z"),
        concluidaEm: null,
      };

      const mockTarefaAtualizada = {
        ...mockTarefaDb,
        status: "CONCLUIDA",
        concluidaEm: new Date("2026-01-22T14:30:00Z"),
        updatedAt: new Date("2026-01-22T14:30:00Z"),
      };

      mockDb.query.tarefas.findFirst.mockResolvedValue(mockTarefaDb);

      // Reset and configure mock chain for update operation
      jest.clearAllMocks();
      mockDb.update.mockReturnThis();
      mockDb.set.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.returning.mockResolvedValue([mockTarefaAtualizada]);
      mockDb.query.tarefas.findFirst.mockResolvedValue(mockTarefaDb);

      const resultado = await service.concluir("tarefa-uuid-1", "user-uuid-2");

      expect(resultado).toBeDefined();
      expect(resultado.status).toBe("CONCLUIDA");
      expect(resultado.concluidaEm).toBe("2026-01-22T14:30:00.000Z");
      expect(typeof resultado.concluidaEm).toBe("string");

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.returning).toHaveBeenCalled();
    });

    it("deve lançar erro se tarefa não existir", async () => {
      mockDb.query.tarefas.findFirst.mockResolvedValue(null);

      await expect(
        service.concluir("00000000-0000-0000-0000-999999999999", "user-uuid-1")
      ).rejects.toThrow("Tarefa não encontrada");
    });

    it("deve lançar erro se usuário não for responsável", async () => {
      const mockTarefaDb = {
        id: "tarefa-uuid-1",
        schoolId: "school-uuid-1",
        unitId: "unit-uuid-1",
        titulo: "Revisar planejamento",
        descricao: null,
        status: "PENDENTE",
        prioridade: "ALTA",
        prazo: new Date("2026-01-25T23:59:59Z"),
        criadoPor: "user-uuid-1",
        responsavel: "user-uuid-2",
        tipoOrigem: "AUTOMATICA",
        createdAt: new Date("2026-01-21T10:00:00Z"),
        updatedAt: new Date("2026-01-21T10:00:00Z"),
        concluidaEm: null,
      };

      mockDb.query.tarefas.findFirst.mockResolvedValue(mockTarefaDb);

      await expect(
        service.concluir("tarefa-uuid-1", "user-uuid-999")
      ).rejects.toThrow("Usuário não é responsável pela tarefa");
    });

    it("deve lançar erro se tarefa já estiver concluída", async () => {
      const mockTarefaDb = {
        id: "tarefa-uuid-1",
        schoolId: "school-uuid-1",
        unitId: "unit-uuid-1",
        titulo: "Revisar planejamento",
        descricao: null,
        status: "CONCLUIDA",
        prioridade: "ALTA",
        prazo: new Date("2026-01-25T23:59:59Z"),
        criadoPor: "user-uuid-1",
        responsavel: "user-uuid-2",
        tipoOrigem: "AUTOMATICA",
        createdAt: new Date("2026-01-21T10:00:00Z"),
        updatedAt: new Date("2026-01-21T10:00:00Z"),
        concluidaEm: new Date("2026-01-22T14:30:00Z"),
      };

      mockDb.query.tarefas.findFirst.mockResolvedValue(mockTarefaDb);

      await expect(
        service.concluir("tarefa-uuid-1", "user-uuid-2")
      ).rejects.toThrow("Tarefa já foi concluída");
    });
  });
});
