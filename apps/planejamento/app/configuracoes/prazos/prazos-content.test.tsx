import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrazosContent } from "./prazos-content";

const mocks = vi.hoisted(() => ({
  editarPeriodo: vi.fn(),
  refetch: vi.fn(),
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
        criadoEm: "2026-01-01T00:00:00.000Z",
        atualizadoEm: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "periodo-2",
        unidadeId: "unit-1",
        etapa: "INFANTIL",
        numero: 2,
        descricao: "Segundo semestre",
        dataInicio: "2026-08-01",
        dataFim: "2026-08-15",
        dataMaximaEntrega: "2026-07-25",
        criadoEm: "2026-01-01T00:00:00.000Z",
        atualizadoEm: "2026-01-01T00:00:00.000Z",
      },
    ],
    isLoading: false,
    error: null,
    editarPeriodo: mocks.editarPeriodo,
    refetch: mocks.refetch,
  }),
}));

vi.mock("../../../features/plano-aula", () => ({
  useDeadlines: () => ({
    deadlines: [],
    loading: false,
    error: null,
    fetchDeadlines: vi.fn(),
    setDeadline: vi.fn(),
  }),
}));

describe("PrazosContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lista periodos dinamicos do semestre selecionado", async () => {
    const user = userEvent.setup();

    render(<PrazosContent />);

    await user.click(screen.getByRole("button", { name: "1o Semestre" }));

    expect(screen.getByText("1o Plano de Aula - INFANTIL")).toBeInTheDocument();
    expect(
      screen.queryByText("2o Plano de Aula - INFANTIL"),
    ).not.toBeInTheDocument();
  });

  it("salva prazo editando dataMaximaEntrega do periodo", async () => {
    const user = userEvent.setup();
    mocks.editarPeriodo.mockResolvedValue({ id: "periodo-1" });
    mocks.refetch.mockResolvedValue(undefined);

    render(<PrazosContent />);

    await user.click(screen.getByRole("button", { name: "1o Semestre" }));
    await user.click(screen.getByRole("button", { name: /editar prazo/i }));
    await user.clear(screen.getByLabelText(/novo prazo de entrega/i));
    await user.type(screen.getByLabelText(/novo prazo de entrega/i), "2026-02-20");
    await user.click(screen.getByRole("button", { name: /^salvar$/i }));

    await waitFor(() => {
      expect(mocks.editarPeriodo).toHaveBeenCalledWith("periodo-1", {
        dataMaximaEntrega: "2026-02-20",
      });
    });
  });
});
