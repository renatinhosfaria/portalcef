import { afterEach, describe, expect, it, vi } from "vitest";

import { clientFetch, FetchError } from "./client";

describe("clientFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserva status de erro quando a resposta não é JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>Payload Too Large</html>", {
          status: 413,
          statusText: "Payload Too Large",
          headers: { "content-type": "text/html" },
        }),
      ),
    );

    let erroCapturado: unknown;

    try {
      await clientFetch("/plano-aula/documentos/upload");
    } catch (erro) {
      erroCapturado = erro;
    }

    expect(erroCapturado).toBeInstanceOf(FetchError);
    expect(erroCapturado).toMatchObject({
      status: 413,
      code: "HTTP_413",
      message: "Payload Too Large",
    });
  });

  it("não envia content-type JSON em requisição sem corpo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await clientFetch("/turmas/turma-1/professora", { method: "DELETE" });

    const [, config] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(config.headers);

    expect(config.body).toBeUndefined();
    expect(headers.has("content-type")).toBe(false);
  });
});
