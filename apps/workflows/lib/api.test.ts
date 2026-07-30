import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  atualizarCategoria,
  descartarExecucaoTeste,
  editarTituloExecucao,
} from "./api";

const mocks = vi.hoisted(() => ({
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@essencia/shared/fetchers/client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: (...args: unknown[]) => mocks.patch(...args),
    delete: (...args: unknown[]) => mocks.delete(...args),
  },
}));

describe("cliente HTTP de workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("atualiza uma categoria pelo identificador", async () => {
    const body = { nome: "Eventos internos" };

    await atualizarCategoria("categoria-1", body);

    expect(mocks.patch).toHaveBeenCalledWith(
      "/workflows/categorias/categoria-1",
      body,
    );
  });

  it("edita o título de uma execução", async () => {
    const body = { titulo: "Novo título" };

    await editarTituloExecucao("execucao-1", body);

    expect(mocks.patch).toHaveBeenCalledWith(
      "/workflows/execucoes/execucao-1/titulo",
      body,
    );
  });

  it("descarta uma execução de teste", async () => {
    await descartarExecucaoTeste("execucao-1");

    expect(mocks.delete).toHaveBeenCalledWith(
      "/workflows/execucoes/execucao-1",
    );
  });
});
