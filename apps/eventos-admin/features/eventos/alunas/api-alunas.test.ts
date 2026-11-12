import { afterEach, describe, expect, it, vi } from "vitest";
import { juntarAlunas, listarAlunas, separarAluna } from "./api-alunas";

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("API de alunas convidadas", () => {
  it("lista a contagem usando a rota do evento", async () => {
    const resposta = { alunas: [], semAluna: 1, totalPagantes: 2 };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: resposta }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listarAlunas("ev-1")).resolves.toEqual(resposta);
    expect(fetchMock).toHaveBeenCalledWith("/eventos-admin/api/eventos/admin/ev-1/alunas", { credentials: "include" });
  });

  it("envia juntar e separar como JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { alunas: [], semAluna: 0, totalPagantes: 0 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await juntarAlunas("ev-1", { destino: "Beatriz Santos", origens: ["Bia"] });
    await separarAluna("ev-1", "bia");

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method, init?.credentials, init?.body])).toEqual([
      ["/eventos-admin/api/eventos/admin/ev-1/alunas/juntar", "POST", "include", JSON.stringify({ destino: "Beatriz Santos", origens: ["Bia"] })],
      ["/eventos-admin/api/eventos/admin/ev-1/alunas/separar", "POST", "include", JSON.stringify({ chave: "bia" })],
    ]);
  });
});
