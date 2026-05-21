jest.mock("@essencia/db", () => ({
  and: jest.fn(),
  asc: jest.fn(),
  eq: jest.fn(),
  getDb: jest.fn(),
}));

jest.mock("@essencia/db/schema", () => ({
  turmas: {},
}));

import { PlanningsController } from "./plannings.controller";
import { PlanningsService } from "./plannings.service";

describe("Plannings legado", () => {
  it("mantém apenas a rota de turmas no controller legado", () => {
    const metodos = Object.getOwnPropertyNames(
      PlanningsController.prototype,
    ).filter((nome) => nome !== "constructor");

    expect(metodos).toEqual(["getTurmas"]);
  });

  it("mantém apenas a consulta de turmas no service legado", () => {
    const metodos = Object.getOwnPropertyNames(
      PlanningsService.prototype,
    ).filter((nome) => nome !== "constructor");

    expect(metodos).toEqual(["getTurmas"]);
  });
});
