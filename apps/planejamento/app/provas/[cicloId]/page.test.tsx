import type * as FetchersServidor from "@essencia/shared/fetchers/server";
import {
  ServerFetchError,
  serverApi,
} from "@essencia/shared/fetchers/server";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { irParaLogin } from "../../../lib/url-login";

import ProvaDetalheServerPage from "./page";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [{ name: "session", value: "sessao-1" }],
  })),
}));

vi.mock("@essencia/shared/fetchers/server", async (importOriginal) => {
  const original = await importOriginal<typeof FetchersServidor>();
  return { ...original, serverApi: { get: vi.fn() } };
});

vi.mock("../../../lib/url-login", () => ({
  irParaLogin: vi.fn(),
}));

vi.mock("./prova-content", () => ({
  ProvaDetailContent: () => <div>Conteúdo da prova</div>,
}));

async function renderizarPagina() {
  const pagina = await ProvaDetalheServerPage({
    params: Promise.resolve({ cicloId: "ciclo-1" }),
    searchParams: Promise.resolve({ turmaId: "turma-1" }),
  });
  return render(pagina);
}

describe("página do ciclo de provas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("leva ao login quando a sessão expirou, em vez de dizer que o ciclo não existe", async () => {
    vi.mocked(serverApi.get).mockRejectedValue(
      new ServerFetchError(401, "UNAUTHORIZED", "Não autenticado"),
    );

    await renderizarPagina();

    expect(
      screen.getByText("Sua sessão expirou. Redirecionando para o login…"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Ciclo nao encontrado")).not.toBeInTheDocument();
    expect(irParaLogin).toHaveBeenCalled();
  });

  it("continua avisando quando o ciclo realmente não existe", async () => {
    vi.mocked(serverApi.get).mockImplementation(async (rota: string) => {
      if (rota.startsWith("/api/prova-ciclo/")) {
        throw new ServerFetchError(404, "NOT_FOUND", "Ciclo não encontrado");
      }
      return [];
    });

    await renderizarPagina();

    expect(
      screen.getByRole("heading", { name: "Ciclo nao encontrado" }),
    ).toBeInTheDocument();
    expect(irParaLogin).not.toHaveBeenCalled();
  });
});
