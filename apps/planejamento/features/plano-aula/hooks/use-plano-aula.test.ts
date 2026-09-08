import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FetchError } from "@essencia/shared/fetchers/client";
import { usePlanoAula } from "./use-plano-aula";

const mockApiDelete = vi.fn();

vi.mock("@essencia/shared/fetchers/client", async () => {
  const atual = await vi.importActual<
    typeof import("@essencia/shared/fetchers/client")
  >("@essencia/shared/fetchers/client");
  return {
    FetchError: atual.FetchError,
    api: {
      delete: (...args: unknown[]) => mockApiDelete(...args),
    },
  };
});

describe("usePlanoAula", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiDelete.mockResolvedValue(undefined);
  });

  it("envia o motivo ao excluir documento", async () => {
    const { result } = renderHook(() => usePlanoAula());
    const motivo = "Arquivo enviado com conteúdo incorreto";

    await act(async () => {
      await result.current.deleteDocumento("plano-1", "doc-1", motivo);
    });

    expect(mockApiDelete).toHaveBeenCalledWith(
      "/plano-aula/plano-1/documentos/doc-1",
      { body: { motivo } },
    );
  });

  it("traduz 403 real como falta de permissão para excluir", async () => {
    mockApiDelete.mockRejectedValueOnce(
      new FetchError(403, "FORBIDDEN", "Acesso negado"),
    );
    const { result } = renderHook(() => usePlanoAula());

    await act(async () => {
      await expect(
        result.current.deleteDocumento(
          "plano-1",
          "doc-1",
          "Arquivo enviado com conteúdo incorreto",
        ),
      ).rejects.toThrow("Você não tem permissão para excluir este arquivo.");
    });
  });
});
