import type { WorkflowExecucaoResumo } from "@essencia/shared/types/workflows";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import WorkflowsPage from "./page";

const mockUseTenant = vi.fn();
const mockListarModelos = vi.fn();
const mockListarExecucoes = vi.fn();
const mockIniciarExecucao = vi.fn();

const execucaoCancelada: WorkflowExecucaoResumo = {
  id: "execucao-cancelada-1",
  schoolId: "school-1",
  unitId: "unit-1",
  modeloId: "modelo-1",
  titulo: "Execução cancelada visível",
  status: "CANCELADA",
  teste: false,
  modeloAtualizado: false,
  iniciadoPor: "user-1",
  concluidoAt: null,
  canceladoAt: "2026-07-30T10:00:00.000Z",
  motivoCancelamento: "Evento adiado",
  createdAt: "2026-07-30T09:00:00.000Z",
  updatedAt: "2026-07-30T10:00:00.000Z",
  faseAtual: "Preparação",
  progressoPercentual: 25,
  modelo: {
    id: "modelo-1",
    schoolId: "school-1",
    unitId: "unit-1",
    categoriaId: "categoria-1",
    nome: "Evento escolar",
    descricaoCurta: "Protocolo operacional",
    status: "PUBLICADO",
    criadoPor: "gestor-1",
    createdAt: "2026-07-30T08:00:00.000Z",
    updatedAt: "2026-07-30T08:00:00.000Z",
    categoria: {
      id: "categoria-1",
      schoolId: "school-1",
      unitId: "unit-1",
      nome: "Eventos",
      ativo: true,
      ordem: 1,
      createdAt: "2026-07-30T08:00:00.000Z",
      updatedAt: "2026-07-30T08:00:00.000Z",
    },
  },
};

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
    expect(screen.getByText("Canceladas")).toBeTruthy();
    await waitFor(() =>
      expect(mockListarModelos).toHaveBeenCalledWith("status=PUBLICADO"),
    );
    expect(mockListarExecucoes).toHaveBeenCalledTimes(1);
    expect(mockListarExecucoes).toHaveBeenCalledWith("status=todos");
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
    const linkNovoWorkflow = screen.getByRole("link", {
      name: "Novo workflow",
    });
    expect(linkNovoWorkflow).toHaveAttribute("href", "/modelos/novo");
    expect(
      screen.getByRole("link", { name: "Gerenciar modelos" }),
    ).toHaveAttribute("href", "/modelos");
    await waitFor(() =>
      expect(mockListarModelos).toHaveBeenCalledWith("status=PUBLICADO"),
    );
  });

  it("mantém execuções canceladas acessíveis", async () => {
    const user = userEvent.setup();
    mockListarExecucoes.mockResolvedValue([execucaoCancelada]);

    render(<WorkflowsPage />);

    await user.click(await screen.findByText("Canceladas"));

    expect(
      screen.getByText("Execução cancelada visível"),
    ).toBeInTheDocument();
  });
});
