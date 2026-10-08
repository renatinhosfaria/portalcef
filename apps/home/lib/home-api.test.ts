import { clientFetch } from "@essencia/shared/fetchers/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatarDataCivil,
  getTodayCalendarEvents,
} from "./home-api";

vi.mock("@essencia/shared/fetchers/client", () => ({
  clientFetch: vi.fn(),
}));

const clientFetchMock = vi.mocked(clientFetch);

describe("home-api", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T12:00:00-03:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("preserva datas civis da agenda ao filtrar o dia atual", async () => {
    clientFetchMock.mockResolvedValueOnce([
      {
        startDate: "2026-10-05T00:00:00.000Z",
        endDate: "2026-10-05T00:00:00.000Z",
      },
    ]);

    const events = await getTodayCalendarEvents();

    expect(events).toHaveLength(1);
    expect(formatarDataCivil(events[0]?.startDate ?? "")).toBe("05/10/2026");
  });
});
