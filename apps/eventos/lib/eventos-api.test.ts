import { describe, expect, it, vi } from "vitest";
import { buscarApiPublica, listarEventosPublicos } from "./eventos-api";

describe("API pública de eventos", () => {
  it("usa /api no navegador e não encaminha cookie administrativo", async () => {
    vi.stubGlobal("window", {});
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]", { status: 200 }));
    await listarEventosPublicos();
    expect(fetchMock).toHaveBeenCalledWith("/api/eventos/public", expect.objectContaining({ cache: "no-store" }));
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.credentials).not.toBe("include");
    fetchMock.mockRestore();
  });

  it("propaga erro HTTP sem redirecionar", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("falha", { status: 503 }));
    await expect(buscarApiPublica("/eventos/public")).rejects.toThrow("Falha ao consultar API pública (503)");
    vi.restoreAllMocks();
  });
});
