import { describe, expect, it } from "vitest";

import { buildSchoolProvisioningPayload } from "./school-form";

describe("buildSchoolProvisioningPayload", () => {
  it("normaliza os campos antes de enviar o provisionamento", () => {
    expect(
      buildSchoolProvisioningPayload({
        school: { name: "  Escola A ", code: " escola-a " },
        unit: {
          name: " Unidade Centro ",
          code: " centro ",
          address: "  Rua A, 10 ",
          stageIds: ["stage-1"],
        },
        director: {
          name: " Diretora A ",
          email: " diretora@escola.com ",
          password: "senha123",
        },
      }),
    ).toEqual({
      school: { name: "Escola A", code: "escola-a" },
      unit: {
        name: "Unidade Centro",
        code: "centro",
        address: "Rua A, 10",
      },
      stageIds: ["stage-1"],
      director: {
        name: "Diretora A",
        email: "diretora@escola.com",
        password: "senha123",
      },
    });
  });
});
