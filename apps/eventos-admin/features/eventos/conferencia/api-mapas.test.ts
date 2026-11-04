import { afterEach, describe, expect, it, vi } from "vitest";
import { ErroApiMapa, importarPlanta, respostaApi } from "./api-mapas";

afterEach(() => vi.unstubAllGlobals());

describe("api-mapas", () => {
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
