import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePlanoAula } from "./use-plano-aula";

const mockApiDelete = vi.fn();

vi.mock("@essencia/shared/fetchers/client", () => ({
  api: {
    delete: (...args: unknown[]) => mockApiDelete(...args),
  },
}));

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
});
