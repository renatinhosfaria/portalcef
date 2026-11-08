import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  obterEventoPublicoServidor: vi.fn(),
  listarSessoesPublicasServidor: vi.fn(),
  listarPoliticasPublicasServidor: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("../../../lib/eventos-api-servidor", () => mocks);

import { EventosApiError } from "../../../lib/eventos-api";
import Page from "./page";

describe("página pública do evento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listarSessoesPublicasServidor.mockResolvedValue([]);
    mocks.listarPoliticasPublicasServidor.mockResolvedValue([]);
  });

  it("converte evento inexistente em not-found", async () => {
    mocks.obterEventoPublicoServidor.mockRejectedValue(new EventosApiError("Evento não encontrado", 404, "EVENT_NOT_FOUND"));
    await expect(Page({ params: Promise.resolve({ slug: "inexistente" }) })).rejects.toThrow("NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.listarSessoesPublicasServidor).toHaveBeenCalledWith("inexistente");
    expect(mocks.listarPoliticasPublicasServidor).toHaveBeenCalledWith("inexistente");
  });
});
