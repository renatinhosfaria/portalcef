import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useHistorico } from "./use-historico";

const mockApiGet = vi.fn();

vi.mock("@essencia/shared/fetchers/client", () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

describe("useHistorico", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue([]);
  });

  it("busca o histórico da prova pelo endpoint de prova", async () => {
    renderHook(() => useHistorico("prova-1", "prova"));

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/prova/prova-1/historico");
    });

    expect(mockApiGet).not.toHaveBeenCalledWith(
      "/plano-aula/prova-1/historico",
    );
  });

  it("busca o histórico do relatório pelo endpoint de relatório", async () => {
    renderHook(() => useHistorico("relatorio-1", "relatorio"));

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        "/relatorio/relatorio-1/historico",
      );
    });

    expect(mockApiGet).not.toHaveBeenCalledWith(
      "/plano-aula/relatorio-1/historico",
    );
  });
});
