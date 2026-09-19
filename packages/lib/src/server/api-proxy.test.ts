import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { proxyRequest } from "./api-proxy";

describe("proxy HTTP compartilhado", () => {
  it("preserva o prefixo /api, consulta, cookie e corpo bruto", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 201,
        headers: {
          "content-type": "application/json",
          "set-cookie": "sessao=nova; Path=/; HttpOnly",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest(
      "http://localhost:3004/api/usuarios?pagina=2",
      {
        method: "POST",
        headers: {
          cookie: "sessao=atual",
          "content-type": "application/json",
          "x-request-id": "req-123",
        },
        body: JSON.stringify({ nome: "Ana" }),
      },
    );

    const response = await proxyRequest(request, "POST");
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe("http://localhost:3001/usuarios?pagina=2");
    expect(options.method).toBe("POST");
    expect((options.headers as Record<string, string>).Cookie).toBe("sessao=atual");
    expect((options.headers as Record<string, string>)["x-request-id"]).toBe("req-123");
    expect(options.body).toBe(JSON.stringify({ nome: "Ana" }));
    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toContain("sessao=nova");
  });
});
