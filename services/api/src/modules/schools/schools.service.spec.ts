import { getDb } from "@essencia/db";
import { ConflictException } from "@nestjs/common";

import { SchoolsService } from "./schools.service";

jest.mock("@essencia/db", () => ({
  asc: jest.fn(),
  eq: jest.fn(),
  getDb: jest.fn(),
  or: jest.fn(),
  sql: jest.fn(),
}));

jest.mock("@essencia/db/schema", () => ({
  schools: { id: "schools.id", name: "schools.name" },
  units: { schoolId: "units.schoolId" },
}));

describe("SchoolsService", () => {
  it("calcula a quantidade de unidades em uma consulta agregada", async () => {
    const db = {
      query: {
        schools: { findMany: jest.fn() },
        units: { findMany: jest.fn() },
      },
    };
    db.query.schools.findMany.mockResolvedValue([
      { id: "school-1", name: "Escola A" },
      { id: "school-2", name: "Escola B" },
    ]);
    db.query.units.findMany.mockResolvedValue([
      { schoolId: "school-1" },
      { schoolId: "school-1" },
      { schoolId: "school-2" },
    ]);
    (getDb as jest.Mock).mockReturnValue(db);

    await expect(new SchoolsService().findAllWithUnitCounts()).resolves.toEqual([
      { id: "school-1", name: "Escola A", unitsCount: 2 },
      { id: "school-2", name: "Escola B", unitsCount: 1 },
    ]);

    expect(db.query.units.findMany).toHaveBeenCalledTimes(1);
  });

  it("transforma violação de dependência em conflito compreensível", async () => {
    const db = {
      query: {
        schools: { findMany: jest.fn(), findFirst: jest.fn() },
        units: { findMany: jest.fn() },
      },
      delete: jest.fn().mockReturnValue({
        where: jest.fn().mockRejectedValue({ code: "23503" }),
      }),
    };
    db.query.schools.findFirst.mockResolvedValue({ id: "school-1" });
    (getDb as jest.Mock).mockReturnValue(db);

    await expect(new SchoolsService().delete("school-1")).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
