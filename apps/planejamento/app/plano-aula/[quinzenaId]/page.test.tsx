import type * as FetchersServidor from "@essencia/shared/fetchers/server";
import {
  ServerFetchError,
  serverApi,
} from "@essencia/shared/fetchers/server";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { irParaLogin } from "../../../lib/url-login";

import PlanoAulaPage from "./page";

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

vi.mock("./plano-content", () => ({
  PlanoContent: () => <div>Conteúdo do plano</div>,
}));

async function renderizarPagina() {
  const pagina = await PlanoAulaPage({
    params: Promise.resolve({ quinzenaId: "periodo-1" }),
    searchParams: Promise.resolve({ turmaId: "turma-1" }),
  });
  return render(pagina);
}

describe("página do plano de aula", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("leva ao login quando a sessão expirou, em vez de dizer que o período não existe", async () => {
    vi.mocked(serverApi.get).mockRejectedValue(
      new ServerFetchError(401, "UNAUTHORIZED", "Não autenticado"),
    );

    await renderizarPagina();

    expect(
      screen.getByText("Sua sessão expirou. Redirecionando para o login…"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Período nao encontrado")).not.toBeInTheDocument();
    expect(irParaLogin).toHaveBeenCalled();
  });

  it("continua avisando quando o período realmente não existe", async () => {
    vi.mocked(serverApi.get).mockImplementation(async (rota: string) => {
      if (rota.startsWith("/api/plano-aula-periodo/")) {
        throw new ServerFetchError(404, "NOT_FOUND", "Período não encontrado");
      }
      return [];
    });

    await renderizarPagina();

    expect(
      screen.getByRole("heading", { name: "Período nao encontrado" }),
    ).toBeInTheDocument();
    expect(irParaLogin).not.toHaveBeenCalled();
  });
});
