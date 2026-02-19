import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDashboard } from "./use-plano-aula";

const mockApiGet = vi.fn();

vi.mock("@essencia/shared/fetchers/client", () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

describe("useDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve normalizar resposta da API para estatisticas exibidas no dashboard", async () => {
    mockApiGet.mockResolvedValue({
      totais: [
        { status: "RASCUNHO", count: 2 },
        { status: "AGUARDANDO_ANALISTA", count: 3 },
        { status: "REVISAO_ANALISTA", count: 1 },
        { status: "AGUARDANDO_COORDENADORA", count: 4 },
        { status: "DEVOLVIDO_ANALISTA", count: 2 },
        { status: "DEVOLVIDO_COORDENADORA", count: 1 },
        { status: "APROVADO", count: 5 },
      ],
      porSegmento: {
        INFANTIL: [
          { status: "RASCUNHO", count: 1, segmento: "INFANTIL" },
          { status: "APROVADO", count: 2, segmento: "INFANTIL" },
        ],
        FUNDAMENTAL_I: [
          {
            status: "AGUARDANDO_ANALISTA",
            count: 2,
            segmento: "FUNDAMENTAL_I",
          },
          { status: "APROVADO", count: 1, segmento: "FUNDAMENTAL_I" },
        ],
      },
    });

    const { result } = renderHook(() => useDashboard());

    await act(async () => {
      await result.current.fetchDashboard();
    });

    expect(result.current.data).toEqual({
      stats: {
        total: 18,
        rascunho: 2,
        aguardandoAnalista: 4,
        aguardandoCoordenadora: 4,
        devolvidos: 3,
        aprovados: 5,
      },
      porSegmento: {
        INFANTIL: {
          total: 3,
          aprovados: 2,
        },
        FUNDAMENTAL_I: {
          total: 3,
          aprovados: 1,
        },
      },
    });
  });
});
