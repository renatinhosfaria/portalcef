import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  enviarEventosPendentes,
  registrarEventoObservabilidade,
} from "../lib/observabilidade/cliente";

import ErroPlanejamento from "./error";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("../lib/observabilidade/cliente", () => ({
  enviarEventosPendentes: vi.fn(),
  registrarEventoObservabilidade: vi.fn(),
}));

describe("tela de erro das páginas do planejamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(enviarEventosPendentes).mockResolvedValue(undefined);
    vi.mocked(usePathname).mockReturnValue("/planejamentos");
  });

  it("mostra a tela de erro e registra a falha como tela_erro", () => {
    render(<ErroPlanejamento error={new Error("falha")} reset={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Algo deu errado nesta tela" }),
    ).toBeInTheDocument();
    expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
      expect.objectContaining({
        evento: "erro_navegador",
        detalhes: expect.objectContaining({ acao: "tela_erro" }),
      }),
    );
  });
});
