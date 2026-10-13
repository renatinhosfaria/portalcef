import { fireEvent, render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  enviarEventosPendentes,
  registrarEventoObservabilidade,
} from "../lib/observabilidade/cliente";

import { TelaErro } from "./tela-erro";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("../lib/observabilidade/cliente", () => ({
  enviarEventosPendentes: vi.fn(),
  registrarEventoObservabilidade: vi.fn(),
}));

function criarErro() {
  return Object.assign(new TypeError("Cannot read properties of undefined"), {
    digest: "digest-servidor-1",
  });
}

describe("TelaErro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(enviarEventosPendentes).mockResolvedValue(undefined);
    vi.mocked(usePathname).mockReturnValue("/plano-aula/periodo-1");
    document.title = "Planejamento | Essência";
  });

  it("registra o erro na telemetria com a tela e o digest do servidor", () => {
    render(<TelaErro erro={criarErro()} reset={vi.fn()} origem="tela_erro" />);

    expect(registrarEventoObservabilidade).toHaveBeenCalledTimes(1);
    expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
      expect.objectContaining({
        evento: "erro_navegador",
        nivel: "error",
        correlationId: "digest-servidor-1",
        pagina: {
          url: "/plano-aula/periodo-1",
          titulo: "Planejamento | Essência",
        },
        erro: expect.objectContaining({
          codigo: "TypeError",
          mensagem: "Cannot read properties of undefined",
        }),
        detalhes: expect.objectContaining({
          modulo: "planejamento",
          acao: "tela_erro",
        }),
      }),
    );
    expect(enviarEventosPendentes).toHaveBeenCalled();
  });

  it("explica o problema sem termos técnicos", () => {
    render(<TelaErro erro={criarErro()} reset={vi.fn()} origem="tela_erro" />);

    expect(
      screen.getByRole("heading", { name: "Algo deu errado nesta tela" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Cannot read properties/),
    ).not.toBeInTheDocument();
  });

  it("tenta renderizar a tela de novo ao clicar em Tentar novamente", () => {
    const reset = vi.fn();
    render(<TelaErro erro={criarErro()} reset={reset} origem="tela_erro" />);

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("oferece voltar ao início do planejamento", () => {
    render(<TelaErro erro={criarErro()} reset={vi.fn()} origem="tela_erro" />);

    expect(
      screen.getByRole("link", { name: "Voltar ao início" }),
    ).toHaveAttribute("href", "/");
  });
});
