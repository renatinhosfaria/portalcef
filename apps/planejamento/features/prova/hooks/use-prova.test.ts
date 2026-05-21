import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGestaoProvas, useProvaDashboard } from "./use-prova";

const mockApiGet = vi.fn();

vi.mock("@essencia/shared/fetchers/client", () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

describe("useGestaoProvas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue({
      data: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      },
    });
  });

  it("envia filtro de ciclo com o nome esperado pela API", async () => {
    const { result } = renderHook(() => useGestaoProvas());

    await act(async () => {
      await result.current.fetchProvas({
        status: "todos",
        provaCicloId: "ciclo-1",
        page: 1,
        limit: 20,
      });
    });

    expect(mockApiGet).toHaveBeenCalledWith(
      expect.stringContaining("cicloId=ciclo-1"),
    );
    expect(mockApiGet).not.toHaveBeenCalledWith(
      expect.stringContaining("provaCicloId=ciclo-1"),
    );
  });
});

describe("useProvaDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue({
      totais: [],
      porSegmento: {},
    });
  });

  it("envia filtro de ciclo com o nome esperado pela API", async () => {
    const { result } = renderHook(() => useProvaDashboard());

    await act(async () => {
      await result.current.fetchDashboard("ciclo-1");
    });

    expect(mockApiGet).toHaveBeenCalledWith(
      expect.stringContaining("cicloId=ciclo-1"),
    );
    expect(mockApiGet).not.toHaveBeenCalledWith(
      expect.stringContaining("provaCicloId=ciclo-1"),
    );
  });
});
