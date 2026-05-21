import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

describe("proxy da API do planejamento", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserva respostas binarias do backend sem converter para JSON", async () => {
    const conteudo = new Uint8Array([80, 75, 3, 4, 20, 0]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(conteudo, {
        status: 200,
        headers: {
          "content-type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "content-disposition": 'attachment; filename="planejamento.docx"',
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest(
      "http://localhost/api/plano-aula/documentos/doc-1/download?modo=preview",
      {
        headers: {
          cookie: "sid=abc",
          "x-request-id": "req-1",
        },
      },
    );

    const response = await GET(request);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/plano-aula/documentos/doc-1/download?modo=preview",
      expect.objectContaining({
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Cookie: "sid=abc",
          "x-request-id": "req-1",
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="planejamento.docx"',
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(conteudo);
  });
});
