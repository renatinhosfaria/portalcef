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
});
