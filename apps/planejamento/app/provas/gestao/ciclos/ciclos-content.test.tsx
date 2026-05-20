import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CiclosContent } from "./ciclos-content";

const mocks = vi.hoisted(() => ({
  criarCiclo: vi.fn(),
  editarCiclo: vi.fn(),
  excluirCiclo: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../../../../features/prova", () => ({
  useCiclos: () => ({
    ciclos: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    criarCiclo: mocks.criarCiclo,
    editarCiclo: mocks.editarCiclo,
    excluirCiclo: mocks.excluirCiclo,
  }),
}));

vi.mock("@essencia/ui/toaster", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

describe("CiclosContent", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("mantem o modal aberto e exibe a mensagem real quando a API rejeita o ciclo", async () => {
    const user = userEvent.setup();
    const mensagemApi = "Data maxima de entrega deve ser anterior ao inicio do ciclo";

    mocks.criarCiclo.mockRejectedValueOnce(new Error(mensagemApi));

    render(<CiclosContent />);

    await user.click(screen.getByRole("button", { name: /adicionar prova/i }));

    fireEvent.change(screen.getByLabelText(/data de inicio/i), {
      target: { value: "2026-06-10" },
    });
    fireEvent.change(screen.getByLabelText(/data de fim/i), {
      target: { value: "2026-06-20" },
    });
    fireEvent.change(screen.getByLabelText(/prazo de entrega/i), {
      target: { value: "2026-06-09" },
    });

    await user.click(screen.getByRole("button", { name: "Criar" }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("Erro", {
        description: mensagemApi,
      });
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
