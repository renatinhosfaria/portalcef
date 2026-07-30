import type {
  WorkflowCategoria,
  WorkflowModeloResumo,
} from "@essencia/shared/types/workflows";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ModelosPage from "./page";

const mocks = vi.hoisted(() => ({
  useTenant: vi.fn(),
  listarModelos: vi.fn(),
  listarCategorias: vi.fn(),
  criarCategoria: vi.fn(),
  atualizarCategoria: vi.fn(),
  iniciarExecucao: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@essencia/shared/providers/tenant", () => ({
  useTenant: () => mocks.useTenant(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/api", () => ({
  listarModelos: (...args: unknown[]) => mocks.listarModelos(...args),
  listarCategorias: (...args: unknown[]) => mocks.listarCategorias(...args),
  criarCategoria: (...args: unknown[]) => mocks.criarCategoria(...args),
  atualizarCategoria: (...args: unknown[]) =>
    mocks.atualizarCategoria(...args),
  iniciarExecucao: (...args: unknown[]) => mocks.iniciarExecucao(...args),
}));

const categoria: WorkflowCategoria = {
  id: "categoria-1",
  schoolId: "school-1",
  unitId: "unit-1",
  nome: "Eventos",
  ativo: true,
  ordem: 1,
  createdAt: "2026-07-30T10:00:00.000Z",
  updatedAt: "2026-07-30T10:00:00.000Z",
};

function criarModelo(
  status: WorkflowModeloResumo["status"],
): WorkflowModeloResumo {
  return {
    id: `modelo-${status.toLowerCase()}`,
    schoolId: "school-1",
    unitId: "unit-1",
    categoriaId: categoria.id,
    nome: `Modelo ${status}`,
    descricaoCurta: "Protocolo operacional",
    status,
    criadoPor: "gestor-1",
    createdAt: "2026-07-30T10:00:00.000Z",
    updatedAt: "2026-07-30T10:00:00.000Z",
    categoria,
  };
}

describe("ModelosPage", () => {
  beforeEach(() => {
    mocks.useTenant.mockReturnValue({
      role: "coordenadora_geral",
      isLoaded: true,
    });
    mocks.listarModelos.mockResolvedValue([
      criarModelo("RASCUNHO"),
      criarModelo("PUBLICADO"),
      criarModelo("INATIVO"),
    ]);
    mocks.listarCategorias.mockResolvedValue([categoria]);
    mocks.iniciarExecucao.mockResolvedValue({ id: "execucao-teste-1" });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lista todos os modelos e permite filtrar por status", async () => {
    const user = userEvent.setup();
    render(<ModelosPage />);

    await waitFor(() =>
      expect(mocks.listarModelos).toHaveBeenCalledWith("status=todos"),
    );
    expect(await screen.findByText("Modelo RASCUNHO")).toBeInTheDocument();
    expect(screen.getByText("Modelo PUBLICADO")).toBeInTheDocument();
    expect(screen.getByText("Modelo INATIVO")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Inativos" }));

    expect(screen.getByText("Modelo INATIVO")).toBeInTheDocument();
    expect(screen.queryByText("Modelo RASCUNHO")).not.toBeInTheDocument();
    expect(screen.queryByText("Modelo PUBLICADO")).not.toBeInTheDocument();
  });

  it("abre o gerenciamento de categorias", async () => {
    const user = userEvent.setup();
    render(<ModelosPage />);

    await user.click(
      await screen.findByRole("button", { name: "Gerenciar categorias" }),
    );

    expect(
      screen.getByRole("heading", { name: "Gerenciar categorias" }),
    ).toBeInTheDocument();
  });

  it("inicia teste de um modelo em rascunho e abre a execução", async () => {
    const user = userEvent.setup();
    render(<ModelosPage />);

    await user.click(
      await screen.findByRole("button", {
        name: "Iniciar teste de Modelo RASCUNHO",
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Iniciar teste" }),
    ).toBeInTheDocument();

    await user.type(
      screen.getByLabelText("Título"),
      "Validação do rascunho",
    );
    await user.click(screen.getByRole("button", { name: "Iniciar teste" }));

    await waitFor(() =>
      expect(mocks.iniciarExecucao).toHaveBeenCalledWith("modelo-rascunho", {
        titulo: "Validação do rascunho",
        teste: true,
      }),
    );
    expect(mocks.push).toHaveBeenCalledWith("/execucoes/execucao-teste-1");
  });

  it("bloqueia visualmente usuário sem permissão de gestão", async () => {
    mocks.useTenant.mockReturnValue({
      role: "professora",
      isLoaded: true,
    });

    render(<ModelosPage />);

    expect(await screen.findByText("Acesso restrito")).toBeInTheDocument();
    expect(mocks.listarModelos).not.toHaveBeenCalled();
  });
});
