import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IniciarExecucaoDialog } from "./iniciar-execucao-dialog";

const mockIniciarExecucao = vi.fn();

vi.mock("@/lib/api", () => ({
  iniciarExecucao: (...args: unknown[]) => mockIniciarExecucao(...args),
}));

function renderDialog(
  props: Partial<ComponentProps<typeof IniciarExecucaoDialog>> = {},
) {
  return render(
    <IniciarExecucaoDialog
      modeloId="modelo-1"
      modeloNome="Checklist inicial"
      open
      onOpenChange={vi.fn()}
      onSucesso={vi.fn()}
      {...props}
    />,
  );
}

describe("IniciarExecucaoDialog", () => {
  beforeEach(() => {
    mockIniciarExecucao.mockResolvedValue({ id: "execucao-1" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reseta titulo e erro ao fechar ou trocar de modelo", async () => {
    const user = userEvent.setup();
    const { rerender } = renderDialog();

    const titulo = screen.getByLabelText("Título");
    await user.type(titulo, "Título temporário");

    rerender(
      <IniciarExecucaoDialog
        modeloId="modelo-2"
        modeloNome="Outro checklist"
        open
        onOpenChange={vi.fn()}
        onSucesso={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Título")).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "Iniciar" }));
    expect(
      screen.getByText("Informe um título para iniciar a execução."),
    ).toBeInTheDocument();

    rerender(
      <IniciarExecucaoDialog
        modeloId="modelo-2"
        modeloNome="Outro checklist"
        open={false}
        onOpenChange={vi.fn()}
        onSucesso={vi.fn()}
      />,
    );

    rerender(
      <IniciarExecucaoDialog
        modeloId="modelo-2"
        modeloNome="Outro checklist"
        open
        onOpenChange={vi.fn()}
        onSucesso={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Título")).toHaveValue("");
    expect(
      screen.queryByText("Informe um título para iniciar a execução."),
    ).not.toBeInTheDocument();
  });

  it("inicia execucao com titulo normalizado e nao fecha enquanto submit esta pendente", async () => {
    const user = userEvent.setup();
    let resolverExecucao: (() => void) | undefined;
    mockIniciarExecucao.mockReturnValue(
      new Promise((resolve) => {
        resolverExecucao = () => resolve({});
      }),
    );
    const onOpenChange = vi.fn();
    const onSucesso = vi.fn();

    renderDialog({ onOpenChange, onSucesso });

    await user.type(screen.getByLabelText("Título"), "  Evento interno  ");
    await user.click(screen.getByRole("button", { name: "Iniciar" }));

    expect(mockIniciarExecucao).toHaveBeenCalledWith("modelo-1", {
      titulo: "Evento interno",
    });

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).not.toHaveBeenCalled();

    resolverExecucao?.();

    await waitFor(() => expect(onSucesso).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("inicia teste de rascunho com sinalizacao explicita", async () => {
    const user = userEvent.setup();
    let resolverExecucao: (() => void) | undefined;
    const onSucesso = vi.fn();
    mockIniciarExecucao.mockReturnValue(
      new Promise((resolve) => {
        resolverExecucao = () => resolve({});
      }),
    );

    renderDialog({ teste: true, onSucesso });

    expect(
      screen.getByRole("heading", { name: "Iniciar teste" }),
    ).toBeInTheDocument();

    await user.type(
      screen.getByLabelText("Título"),
      "  Validação do rascunho  ",
    );
    await user.click(screen.getByRole("button", { name: "Iniciar teste" }));

    expect(mockIniciarExecucao).toHaveBeenCalledWith("modelo-1", {
      titulo: "Validação do rascunho",
      teste: true,
    });
    expect(
      screen.getByRole("button", { name: "Iniciando teste..." }),
    ).toBeDisabled();

    resolverExecucao?.();
    await waitFor(() => expect(onSucesso).toHaveBeenCalledTimes(1));
  });
});
