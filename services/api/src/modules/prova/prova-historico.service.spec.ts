const mockDb = {
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn(),
};

jest.mock("@essencia/db", () => ({
  getDb: jest.fn(() => mockDb),
  provaHistorico: {},
  eq: jest.fn(),
  desc: jest.fn(),
}));

import { ProvaHistoricoService } from "./prova-historico.service";

describe("ProvaHistoricoService", () => {
  type Executor = {
    insert: jest.Mock;
    values: jest.Mock;
    returning: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.returning.mockResolvedValue([
      {
        id: "historico-1",
        provaId: "prova-1",
        userId: "user-1",
        userName: "Usuário",
        userRole: "analista_pedagogico",
        acao: "DOCUMENTO_EXCLUIDO",
        statusAnterior: null,
        statusNovo: "RASCUNHO",
        detalhes: { motivo: "Arquivo enviado incorretamente" },
        createdAt: new Date("2026-06-18T11:00:00.000Z"),
      },
    ]);
  });

  it("registra histórico usando o executor transacional recebido", async () => {
    const executor: Executor = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([
        {
          id: "historico-1",
          provaId: "prova-1",
          userId: "user-1",
          userName: "Usuário",
          userRole: "analista_pedagogico",
          acao: "DOCUMENTO_EXCLUIDO",
          statusAnterior: null,
          statusNovo: "RASCUNHO",
          detalhes: { motivo: "Arquivo enviado incorretamente" },
          createdAt: new Date("2026-06-18T11:00:00.000Z"),
        },
      ]),
    };

    const registrar = new ProvaHistoricoService().registrar.bind(
      new ProvaHistoricoService(),
    ) as unknown as (
      params: Record<string, unknown>,
      executor: Executor,
    ) => Promise<unknown>;

    await registrar(
      {
        provaId: "prova-1",
        userId: "user-1",
        userName: "Usuário",
        userRole: "analista_pedagogico",
        acao: "DOCUMENTO_EXCLUIDO",
        statusAnterior: null,
        statusNovo: "RASCUNHO",
        detalhes: { motivo: "Arquivo enviado incorretamente" },
      },
      executor,
    );

    expect(executor.insert).toHaveBeenCalled();
    expect(executor.values).toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
