import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  atualizarCategoria,
  descartarExecucaoTeste,
  editarTituloExecucao,
  listarModelos,
  listarExecucoes,
  criarModelo,
} from "./api";

const mocks = vi.hoisted(() => ({
  patch: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@essencia/shared/fetchers/client", () => ({
  api: {
    get: (...args: unknown[]) => mocks.get(...args),
    post: (...args: unknown[]) => mocks.post(...args),
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

  it("lista modelos com paginação e filtros codificados", async () => {
    await listarModelos({
      status: "todos",
      pagina: 2,
      limite: 20,
      busca: " evento ",
      categoriaId: "cat-1",
    });

    expect(mocks.get).toHaveBeenCalledWith(
      "/workflows/modelos?status=todos&pagina=2&limite=20&busca=+evento+&categoriaId=cat-1",
    );
  });

  it("lista execuções por status e página", async () => {
    await listarExecucoes({ status: "CONCLUIDA", pagina: 3, limite: 10 });

    expect(mocks.get).toHaveBeenCalledWith(
      "/workflows/execucoes?status=CONCLUIDA&pagina=3&limite=10",
    );
  });

  it("tipa criação de modelo como resultado de mutação", async () => {
    await criarModelo({ nome: "Novo" });
    expect(mocks.post).toHaveBeenCalledWith("/workflows/modelos", {
      nome: "Novo",
    });
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
