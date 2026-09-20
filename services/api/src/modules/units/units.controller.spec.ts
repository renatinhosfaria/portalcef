import { ForbiddenException } from "@nestjs/common";

import { UnitsController } from "./units.controller";

jest.mock("@essencia/shared/schemas", () => ({
  createUnitSchema: { safeParse: jest.fn() },
  updateUnitSchema: { safeParse: jest.fn() },
}));

jest.mock("./units.service", () => ({
  UnitsService: class UnitsService {},
}));

jest.mock("../../common/tenant/tenant-scope.service", () => ({
  TenantScopeService: class TenantScopeService {},
}));

describe("UnitsController", () => {
  it("não retorna unidade de outra escola para diretora", async () => {
    const unitsService = {
      findById: jest.fn().mockResolvedValue({
        id: "unit-b",
        schoolId: "school-b",
        name: "Unidade B",
      }),
    };
    unitsService.findById.mockRejectedValue(
      new ForbiddenException("escola diferente"),
    );
    const controller = new UnitsController(unitsService as never);

    await expect(
      controller.findById("school-a", "unit-b", {
        schoolId: "school-a",
        unitId: null,
        role: "diretora_geral",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(unitsService.findById).toHaveBeenCalledWith(
      "unit-b",
      expect.objectContaining({ schoolId: "school-a", role: "diretora_geral" }),
    );
  });
});
