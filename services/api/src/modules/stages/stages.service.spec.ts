import { BadRequestException, NotFoundException } from "@nestjs/common";

import { getDb } from "@essencia/db";

import { StagesService } from "./stages.service";

jest.mock("@essencia/db", () => ({
  and: jest.fn((...args: unknown[]) => args),
  asc: jest.fn(),
  eq: jest.fn((campo: unknown, valor: unknown) => ({ campo, valor })),
  getDb: jest.fn(),
  inArray: jest.fn((campo: unknown, valores: unknown[]) => ({ campo, valores })),
}));

jest.mock("@essencia/db/schema", () => ({
  educationStages: { id: "educationStages.id", name: "educationStages.name" },
  unitStages: {
    id: "unitStages.id",
    unitId: "unitStages.unitId",
    stageId: "unitStages.stageId",
    isActive: "unitStages.isActive",
  },
}));

const criarDbMock = () => ({
  query: {
    educationStages: { findMany: jest.fn() },
    unitStages: { findMany: jest.fn(), findFirst: jest.fn() },
  },
  update: jest.fn(),
  insert: jest.fn(),
  transaction: jest.fn(),
});

describe("StagesService", () => {
  it("preserva as etapas atuais quando uma etapa informada não existe", async () => {
    const db = criarDbMock();
    db.query.educationStages.findMany.mockResolvedValue([]);
    (getDb as jest.Mock).mockReturnValue(db);
    const service = new StagesService();

    await expect(
      service.replaceUnitStages("unit-1", ["stage-inexistente"]),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("rejeita IDs duplicados antes de iniciar a substituição", async () => {
    const db = criarDbMock();
    (getDb as jest.Mock).mockReturnValue(db);
    const service = new StagesService();

    await expect(
      service.replaceUnitStages("unit-1", ["stage-1", "stage-1"]),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("executa a desativação e a atribuição dentro da mesma transação", async () => {
    const db = criarDbMock();
    const tx = criarDbMock();
    db.query.educationStages.findMany.mockResolvedValue([
      { id: "stage-1" },
      { id: "stage-2" },
    ]);
    tx.update.mockReturnValue({
      set: jest.fn().mockReturnValue({ where: jest.fn() }),
    });
    tx.query.unitStages.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    tx.insert
      .mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ id: "assignment-1" }]),
        }),
      })
      .mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ id: "assignment-2" }]),
        }),
      });
    db.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) =>
      callback(tx),
    );
    (getDb as jest.Mock).mockReturnValue(db);
    const service = new StagesService();

    await expect(
      service.replaceUnitStages("unit-1", ["stage-1", "stage-2"]),
    ).resolves.toEqual([{ id: "assignment-1" }, { id: "assignment-2" }]);

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenCalledTimes(2);
  });
});
