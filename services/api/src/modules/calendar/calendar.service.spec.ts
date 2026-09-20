import { ForbiddenException } from "@nestjs/common";

import { getDb } from "@essencia/db";

import { CalendarService } from "./calendar.service";

jest.mock("@essencia/db", () => ({
  and: jest.fn(),
  asc: jest.fn(),
  calendarEvents: {
    id: "calendarEvents.id",
    unitId: "calendarEvents.unitId",
    startDate: "calendarEvents.startDate",
    eventType: "calendarEvents.eventType",
  },
  eq: jest.fn((campo: unknown, valor: unknown) => ({ campo, valor })),
  getDb: jest.fn(),
  sql: Object.assign(jest.fn(), { join: jest.fn() }),
  units: {
    id: "units.id",
    schoolId: "units.schoolId",
  },
}));

const db = {
  query: {
    calendarEvents: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    units: {
      findMany: jest.fn(),
    },
  },
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe("CalendarService", () => {
  beforeEach(() => {
    (getDb as jest.Mock).mockReturnValue(db);
    db.query.calendarEvents.findFirst.mockReset();
    db.query.calendarEvents.findMany.mockReset();
    db.query.units.findMany.mockReset();
  });

  it("valida o tenant da unidade ao buscar evento por id", async () => {
    const event = {
      id: "event-b",
      unitId: "unit-b",
      title: "Evento da escola B",
    };
    const tenantScope = {
      assertUnitAccess: jest
        .fn()
        .mockRejectedValue(new ForbiddenException("unidade diferente")),
    };
    const service = new CalendarService(tenantScope as never);
    db.query.calendarEvents.findFirst.mockResolvedValue(event);

    await expect(
      service.getEventById(
        {
          userId: "diretora-a",
          role: "diretora_geral",
          schoolId: "school-a",
          unitId: null,
        },
        "event-b",
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(tenantScope.assertUnitAccess).toHaveBeenCalledWith(
      expect.objectContaining({ schoolId: "school-a" }),
      "unit-b",
    );
  });

  it("bloqueia diretora ao criar evento em outra escola", async () => {
    const tenantScope = {
      assertUnitAccess: jest
        .fn()
        .mockRejectedValue(new ForbiddenException("escola diferente")),
      listUnitIdsForSchool: jest.fn(),
    };
    const service = new CalendarService(tenantScope as never);

    await expect(
      service.createEvent(
        {
          userId: "diretora-a",
          role: "diretora_geral",
          schoolId: "school-a",
          unitId: null,
        },
        { unitId: "unit-b" } as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("não usa unitId da consulta quando a sessão não possui unidade", async () => {
    const tenantScope = {
      assertUnitAccess: jest
        .fn()
        .mockRejectedValue(new ForbiddenException("unidade ausente")),
      listUnitIdsForSchool: jest.fn(),
    };
    const service = new CalendarService(tenantScope as never);

    await expect(
      service.getEvents(
        {
          userId: "professora-sem-unidade",
          role: "professora",
          schoolId: "school-a",
          unitId: null,
        },
        { unitId: "unit-b" } as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.query.calendarEvents.findMany).not.toHaveBeenCalled();
  });

  it("permite diretora consultar duas unidades da própria escola", async () => {
    const tenantScope = {
      assertUnitAccess: jest.fn().mockResolvedValue({}),
      listUnitIdsForSchool: jest.fn().mockResolvedValue(["unit-a", "unit-c"]),
    };
    const service = new CalendarService(tenantScope as never);
    db.query.calendarEvents.findMany.mockResolvedValue([]);

    await expect(
      service.getEvents(
        {
          userId: "diretora-a",
          role: "diretora_geral",
          schoolId: "school-a",
          unitId: null,
        },
        {} as never,
      ),
    ).resolves.toEqual([]);
    expect(tenantScope.listUnitIdsForSchool).toHaveBeenCalledWith("school-a");
    expect(db.query.calendarEvents.findMany).toHaveBeenCalled();
  });
});
