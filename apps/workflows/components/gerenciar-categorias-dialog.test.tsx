import type { WorkflowCategoria } from "@essencia/shared/types/workflows";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GerenciarCategoriasDialog } from "./gerenciar-categorias-dialog";

const mocks = vi.hoisted(() => ({
  criarCategoria: vi.fn(),
  atualizarCategoria: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  criarCategoria: (...args: unknown[]) => mocks.criarCategoria(...args),
  atualizarCategoria: (...args: unknown[]) =>
    mocks.atualizarCategoria(...args),
}));

const categoriaEventos: WorkflowCategoria = {
  id: "categoria-1",
  schoolId: "school-1",
  unitId: "unit-1",
  nome: "Eventos",
  ativo: true,
  ordem: 1,
  createdAt: "2026-07-30T10:00:00.000Z",
  updatedAt: "2026-07-30T10:00:00.000Z",
};

const categoriaInativa: WorkflowCategoria = {
  ...categoriaEventos,
  id: "categoria-2",
  nome: "Documentos antigos",
  ativo: false,
  ordem: 2,
};

describe("GerenciarCategoriasDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cria uma categoria e publica a lista atualizada", async () => {
    const user = userEvent.setup();
    const onCategoriasChange = vi.fn();
    const criada = {
      ...categoriaEventos,
      id: "categoria-3",
      nome: "Financeiro",
      ordem: 3,
    };
    mocks.criarCategoria.mockResolvedValue(criada);

    render(
      <GerenciarCategoriasDialog
        open
        categorias={[categoriaEventos]}
        onOpenChange={vi.fn()}
        onCategoriasChange={onCategoriasChange}
      />,
    );

    await user.type(screen.getByLabelText("Nova categoria"), "  Financeiro  ");
    await user.click(screen.getByRole("button", { name: "Adicionar categoria" }));

    await waitFor(() =>
      expect(mocks.criarCategoria).toHaveBeenCalledWith({ nome: "Financeiro" }),
    );
    expect(onCategoriasChange).toHaveBeenCalledWith([
      categoriaEventos,
      criada,
    ]);
  });

  it("renomeia uma categoria com o nome normalizado", async () => {
    const user = userEvent.setup();
    const onCategoriasChange = vi.fn();
    const atualizada = {
      ...categoriaEventos,
      nome: "Eventos internos",
    };
    mocks.atualizarCategoria.mockResolvedValue(atualizada);

    render(
      <GerenciarCategoriasDialog
        open
        categorias={[categoriaEventos]}
        onOpenChange={vi.fn()}
        onCategoriasChange={onCategoriasChange}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Renomear Eventos" }),
    );
    const input = screen.getByLabelText("Nome da categoria Eventos");
    await user.clear(input);
    await user.type(input, "  Eventos internos  ");
    await user.click(
      screen.getByRole("button", { name: "Salvar nome de Eventos" }),
    );

    await waitFor(() =>
      expect(mocks.atualizarCategoria).toHaveBeenCalledWith("categoria-1", {
        nome: "Eventos internos",
      }),
    );
    expect(onCategoriasChange).toHaveBeenCalledWith([atualizada]);
  });

  it("confirma antes de inativar uma categoria", async () => {
    const user = userEvent.setup();
    const atualizada = { ...categoriaEventos, ativo: false };
    mocks.atualizarCategoria.mockResolvedValue(atualizada);

    render(
      <GerenciarCategoriasDialog
        open
        categorias={[categoriaEventos]}
        onOpenChange={vi.fn()}
        onCategoriasChange={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Inativar Eventos" }),
    );

    expect(mocks.atualizarCategoria).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Inativar categoria Eventos?",
    );

    await user.click(
      screen.getByRole("button", { name: "Confirmar inativação" }),
    );

    await waitFor(() =>
      expect(mocks.atualizarCategoria).toHaveBeenCalledWith("categoria-1", {
        ativo: false,
      }),
    );
  });

  it("reativa uma categoria diretamente", async () => {
    const user = userEvent.setup();
    const atualizada = { ...categoriaInativa, ativo: true };
    mocks.atualizarCategoria.mockResolvedValue(atualizada);

    render(
      <GerenciarCategoriasDialog
        open
        categorias={[categoriaInativa]}
        onOpenChange={vi.fn()}
        onCategoriasChange={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Ativar Documentos antigos" }),
    );

    await waitFor(() =>
      expect(mocks.atualizarCategoria).toHaveBeenCalledWith("categoria-2", {
        ativo: true,
      }),
    );
  });

  it("mantém o diálogo aberto e mostra erro quando a alteração falha", async () => {
    const user = userEvent.setup();
    mocks.atualizarCategoria.mockRejectedValue(
      new Error("Não foi possível inativar."),
    );

    render(
      <GerenciarCategoriasDialog
        open
        categorias={[categoriaEventos]}
        onOpenChange={vi.fn()}
        onCategoriasChange={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Inativar Eventos" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Confirmar inativação" }),
    );

    expect(
      await screen.findByText("Não foi possível inativar."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
