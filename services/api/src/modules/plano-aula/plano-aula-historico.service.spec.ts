import { Test, TestingModule } from "@nestjs/testing";

import { PlanoAulaHistoricoService } from "./plano-aula-historico.service";

// Mock do @essencia/db
const mockDb = {
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  query: {
    planoAulaHistorico: {
      findMany: jest.fn(),
    },
  },
};

jest.mock("@essencia/db", () => ({
  getDb: jest.fn(() => mockDb),
  planoAulaHistorico: {},
  eq: jest.fn(),
  desc: jest.fn(),
}));

describe("PlanoAulaHistoricoService", () => {
  let service: PlanoAulaHistoricoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlanoAulaHistoricoService],
    }).compile();

    service = module.get<PlanoAulaHistoricoService>(PlanoAulaHistoricoService);

    // Limpar mocks
    jest.clearAllMocks();
  });

  it("deve estar definido", () => {
    expect(service).toBeDefined();
  });

  describe("registrar", () => {
    it("deve inserir uma entrada de histórico", async () => {
      const mockHistoricoEntry = {
        id: "historico-uuid-1",
        planoId: "plano-uuid-1",
        userId: "user-uuid-1",
        userName: "Professora Teste",
        userRole: "professora",
        acao: "CRIADO",
        statusAnterior: null,
        statusNovo: "RASCUNHO",
        detalhes: { observacao: "Plano criado" },
        createdAt: new Date("2026-01-21T10:00:00Z"),
      };

      mockDb.returning.mockResolvedValue([mockHistoricoEntry]);

      const params = {
        planoId: "plano-uuid-1",
        userId: "user-uuid-1",
        userName: "Professora Teste",
        userRole: "professora",
        acao: "CRIADO" as const,
        statusAnterior: null,
        statusNovo: "RASCUNHO",
        detalhes: { observacao: "Plano criado" },
      };

      const resultado = await service.registrar(params);

      expect(resultado).toBeDefined();
      expect(resultado.id).toBe("historico-uuid-1");
      expect(resultado.planoId).toBe("plano-uuid-1");
      expect(resultado.userId).toBe("user-uuid-1");
      expect(resultado.userName).toBe("Professora Teste");
      expect(resultado.userRole).toBe("professora");
      expect(resultado.acao).toBe("CRIADO");
      expect(resultado.statusAnterior).toBeNull();
      expect(resultado.statusNovo).toBe("RASCUNHO");
      expect(resultado.detalhes).toEqual({ observacao: "Plano criado" });
      expect(resultado.createdAt).toBe("2026-01-21T10:00:00.000Z");
      expect(typeof resultado.createdAt).toBe("string");

      // Verificar que métodos foram chamados
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({
        planoId: params.planoId,
        userId: params.userId,
        userName: params.userName,
        userRole: params.userRole,
        acao: params.acao,
        statusAnterior: params.statusAnterior,
        statusNovo: params.statusNovo,
        detalhes: params.detalhes,
      });
      expect(mockDb.returning).toHaveBeenCalled();
    });

    it("deve inserir histórico sem detalhes", async () => {
      const mockHistoricoEntry = {
        id: "historico-uuid-2",
        planoId: "plano-uuid-1",
        userId: "user-uuid-1",
        userName: "Professora Teste",
        userRole: "professora",
        acao: "SUBMETIDO",
        statusAnterior: "RASCUNHO",
        statusNovo: "AGUARDANDO_ANALISTA",
        detalhes: null,
        createdAt: new Date("2026-01-21T11:00:00Z"),
      };

      mockDb.returning.mockResolvedValue([mockHistoricoEntry]);

      const params = {
        planoId: "plano-uuid-1",
        userId: "user-uuid-1",
        userName: "Professora Teste",
        userRole: "professora",
        acao: "SUBMETIDO" as const,
        statusAnterior: "RASCUNHO",
        statusNovo: "AGUARDANDO_ANALISTA",
      };

      const resultado = await service.registrar(params);

      expect(resultado).toBeDefined();
      expect(resultado.detalhes).toBeNull();
      expect(mockDb.values).toHaveBeenCalledWith({
        planoId: params.planoId,
        userId: params.userId,
        userName: params.userName,
        userRole: params.userRole,
        acao: params.acao,
        statusAnterior: params.statusAnterior,
        statusNovo: params.statusNovo,
        detalhes: null,
      });
    });
  });

  describe("buscarPorPlano", () => {
    it("deve buscar histórico ordenado por createdAt DESC", async () => {
      const mockHistoricoEntries = [
        {
          id: "historico-uuid-2",
          planoId: "plano-uuid-1",
          userId: "user-uuid-1",
          userName: "Professora Teste",
          userRole: "professora",
          acao: "SUBMETIDO",
          statusAnterior: "RASCUNHO",
          statusNovo: "AGUARDANDO_ANALISTA",
          detalhes: null,
          createdAt: new Date("2026-01-21T11:00:00Z"),
        },
        {
          id: "historico-uuid-1",
          planoId: "plano-uuid-1",
          userId: "user-uuid-1",
          userName: "Professora Teste",
          userRole: "professora",
          acao: "CRIADO",
          statusAnterior: null,
          statusNovo: "RASCUNHO",
          detalhes: null,
          createdAt: new Date("2026-01-21T10:00:00Z"),
        },
      ];

      mockDb.query.planoAulaHistorico.findMany.mockResolvedValue(mockHistoricoEntries);

      const historico = await service.buscarPorPlano("plano-uuid-1");

      expect(historico).toBeDefined();
      expect(Array.isArray(historico)).toBe(true);
      expect(historico.length).toBe(2);

      // Verificar ordem (mais recente primeiro)
      expect(historico[0].id).toBe("historico-uuid-2");
      expect(historico[1].id).toBe("historico-uuid-1");

      // Verificar estrutura
      const primeiro = historico[0];
      expect(primeiro.id).toBe("historico-uuid-2");
      expect(primeiro.planoId).toBe("plano-uuid-1");
      expect(primeiro.userId).toBe("user-uuid-1");
      expect(primeiro.userName).toBe("Professora Teste");
      expect(primeiro.userRole).toBe("professora");
      expect(primeiro.acao).toBe("SUBMETIDO");
      expect(primeiro.statusNovo).toBe("AGUARDANDO_ANALISTA");
      expect(primeiro.createdAt).toBe("2026-01-21T11:00:00.000Z");
      expect(typeof primeiro.createdAt).toBe("string");

      // Verificar que findMany foi chamado
      expect(mockDb.query.planoAulaHistorico.findMany).toHaveBeenCalled();
    });

    it("deve retornar array vazio para plano sem histórico", async () => {
      mockDb.query.planoAulaHistorico.findMany.mockResolvedValue([]);

      const historico = await service.buscarPorPlano("00000000-0000-0000-0000-999999999999");

      expect(historico).toBeDefined();
      expect(Array.isArray(historico)).toBe(true);
      expect(historico.length).toBe(0);
    });
  });
});
