import { Test, TestingModule } from "@nestjs/testing";
import { DatabaseService } from "../../common/database/database.service";
import { StorageService } from "../../common/storage/storage.service";
import { WorkflowsLimpezaService } from "./workflows-limpeza.service";

jest.mock("@essencia/db", () => ({
  asc: jest.fn((campo: unknown) => ({ campo })),
  eq: jest.fn((campo: unknown, valor: unknown) => ({ campo, valor })),
  workflowLimpeza: {
    id: "workflowLimpeza.id",
    storageKey: "workflowLimpeza.storageKey",
    createdAt: "workflowLimpeza.createdAt",
  },
}));

const tabela = jest.requireMock("@essencia/db").workflowLimpeza;

type Chain = {
  from: jest.Mock;
  orderBy: jest.Mock;
  limit: jest.Mock;
  for: jest.Mock;
};

function criarChain(resultado: unknown[] = []): Chain {
  const chain = {
    from: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    for: jest.fn(),
  } as unknown as Chain;
  chain.from.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.for.mockResolvedValue(resultado);
  return chain;
}

describe("WorkflowsLimpezaService", () => {
  let service: WorkflowsLimpezaService;
  const storage = { deleteFileStrict: jest.fn() };
  const db = {
    insert: jest.fn(),
    values: jest.fn(),
    onConflictDoNothing: jest.fn(),
    transaction: jest.fn(),
    select: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    set: jest.fn(),
    where: jest.fn(),
  };
  const tx = {
    insert: jest.fn(),
    values: jest.fn(),
    onConflictDoNothing: jest.fn(),
    select: jest.fn(),
    delete: jest.fn(),
    where: jest.fn(),
    update: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    db.insert.mockReturnValue(db);
    db.values.mockReturnValue(db);
    db.onConflictDoNothing.mockResolvedValue(undefined);
    tx.insert.mockReturnValue(tx);
    tx.values.mockReturnValue(tx);
    tx.onConflictDoNothing.mockResolvedValue(undefined);
    tx.delete.mockReturnValue(tx);
    tx.where.mockResolvedValue(undefined);
    tx.update.mockReturnValue(tx);
    tx.set.mockReturnValue(tx);
    db.transaction.mockImplementation(
      async (cb: (executor: typeof tx) => unknown) => cb(tx),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsLimpezaService,
        { provide: DatabaseService, useValue: { db } },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    service = module.get(WorkflowsLimpezaService);
  });

  it("enfileira chaves de forma idempotente no executor informado", async () => {
    await service.enfileirar(["a.pdf", "b.pdf"], tx as never);

    expect(tx.insert).toHaveBeenCalledWith(tabela);
    expect(tx.values).toHaveBeenCalledWith([
      { storageKey: "a.pdf", tentativas: 0 },
      { storageKey: "b.pdf", tentativas: 0 },
    ]);
    expect(tx.onConflictDoNothing).toHaveBeenCalled();
  });

  it("confirma a exclusao no storage antes de remover item da fila", async () => {
    const chain = criarChain([
      { id: "fila-1", storageKey: "a.pdf", tentativas: 0 },
    ]);
    tx.select.mockReturnValue(chain);
    storage.deleteFileStrict.mockResolvedValue(undefined);

    await service.processarPendentes();

    expect(chain.for).toHaveBeenCalledWith("update", { skipLocked: true });
    expect(storage.deleteFileStrict).toHaveBeenCalledWith("a.pdf");
    expect(tx.delete).toHaveBeenCalledWith(tabela);
    expect(tx.where).toHaveBeenCalled();
  });

  it("mantem item e registra erro quando storage falha", async () => {
    const chain = criarChain([
      { id: "fila-1", storageKey: "a.pdf", tentativas: 2 },
    ]);
    tx.select.mockReturnValue(chain);
    storage.deleteFileStrict.mockRejectedValue(
      new Error("storage indisponivel"),
    );

    await service.processarPendentes();

    expect(tx.delete).not.toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalledWith(tabela);
    expect(tx.set).toHaveBeenCalledWith({
      tentativas: 3,
      ultimoErro: "storage indisponivel",
    });
  });
});
