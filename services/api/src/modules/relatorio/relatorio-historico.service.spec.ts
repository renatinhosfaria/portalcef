// services/api/src/modules/relatorio/relatorio-historico.service.spec.ts

const mockHistoricoEntry = {
  id: "h-1",
  relatorioId: "r-1",
  userId: "u-1",
  userName: "Ana",
  userRole: "analista_pedagogico",
  acao: "SUBMETIDO",
  statusAnterior: null,
  statusNovo: "AGUARDANDO_ANALISTA",
  detalhes: null,
  createdAt: new Date(),
};

const mockFindMany = jest.fn().mockResolvedValue([]);

jest.mock("@essencia/db", () => ({
  getDb: jest.fn().mockReturnValue({
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([mockHistoricoEntry]),
      }),
    }),
    query: {
      relatorioHistorico: { findMany: mockFindMany },
    },
  }),
  eq: jest.fn((col, val) => ({ col, val })),
  desc: jest.fn((col) => col),
  relatorioHistorico: { relatorioId: "relatorioId", createdAt: "createdAt" },
}));

import { RelatorioHistoricoService } from "./relatorio-historico.service";

describe("RelatorioHistoricoService", () => {
  let service: RelatorioHistoricoService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RelatorioHistoricoService();
  });

  describe("registrar", () => {
    it("retorna entry com campos corretos", async () => {
      const entry = await service.registrar({
        relatorioId: "r-1",
        userId: "u-1",
        userName: "Ana",
        userRole: "analista_pedagogico",
        acao: "SUBMETIDO",
        statusAnterior: null,
        statusNovo: "AGUARDANDO_ANALISTA",
      });
      expect(entry.relatorioId).toBe("r-1");
      expect(entry.acao).toBe("SUBMETIDO");
      expect(typeof entry.createdAt).toBe("string"); // ISO string
    });
  });

  describe("buscarPorRelatorio", () => {
    it("retorna array vazio quando não há histórico", async () => {
      const entries = await service.buscarPorRelatorio("r-999");
      expect(Array.isArray(entries)).toBe(true);
      expect(entries).toHaveLength(0);
    });

    it("mapeia entries corretamente quando há histórico", async () => {
      mockFindMany.mockResolvedValueOnce([mockHistoricoEntry]);
      const entries = await service.buscarPorRelatorio("r-1");
      expect(entries).toHaveLength(1);
      expect(entries[0].acao).toBe("SUBMETIDO");
      expect(typeof entries[0].createdAt).toBe("string");
    });
  });
});
