import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { irParaLogin } from "../lib/url-login";

import { RedirecionarParaLogin } from "./redirecionar-para-login";

vi.mock("../lib/url-login", () => ({
  irParaLogin: vi.fn(),
}));

describe("RedirecionarParaLogin", () => {
  const caminhoOriginal = `${window.location.pathname}${window.location.search}`;

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(
      {},
      "",
      "/planejamento/plano-aula/periodo-1?turmaId=turma-1",
    );
  });

  afterEach(() => {
    window.history.replaceState({}, "", caminhoOriginal);
  });

  it("leva ao login pedindo para voltar à mesma página depois", () => {
    render(<RedirecionarParaLogin />);

    expect(irParaLogin).toHaveBeenCalledTimes(1);
    expect(irParaLogin).toHaveBeenCalledWith(
      "/planejamento/plano-aula/periodo-1?turmaId=turma-1",
    );
  });

  it("avisa que a sessão expirou enquanto redireciona", () => {
    render(<RedirecionarParaLogin />);

    expect(
      screen.getByText("Sua sessão expirou. Redirecionando para o login…"),
    ).toBeInTheDocument();
  });
});
