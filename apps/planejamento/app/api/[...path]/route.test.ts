import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

describe("proxy da API do planejamento", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserva x-correlation-id recebido do navegador e devolve no header da resposta JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ success: true }, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/plano-aula", {
      headers: {
        "x-correlation-id": "corr-navegador-1",
        "x-request-id": "req-1",
      },
    });

    const response = await GET(request);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/plano-aula",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          "x-correlation-id": "corr-navegador-1",
          "x-request-id": "req-1",
        },
      }),
    );
    expect(response.headers.get("x-correlation-id")).toBe(
      "corr-navegador-1",
    );
  });

  it("gera um UUID quando nao houver x-correlation-id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ success: true }, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/plano-aula");

    const response = await GET(request);
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as
      | Record<string, string>
      | undefined;
    const correlationId = headers?.["x-correlation-id"];

    expect(correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(response.headers.get("x-correlation-id")).toBe(correlationId);
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
          "x-correlation-id": "corr-binaria-1",
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
          "x-correlation-id": "corr-binaria-1",
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
    expect(response.headers.get("x-correlation-id")).toBe("corr-binaria-1");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(conteudo);
  });

  it("devolve x-correlation-id no erro 502 do proxy", async () => {
    const erroConsole = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn().mockRejectedValue(new Error("backend fora"));
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost/api/plano-aula", {
      headers: {
        "x-correlation-id": "corr-erro-1",
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(502);
    expect(response.headers.get("x-correlation-id")).toBe("corr-erro-1");

    erroConsole.mockRestore();
  });
});
