import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PeriodosContent } from "./periodos-content";

const mocks = vi.hoisted(() => ({
  criarPeriodo: vi.fn(),
  editarPeriodo: vi.fn(),
  excluirPeriodo: vi.fn(),
  tenant: {
    role: "coordenadora_geral",
    isLoaded: true,
  },
}));

vi.mock("@essencia/ui/toaster", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@essencia/shared/providers/tenant", () => ({
  useTenant: () => ({
    userId: "user-1",
    schoolId: "school-1",
    unitId: "unit-1",
    stageId: "stage-1",
    role: mocks.tenant.role,
    name: "Usuária Teste",
    email: "teste@example.com",
    isLoaded: mocks.tenant.isLoaded,
  }),
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
    mocks.tenant.role = "coordenadora_geral";
    mocks.tenant.isLoaded = true;
    mocks.editarPeriodo.mockResolvedValue({
      id: "periodo-1",
      dataMaximaEntrega: "2026-02-20",
    });
    mocks.criarPeriodo.mockResolvedValue({ id: "periodo-novo" });
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

  it("limita coordenadora_infantil a criar período apenas em INFANTIL", async () => {
    const user = userEvent.setup();
    mocks.tenant.role = "coordenadora_infantil";

    render(<PeriodosContent />);

    expect(
      screen.getByRole("button", { name: "FUNDAMENTAL I" }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole("button", { name: /adicionar plano de aula/i }),
    );
    await user.type(screen.getByLabelText(/data de início/i), "2026-04-01");
    await user.type(screen.getByLabelText(/data de fim/i), "2026-04-15");
    await user.type(screen.getByLabelText(/prazo de entrega/i), "2026-03-28");
    await user.click(screen.getByRole("button", { name: "Criar" }));

    await waitFor(() => {
      expect(mocks.criarPeriodo).toHaveBeenCalledWith(
        expect.objectContaining({ etapa: "INFANTIL" }),
      );
    });
  });

  it("bloqueia gestão de períodos para analista_pedagogico", () => {
    mocks.tenant.role = "analista_pedagogico";

    render(<PeriodosContent />);

    expect(
      screen.getByText(/você não tem permissão para gerenciar planos de aula/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /adicionar plano de aula/i }),
    ).not.toBeInTheDocument();
  });
});
