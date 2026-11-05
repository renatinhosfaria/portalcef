import { afterEach, describe, expect, it, vi } from "vitest";
import { ErroApiMapa, editarVersao, excluirVersao, importarPlanta, listarMapas, publicarMapa, respostaApi } from "./api-mapas";

afterEach(() => vi.unstubAllGlobals());

describe("api-mapas", () => {
  it("lista versões e trava no endpoint de mapas", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { versoes: [], trava: { tipo: "LIVRE", mensagem: null } } })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listarMapas("ev1")).resolves.toEqual({ versoes: [], trava: { tipo: "LIVRE", mensagem: null } });
    expect(fetchMock).toHaveBeenCalledWith("/eventos-admin/api/eventos/admin/ev1/mapas");
  });

  it("chama editar, excluir e publicar nas rotas de versões", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => new Response(JSON.stringify({ success: true, data: init?.method === "DELETE" ? { excluida: true, sessionIds: [] } : init?.method === "POST" && _url.endsWith("/editar") ? { mapId: "m2" } : { sessionIds: ["s1"], capacidade: 3, arquivadas: [] } })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(editarVersao("ev1", "m1")).resolves.toEqual({ mapId: "m2" });
    await expect(excluirVersao("ev1", "m1")).resolves.toEqual({ excluida: true, sessionIds: [] });
    await expect(publicarMapa("ev1", "m1", 2, "ajuste")).resolves.toEqual({ sessionIds: ["s1"], capacidade: 3, arquivadas: [] });
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ["/eventos-admin/api/eventos/admin/ev1/mapas/m1/editar", "POST"],
      ["/eventos-admin/api/eventos/admin/ev1/mapas/m1", "DELETE"],
      ["/eventos-admin/api/eventos/admin/ev1/mapas/m1/publicar", "POST"],
    ]);
  });

  it("editar não declara JSON sem corpo, porque o Fastify recusa esse pedido com 400", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ success: true, data: { mapId: "m2" } })));
    vi.stubGlobal("fetch", fetchMock);

    await editarVersao("ev1", "m1");

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).get("content-type")).toBeNull();
  });

  it("respostaApi lança ErroApiMapa com code e details", async () => {
    const response = new Response(
      JSON.stringify({ success: false, error: { code: "PDF_PAGINA_OBRIGATORIA", message: "Informe a página", details: { paginas: 3 } } }),
      { status: 400 },
    );
    const erro = await respostaApi(response).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroApiMapa);
    expect(erro.code).toBe("PDF_PAGINA_OBRIGATORIA");
    expect(erro.message).toBe("Informe a página");
    expect(erro.details).toEqual({ paginas: 3 });
  });

  it("respostaApi devolve data ou o corpo inteiro", async () => {
    expect(await respostaApi(new Response(JSON.stringify({ success: true, data: { a: 1 } })))).toEqual({ a: 1 });
    expect(await respostaApi(new Response(JSON.stringify({ b: 2 })))).toEqual({ b: 2 });
  });

  it("importarPlanta envia multipart e ?pagina quando informada", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { mapId: "m1" } })));
    vi.stubGlobal("fetch", fetchMock);
    const arquivo = new File(["%PDF"], "planta.pdf", { type: "application/pdf" });

    await importarPlanta("ev1", arquivo, 2);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/eventos-admin/api/eventos/admin/ev1/mapas/import?pagina=2");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);

    await importarPlanta("ev1", arquivo);
    expect((fetchMock.mock.calls[1] as unknown as [string])[0]).toBe("/eventos-admin/api/eventos/admin/ev1/mapas/import");
  });
});
