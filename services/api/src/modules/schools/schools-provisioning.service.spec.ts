import { getDb } from "@essencia/db";

import { SchoolsProvisioningService } from "./schools-provisioning.service";

jest.mock("bcrypt", () => ({ hash: jest.fn().mockResolvedValue("hash") }));

jest.mock("@essencia/shared/schemas", () => ({
  createSchoolProvisioningSchema: { parse: (value: unknown) => value },
}));

jest.mock("@essencia/db", () => ({
  and: jest.fn(),
  asc: jest.fn(),
  eq: jest.fn((campo: unknown, valor: unknown) => ({ campo, valor })),
  getDb: jest.fn(),
  inArray: jest.fn(),
  sql: jest.fn(),
}));

jest.mock("@essencia/db/schema", () => ({
  educationStages: { id: "educationStages.id" },
  schools: { code: "schools.code" },
  units: { schoolId: "units.schoolId", code: "units.code" },
  unitStages: {},
  users: {},
}));

const dados = {
  school: { name: "Escola A", code: "escola-a" },
  unit: { name: "Unidade A", code: "unidade-a", address: "Rua A" },
  stageIds: ["11111111-1111-4111-8111-111111111111"],
  director: {
    name: "Diretora A",
    email: "diretora@example.com",
    password: "senha-123",
  },
};

describe("SchoolsProvisioningService", () => {
  it("cria escola, unidade, etapas e diretora na mesma transação", async () => {
    const db = {
      query: {
        schools: { findFirst: jest.fn().mockResolvedValue(null) },
        users: { findFirst: jest.fn().mockResolvedValue(null) },
        educationStages: {
          findMany: jest.fn().mockResolvedValue([{ id: dados.stageIds[0] }]),
        },
      },
      transaction: jest.fn(),
    };
    const tx = {
      insert: jest.fn(),
    };
    tx.insert
      .mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ id: "school-1", ...dados.school }]),
        }),
      })
      .mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ id: "unit-1", ...dados.unit }]),
        }),
      })
      .mockReturnValueOnce({ values: jest.fn().mockResolvedValue(undefined) })
      .mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ id: "director-1" }]),
        }),
      });
    db.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) =>
      callback(tx),
    );
    (getDb as jest.Mock).mockReturnValue(db);
    const service = new SchoolsProvisioningService();

    await expect(service.create(dados)).resolves.toEqual(
      expect.objectContaining({
        school: expect.objectContaining({ id: "school-1" }),
        unit: expect.objectContaining({ id: "unit-1" }),
        director: expect.objectContaining({ id: "director-1" }),
      }),
    );
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenCalledTimes(4);
  });

  it("propaga falha da transação sem retornar um cadastro parcial", async () => {
    const db = {
      query: {
        schools: { findFirst: jest.fn().mockResolvedValue(null) },
        users: { findFirst: jest.fn().mockResolvedValue(null) },
        educationStages: { findMany: jest.fn().mockResolvedValue([]) },
      },
      transaction: jest.fn().mockRejectedValue(new Error("falha ao criar diretora")),
    };
    (getDb as jest.Mock).mockReturnValue(db);
    const service = new SchoolsProvisioningService();

    await expect(service.create({ ...dados, stageIds: [] })).rejects.toThrow(
      "falha ao criar diretora",
    );
  });
});
