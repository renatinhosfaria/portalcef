import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCalendarStats } from "@/lib/api";

import { useCalendarStats } from "./use-calendar-stats";

vi.mock("@/lib/api", () => ({
  getCalendarStats: vi.fn(),
}));

describe("useCalendarStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("busca estatísticas para a unidade e o ano selecionados", async () => {
    const stats = {
      year: 2027,
      totalSchoolDays: 200,
      totalEvents: 4,
      monthlyStats: [],
    };
    vi.mocked(getCalendarStats).mockResolvedValue(stats);

    const { result } = renderHook(() =>
      useCalendarStats({ unitId: "unit-a", year: 2027 }),
    );

    await waitFor(() => expect(result.current.stats).toEqual(stats));
    expect(getCalendarStats).toHaveBeenCalledWith({
      unitId: "unit-a",
      year: 2027,
    });
    expect(result.current.error).toBeNull();
  });
});
