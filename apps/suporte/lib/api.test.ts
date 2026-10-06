import { afterEach, describe, expect, it, vi } from "vitest";

import { apiDelete, apiGet, apiPatch, apiPost } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cliente da API de suporte", () => {
  it("preserva a mensagem estruturada retornada pela API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
        json: async () => ({
          error: { code: "VALIDATION_ERROR", message: "Descricao invalida" },
        }),
      }),
    );

    await expect(apiGet("suporte")).rejects.toThrow("Descricao invalida");
  });

  it("usa o status HTTP quando a resposta não informa statusText", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "",
        json: async () => ({}),
      }),
    );

    await expect(apiGet("suporte")).rejects.toThrow("Erro na requisição (503)");
  });

  it("mantém o corpo falso em requisições PATCH", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiPatch("suporte/os-1", false);

    expect(fetchMock).toHaveBeenCalledWith("/api/suporte/os-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "false",
    });
  });

  it("aplica a mesma validação de resposta a POST e DELETE", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ message: "Falha de validação" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiPost("suporte", { titulo: "x" })).rejects.toThrow(
      "Falha de validação",
    );
    await expect(apiDelete("suporte/os-1")).rejects.toThrow(
      "Falha de validação",
    );
  });
});
