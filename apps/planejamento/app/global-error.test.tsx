import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  enviarEventosPendentes,
  registrarEventoObservabilidade,
} from "../lib/observabilidade/cliente";

import ErroGlobalPlanejamento from "./global-error";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("../lib/observabilidade/cliente", () => ({
  enviarEventosPendentes: vi.fn(),
  registrarEventoObservabilidade: vi.fn(),
}));

describe("tela de erro global do planejamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(enviarEventosPendentes).mockResolvedValue(undefined);
    // Sem o layout raiz, o contexto do roteador pode faltar e o hook devolver
    // null em tempo de execução, apesar do tipo declarado.
    vi.mocked(usePathname).mockReturnValue(null as unknown as string);
  });

  it("substitui o layout raiz em português e registra a falha como tela_erro_global", () => {
    // A tela global declara <html>, então é montada no próprio documento.
    render(
      <ErroGlobalPlanejamento
        error={new Error("falha no layout")}
        reset={vi.fn()}
      />,
      { container: document as unknown as HTMLElement },
    );

    expect(document.documentElement).toHaveAttribute("lang", "pt-BR");
    expect(
      screen.getByRole("heading", { name: "Algo deu errado nesta tela" }),
    ).toBeInTheDocument();
    expect(registrarEventoObservabilidade).toHaveBeenCalledWith(
      expect.objectContaining({
        evento: "erro_navegador",
        detalhes: expect.objectContaining({ acao: "tela_erro_global" }),
      }),
    );
  });
});
