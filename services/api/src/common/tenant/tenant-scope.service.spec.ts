import { ForbiddenException, NotFoundException } from "@nestjs/common";

import { getDb } from "@essencia/db";

import { TenantScopeService } from "./tenant-scope.service";

jest.mock("@essencia/db", () => ({
  eq: jest.fn((campo: unknown, valor: unknown) => ({ campo, valor })),
  getDb: jest.fn(),
  units: {
    id: "units.id",
    schoolId: "units.schoolId",
  },
}));

const db = {
  query: {
    units: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
};

const master = {
  role: "master",
  schoolId: null,
  unitId: null,
};

const diretoraEscolaA = {
  role: "diretora_geral",
  schoolId: "school-a",
  unitId: null,
};

describe("TenantScopeService", () => {
  let service: TenantScopeService;

  beforeEach(() => {
    (getDb as jest.Mock).mockReturnValue(db);
    db.query.units.findFirst.mockReset();
    db.query.units.findMany.mockReset();
    service = new TenantScopeService();
  });

  it("bloqueia diretora ao acessar unidade de outra escola", async () => {
    db.query.units.findFirst.mockResolvedValue({
      id: "unit-b",
      schoolId: "school-b",
    });

    await expect(
      service.assertUnitAccess(diretoraEscolaA, "unit-b"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("permite diretora acessar unidade da própria escola", async () => {
    db.query.units.findFirst.mockResolvedValue({
      id: "unit-a",
      schoolId: "school-a",
    });

    await expect(
      service.assertUnitAccess(diretoraEscolaA, "unit-a"),
    ).resolves.toEqual({ id: "unit-a", schoolId: "school-a" });
  });

  it("permite master acessar unidade existente", async () => {
    db.query.units.findFirst.mockResolvedValue({
      id: "unit-b",
      schoolId: "school-b",
    });

    await expect(service.assertUnitAccess(master, "unit-b")).resolves.toEqual({
      id: "unit-b",
      schoolId: "school-b",
    });
  });

  it("falha fechado quando a unidade não existe", async () => {
    db.query.units.findFirst.mockResolvedValue(null);

    await expect(
      service.assertUnitAccess(diretoraEscolaA, "unit-inexistente"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("exige unidade da sessão para perfis restritos", async () => {
    await expect(
      service.assertUnitAccess(
        {
          role: "professora",
          schoolId: "school-a",
          unitId: null,
        },
        "unit-a",
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("falha fechado quando a sessão não possui escola", async () => {
    db.query.units.findFirst.mockResolvedValue({
      id: "unit-a",
      schoolId: "school-a",
    });

    await expect(
      service.assertUnitAccess(
        {
          role: "diretora_geral",
          schoolId: null,
          unitId: null,
        },
        "unit-a",
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.query.units.findFirst).not.toHaveBeenCalled();
  });
});
