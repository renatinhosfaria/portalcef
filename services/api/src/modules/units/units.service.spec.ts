import { ForbiddenException } from "@nestjs/common";

import { getDb } from "@essencia/db";

import { UnitsService } from "./units.service";

jest.mock("@essencia/db", () => ({
  asc: jest.fn(),
  eq: jest.fn((campo: unknown, valor: unknown) => ({ campo, valor })),
  getDb: jest.fn(),
  or: jest.fn(),
  sql: jest.fn(),
  units: {
    id: "units.id",
    schoolId: "units.schoolId",
    name: "units.name",
    code: "units.code",
  },
}));

jest.mock("@essencia/db/schema", () => ({
  units: {
    id: "units.id",
    schoolId: "units.schoolId",
    name: "units.name",
    code: "units.code",
  },
}));

const db = {
  query: {
    units: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
  update: jest.fn(),
  delete: jest.fn(),
};

const diretoraEscolaA = {
  role: "diretora_geral",
  schoolId: "school-a",
  unitId: null,
};

describe("UnitsService", () => {
  beforeEach(() => {
    (getDb as jest.Mock).mockReturnValue(db);
    db.query.units.findFirst.mockReset();
    db.query.units.findMany.mockReset();
    db.update.mockReset();
    db.delete.mockReset();
  });

  it("bloqueia leitura direta de unidade de outra escola", async () => {
    const tenantScope = {
      assertUnitAccess: jest
        .fn()
        .mockRejectedValue(new ForbiddenException("escola diferente")),
    };
    const service = new UnitsService(tenantScope as never);

    await expect(
      service.findById("unit-b", diretoraEscolaA),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tenantScope.assertUnitAccess).toHaveBeenCalledWith(
      diretoraEscolaA,
      "unit-b",
    );
    expect(db.query.units.findFirst).not.toHaveBeenCalled();
  });

  it("retorna unidade da própria escola após validar o escopo", async () => {
    const unit = { id: "unit-a", schoolId: "school-a", name: "Unidade A" };
    const tenantScope = {
      assertUnitAccess: jest.fn().mockResolvedValue(unit),
    };
    const service = new UnitsService(tenantScope as never);

    await expect(service.findById("unit-a", diretoraEscolaA)).resolves.toEqual(
      unit,
    );
    expect(tenantScope.assertUnitAccess).toHaveBeenCalledWith(
      diretoraEscolaA,
      "unit-a",
    );
    expect(db.query.units.findFirst).not.toHaveBeenCalled();
  });

  it("valida todas as unidades antes de retornar uma lista por ids", async () => {
    const units = [
      { id: "unit-a", schoolId: "school-a" },
      { id: "unit-c", schoolId: "school-a" },
    ];
    const tenantScope = {
      assertUnitAccess: jest
        .fn()
        .mockResolvedValueOnce(units[0])
        .mockResolvedValueOnce(units[1]),
    };
    const service = new UnitsService(tenantScope as never);

    await expect(
      service.findByIds(["unit-a", "unit-c"], diretoraEscolaA),
    ).resolves.toEqual(units);
    expect(tenantScope.assertUnitAccess).toHaveBeenCalledTimes(2);
    expect(db.query.units.findMany).not.toHaveBeenCalled();
  });

  it("valida o escopo antes de atualizar e excluir", async () => {
    const unit = { id: "unit-a", schoolId: "school-a" };
    const tenantScope = {
      assertUnitAccess: jest.fn().mockResolvedValue(unit),
    };
    const returning = jest.fn().mockResolvedValue([{ ...unit, name: "Nova" }]);
    const whereUpdate = jest.fn().mockReturnValue({ returning });
    const set = jest.fn().mockReturnValue({ where: whereUpdate });
    const whereDelete = jest.fn().mockResolvedValue(undefined);
    db.update.mockReturnValue({ set });
    db.delete.mockReturnValue({ where: whereDelete });
    const service = new UnitsService(tenantScope as never);

    await expect(
      service.update("unit-a", { name: "Nova" }, diretoraEscolaA),
    ).resolves.toEqual({ ...unit, name: "Nova" });
    await expect(
      service.delete("unit-a", diretoraEscolaA),
    ).resolves.toBeUndefined();
    expect(tenantScope.assertUnitAccess).toHaveBeenCalledTimes(2);
    expect(whereUpdate).toHaveBeenCalled();
    expect(whereDelete).toHaveBeenCalled();
  });
});
