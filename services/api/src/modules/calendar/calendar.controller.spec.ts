jest.mock("@essencia/shared/schemas", () => ({
  createCalendarEventSchema: { safeParse: jest.fn() },
  updateCalendarEventSchema: { safeParse: jest.fn() },
  queryCalendarEventsSchema: { safeParse: jest.fn() },
  calendarStatsQuerySchema: {
    safeParse: jest.fn((value: { year?: string }) => {
      if (value.year === "abc") {
        return {
          success: false,
          error: { flatten: () => ({ fieldErrors: {} }) },
        };
      }
      return { success: true, data: value };
    }),
  },
}));

jest.mock("@essencia/db", () => ({
  getDb: jest.fn(),
  calendarEvents: {},
  planoAulaPeriodo: {},
  eq: jest.fn(),
  and: jest.fn(),
  or: jest.fn(),
  asc: jest.fn(),
  sql: Object.assign(jest.fn(), { join: jest.fn() }),
}));

import { CalendarController } from "./calendar.controller";

describe("CalendarController", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("usa o ano atual quando a consulta de estatísticas não informa ano", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2027-03-10T12:00:00Z"));
    const calendarService = {
      getStats: jest.fn().mockResolvedValue({}),
    };
    const controller = new CalendarController(calendarService as never);
    const user = {
      userId: "user-a",
      role: "professora",
      schoolId: "school-a",
      unitId: "unit-a",
    };

    await controller.getStats(user, undefined, undefined);

    expect(calendarService.getStats).toHaveBeenCalledWith(
      user,
      undefined,
      2027,
    );
  });

  it("rejeita ano inválido nas estatísticas", async () => {
    const calendarService = { getStats: jest.fn() };
    const controller = new CalendarController(calendarService as never);
    const user = {
      userId: "user-a",
      role: "professora",
      schoolId: "school-a",
      unitId: "unit-a",
    };

    const result = await controller.getStats(user, undefined, "abc");

    expect(result).toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Parâmetros inválidos",
        details: expect.anything(),
      },
    });
    expect(calendarService.getStats).not.toHaveBeenCalled();
  });
});
