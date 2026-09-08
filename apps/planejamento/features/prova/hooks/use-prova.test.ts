import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGestaoProvas, useProva, useProvaDashboard } from "./use-prova";

const mockApiGet = vi.fn();
const mockApiDelete = vi.fn();

vi.mock("@essencia/shared/fetchers/client", () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
  },
}));

describe("useProva", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiDelete.mockResolvedValue(undefined);
  });

  it("envia o motivo no corpo ao excluir documento", async () => {
    const { result } = renderHook(() => useProva());
    const motivo = "Arquivo enviado com conteúdo incorreto";

    await act(async () => {
      await result.current.deleteDocumento("prova-1", "doc-1", motivo);
    });

    expect(mockApiDelete).toHaveBeenCalledWith(
      "/prova/prova-1/documentos/doc-1",
      { body: { motivo } },
    );
  });

  it("guarda e relança mensagem amigável quando o documento já foi aprovado", async () => {
    mockApiDelete.mockRejectedValueOnce({
      status: 400,
      error: {
        code: "DOCUMENTO_APROVADO",
        message: "detalhe técnico interno",
      },
    });
    const { result } = renderHook(() => useProva());
    const mensagemEsperada =
      "Este arquivo já foi aprovado e não pode ser excluído.";

    await act(async () => {
      await expect(
        result.current.deleteDocumento(
          "prova-1",
          "doc-1",
          "Arquivo enviado com conteúdo incorreto",
        ),
      ).rejects.toThrow(mensagemEsperada);
    });

    expect(result.current.error).toBe(mensagemEsperada);
  });
});

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
