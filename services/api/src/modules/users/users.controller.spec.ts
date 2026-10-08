import { NotFoundException } from "@nestjs/common";

jest.mock("@essencia/shared/schemas", () => ({
  createUserSchema: {},
  updateUserSchema: {},
}));
jest.mock("@essencia/shared/roles", () => ({
  canViewRole: jest.fn(() => true),
}));
jest.mock("@essencia/shared/types", () => ({
  stageRequiredRoles: [],
}));
jest.mock("../schools/schools.service", () => ({
  SchoolsService: class SchoolsService {},
}));
jest.mock("../units/units.service", () => ({
  UnitsService: class UnitsService {},
}));
jest.mock("./users.service", () => ({
  UsersService: class UsersService {},
}));

import { UsersController } from "./users.controller";

describe("UsersController", () => {
  it("retorna 404 quando o usuário consultado não existe", async () => {
    const usersService = {
      findById: jest.fn().mockResolvedValue(null),
    };
    const schoolsService = {
      findById: jest.fn(),
    };
    const unitsService = {
      findById: jest.fn(),
    };
    const controller = new UsersController(
      usersService as never,
      schoolsService as never,
      unitsService as never,
    );

    await expect(
      controller.findById("usuario-inexistente", {
        userId: "gestora-1",
        role: "diretora_geral",
        schoolId: "escola-1",
        unitId: "unidade-1",
        stageId: null,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(schoolsService.findById).not.toHaveBeenCalled();
    expect(unitsService.findById).not.toHaveBeenCalled();
  });
});
