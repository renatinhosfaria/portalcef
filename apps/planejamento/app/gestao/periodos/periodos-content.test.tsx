import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PeriodosContent } from "./periodos-content";

const mocks = vi.hoisted(() => ({
  criarPeriodo: vi.fn(),
  editarPeriodo: vi.fn(),
  excluirPeriodo: vi.fn(),
}));

vi.mock("@essencia/ui/toaster", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../features/periodos/hooks/use-periodos", () => ({
  usePeriodos: () => ({
    periodos: [
      {
        id: "periodo-1",
        unidadeId: "unit-1",
        etapa: "INFANTIL",
        numero: 1,
        descricao: "Adaptacao",
        dataInicio: "2026-03-01",
        dataFim: "2026-03-15",
        dataMaximaEntrega: "2026-02-25",
        planosVinculados: 0,
        criadoEm: "2026-01-01T00:00:00.000Z",
        atualizadoEm: "2026-01-01T00:00:00.000Z",
      },
    ],
    isLoading: false,
    error: null,
    criarPeriodo: mocks.criarPeriodo,
    editarPeriodo: mocks.editarPeriodo,
    excluirPeriodo: mocks.excluirPeriodo,
  }),
}));

describe("PeriodosContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editarPeriodo.mockResolvedValue({
      id: "periodo-1",
      dataMaximaEntrega: "2026-02-20",
    });
  });

  it("edita o prazo de entrega pela tela oficial de gestao de periodos", async () => {
    const user = userEvent.setup();

    render(<PeriodosContent />);

    await user.click(screen.getByRole("button", { name: "INFANTIL" }));
    await user.click(
      screen.getByRole("button", { name: /editar 1o plano de aula/i }),
    );

    const prazoInput = screen.getByLabelText(/prazo de entrega/i);
    expect(prazoInput).toHaveValue("2026-02-25");

    await user.clear(prazoInput);
    await user.type(prazoInput, "2026-02-20");
    await user.click(screen.getByRole("button", { name: "Atualizar" }));

    await waitFor(() => {
      expect(mocks.editarPeriodo).toHaveBeenCalledWith(
        "periodo-1",
        expect.objectContaining({
          dataMaximaEntrega: "2026-02-20",
        }),
      );
    });
  });
});
