import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import WorkflowsPage from "./page";

const mockUseTenant = vi.fn();
const mockListarModelos = vi.fn();
const mockListarExecucoes = vi.fn();
const mockIniciarExecucao = vi.fn();

vi.mock("@essencia/shared/providers/tenant", () => ({
  useTenant: () => mockUseTenant(),
}));

vi.mock("@/lib/api", () => ({
  listarModelos: (...args: unknown[]) => mockListarModelos(...args),
  listarExecucoes: (...args: unknown[]) => mockListarExecucoes(...args),
  iniciarExecucao: (...args: unknown[]) => mockIniciarExecucao(...args),
}));

describe("WorkflowsPage", () => {
  beforeEach(() => {
    mockUseTenant.mockReturnValue({
      role: "professora",
      userId: "user-1",
      isLoaded: true,
    });
    mockListarModelos.mockResolvedValue([]);
    mockListarExecucoes.mockResolvedValue([]);
    mockIniciarExecucao.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renderiza abas principais do modulo", async () => {
    render(<WorkflowsPage />);

    expect(screen.getAllByText("Workflows").length).toBeGreaterThan(0);
    expect(screen.getByText("Em andamento")).toBeTruthy();
    expect(screen.getByText("Concluídos")).toBeTruthy();
    await waitFor(() =>
      expect(mockListarModelos).toHaveBeenCalledWith("status=PUBLICADO"),
    );
  });

  it("mostra botao de criar modelo apenas para gestao", async () => {
    mockUseTenant.mockReturnValue({
      role: "professora",
      userId: "user-1",
      isLoaded: true,
    });
    render(<WorkflowsPage />);
    expect(screen.queryByText("Novo workflow")).toBeNull();
    await waitFor(() =>
      expect(mockListarModelos).toHaveBeenCalledWith("status=PUBLICADO"),
    );

    cleanup();
    vi.clearAllMocks();

    mockUseTenant.mockReturnValue({
      role: "coordenadora_geral",
      userId: "gestor-1",
      isLoaded: true,
    });
    render(<WorkflowsPage />);
    expect(screen.getByText("Novo workflow")).toBeTruthy();
    await waitFor(() =>
      expect(mockListarModelos).toHaveBeenCalledWith("status=PUBLICADO"),
    );
  });
});
