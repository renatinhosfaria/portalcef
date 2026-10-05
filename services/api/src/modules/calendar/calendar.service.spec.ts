import { BadRequestException, ForbiddenException } from "@nestjs/common";

import { getDb } from "@essencia/db";

import { CalendarService } from "./calendar.service";

jest.mock("@essencia/db", () => ({
  and: jest.fn(),
  asc: jest.fn(),
  calendarEvents: {
    id: "calendarEvents.id",
    unitId: "calendarEvents.unitId",
    startDate: "calendarEvents.startDate",
    endDate: "calendarEvents.endDate",
    eventType: "calendarEvents.eventType",
    isSchoolDay: "calendarEvents.isSchoolDay",
    isRecurringAnnually: "calendarEvents.isRecurringAnnually",
  },
  eq: jest.fn((campo: unknown, valor: unknown) => ({ campo, valor })),
  or: jest.fn((...filters: unknown[]) => ({ or: filters })),
  getDb: jest.fn(),
  sql: Object.assign(
    jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings: Array.from(strings),
      values,
    })),
    { join: jest.fn() },
  ),
  planoAulaPeriodo: {
    id: "planoAulaPeriodo.id",
    unidadeId: "planoAulaPeriodo.unidadeId",
  },
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
    planoAulaPeriodo: {
      findFirst: jest.fn(),
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
    db.query.planoAulaPeriodo.findFirst.mockReset();
    db.query.units.findMany.mockReset();
    db.update.mockReset();
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

  it("calcula dias letivos únicos sem contar fins de semana", async () => {
    const tenantScope = {
      assertUnitAccess: jest.fn().mockResolvedValue({}),
      listUnitIdsForSchool: jest.fn(),
    };
    const service = new CalendarService(tenantScope as never);
    db.query.calendarEvents.findMany.mockResolvedValue([
      {
        id: "event-block-before",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-04"),
        eventType: "FERIADO",
        isSchoolDay: false,
      },
      {
        id: "event-school-a",
        startDate: new Date("2026-01-05"),
        endDate: new Date("2026-01-07"),
        eventType: "DIA_LETIVO",
        isSchoolDay: true,
      },
      {
        id: "event-school-b",
        startDate: new Date("2026-01-06"),
        endDate: new Date("2026-01-10"),
        eventType: "DIA_LETIVO",
        isSchoolDay: true,
      },
      {
        id: "event-block-after",
        startDate: new Date("2026-01-09"),
        endDate: new Date("2026-12-31"),
        eventType: "FERIAS_PROFESSORES",
        isSchoolDay: false,
      },
    ]);

    const stats = await service.getStats(
      {
        userId: "professora-a",
        role: "professora",
        schoolId: "school-a",
        unitId: "unit-a",
      },
      undefined,
      2026,
    );

    expect(stats.totalSchoolDays).toBe(4);
    expect(stats.monthlyStats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ month: 1, schoolDays: 4, events: 4 }),
      ]),
    );
  });

  it("projeta eventos recorrentes para o ano consultado", async () => {
    const tenantScope = {
      assertUnitAccess: jest.fn().mockResolvedValue({}),
      listUnitIdsForSchool: jest.fn(),
    };
    const service = new CalendarService(tenantScope as never);
    db.query.calendarEvents.findMany.mockResolvedValue([
      {
        id: "event-recorrente",
        unitId: "unit-a",
        title: "Independência",
        description: null,
        eventType: "FERIADO",
        startDate: "2026-09-07",
        endDate: "2026-09-07",
        isSchoolDay: false,
        isRecurringAnnually: true,
      },
    ]);

    const events = await service.getEvents(
      {
        userId: "professora-a",
        role: "professora",
        schoolId: "school-a",
        unitId: "unit-a",
      },
      { year: 2027, month: 9 },
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.startDate).toEqual(new Date(2027, 8, 7));
    expect(events[0]?.endDate).toEqual(new Date(2027, 8, 7));
  });

  it("mantém evento que começou no ano anterior ao consultar janeiro", async () => {
    const tenantScope = {
      assertUnitAccess: jest.fn().mockResolvedValue({}),
      listUnitIdsForSchool: jest.fn(),
    };
    const service = new CalendarService(tenantScope as never);
    db.query.calendarEvents.findMany.mockResolvedValue([
      {
        id: "event-virada",
        unitId: "unit-a",
        title: "Recesso de virada",
        description: null,
        eventType: "RECESSO",
        startDate: "2026-12-28",
        endDate: "2027-01-05",
        isSchoolDay: false,
        isRecurringAnnually: false,
      },
    ]);

    const events = await service.getEvents(
      {
        userId: "professora-a",
        role: "professora",
        schoolId: "school-a",
        unitId: "unit-a",
      },
      { year: 2027, month: 1 },
    );

    expect(events).toHaveLength(1);
  });

  it("projeta recorrência que atravessa a virada do ano", async () => {
    const tenantScope = {
      assertUnitAccess: jest.fn().mockResolvedValue({}),
      listUnitIdsForSchool: jest.fn(),
    };
    const service = new CalendarService(tenantScope as never);
    db.query.calendarEvents.findMany.mockResolvedValue([
      {
        id: "event-recesso-recorrente",
        unitId: "unit-a",
        title: "Recesso de fim de ano",
        description: null,
        eventType: "RECESSO",
        startDate: "2026-12-20",
        endDate: "2027-01-10",
        isSchoolDay: false,
        isRecurringAnnually: true,
      },
    ]);

    const events = await service.getEvents(
      {
        userId: "professora-a",
        role: "professora",
        schoolId: "school-a",
        unitId: "unit-a",
      },
      { year: 2027, month: 1 },
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.startDate).toEqual(new Date(2026, 11, 20));
    expect(events[0]?.endDate).toEqual(new Date(2027, 0, 10));
  });

  it("rejeita atualização parcial que deixa o intervalo inválido", async () => {
    const tenantScope = {
      assertUnitAccess: jest.fn().mockResolvedValue({}),
      listUnitIdsForSchool: jest.fn(),
    };
    const service = new CalendarService(tenantScope as never);
    db.query.calendarEvents.findFirst.mockResolvedValue({
      id: "event-a",
      unitId: "unit-a",
      title: "Evento",
      startDate: new Date("2026-01-10"),
      endDate: new Date("2026-01-20"),
    });

    await expect(
      service.updateEvent(
        {
          userId: "coordenadora-a",
          role: "coordenadora_geral",
          schoolId: "school-a",
          unitId: "unit-a",
        },
        "event-a",
        { startDate: new Date("2026-01-21") } as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(db.update).not.toHaveBeenCalled();
  });

  it("valida uma quinzena usando o período e o calendário da unidade", async () => {
    const tenantScope = {
      assertUnitAccess: jest.fn().mockResolvedValue({}),
      listUnitIdsForSchool: jest.fn(),
    };
    const service = new CalendarService(tenantScope as never);
    db.query.planoAulaPeriodo.findFirst.mockResolvedValue({
      id: "periodo-a",
      unidadeId: "unit-a",
      dataInicio: "2026-01-05",
      dataFim: "2026-01-18",
    });
    db.query.calendarEvents.findMany.mockResolvedValue([
      {
        title: "Feriado",
        startDate: "2026-01-12",
        endDate: "2026-01-12",
        eventType: "FERIADO",
        isSchoolDay: false,
      },
    ]);

    const result = await service.validateQuinzenaSchoolDays(
      "unit-a",
      "periodo-a",
    );

    expect(result.totalDays).toBe(14);
    expect(result.schoolDays).toBe(9);
    expect(result.isValid).toBe(true);
    expect(result.nonSchoolDays).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: "2026-01-12", reason: "Feriado" }),
      ]),
    );
  });

  it("considera feriado recorrente na validação da quinzena", async () => {
    const tenantScope = {
      assertUnitAccess: jest.fn().mockResolvedValue({}),
      listUnitIdsForSchool: jest.fn(),
    };
    const service = new CalendarService(tenantScope as never);
    db.query.planoAulaPeriodo.findFirst.mockResolvedValue({
      id: "periodo-b",
      unidadeId: "unit-a",
      dataInicio: "2027-01-04",
      dataFim: "2027-01-10",
    });
    db.query.calendarEvents.findMany.mockResolvedValue([
      {
        title: "Feriado recorrente",
        startDate: "2026-01-06",
        endDate: "2026-01-06",
        eventType: "FERIADO",
        isSchoolDay: false,
        isRecurringAnnually: true,
      },
    ]);

    const result = await service.validateQuinzenaSchoolDays(
      "unit-a",
      "periodo-b",
    );

    expect(result.schoolDays).toBe(4);
    expect(result.nonSchoolDays).toEqual(
      expect.arrayContaining([expect.objectContaining({ date: "2027-01-06" })]),
    );
  });
});
