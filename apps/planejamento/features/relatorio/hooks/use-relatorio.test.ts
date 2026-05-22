import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRelatorio } from "./use-relatorio";

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();

vi.mock("@essencia/shared/fetchers/client", () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

describe("useRelatorio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue([]);
    mockApiPost.mockResolvedValue({ id: "relatorio-1" });
  });

  it("cria relatório usando turma, semana e semana configurada", async () => {
    const { result } = renderHook(() => useRelatorio());

    await act(async () => {
      await result.current.criarRelatorio(
        "turma-1",
        "semana-roteamento-1",
        "semana-config-1",
      );
    });

    expect(mockApiPost).toHaveBeenCalledWith("/relatorio", {
      turmaId: "turma-1",
      semanaId: "semana-roteamento-1",
      semanaRelatorioId: "semana-config-1",
    });
  });

  it("busca relatório por id no endpoint correto", async () => {
    const { result } = renderHook(() => useRelatorio());

    await act(async () => {
      await result.current.getRelatorio("relatorio-1");
    });

    expect(mockApiGet).toHaveBeenCalledWith("/relatorio/relatorio-1");
  });
});
