import type { CalendarEvent } from "@essencia/shared/schemas/calendar";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCalendarEvents } from "@/lib/api";

import { useCalendarEvents } from "./use-calendar-events";

vi.mock("@/lib/api", () => ({
  getCalendarEvents: vi.fn(),
}));

const evento = { id: "event-a", title: "Evento" } as CalendarEvent;

describe("useCalendarEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserva a agenda anterior quando um refresh falha", async () => {
    vi.mocked(getCalendarEvents)
      .mockResolvedValueOnce([evento])
      .mockRejectedValueOnce(new Error("Falha de rede"));

    const { result } = renderHook(() =>
      useCalendarEvents({ unitId: "unit-a", year: 2026 }),
    );

    await waitFor(() => expect(result.current.events).toEqual([evento]));

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.events).toEqual([evento]);
    expect(result.current.error).toBe("Falha de rede");
  });
});
