import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardProvasContent } from "./dashboard-content";

const fetchDashboard = vi.fn();

vi.mock("../../../features/prova", () => ({
  useProvaDashboard: () => ({
    fetchDashboard,
    loading: false,
    error: null,
    data: {
      stats: {
        total: 10,
        rascunho: 1,
        aguardandoImpressao: 9,
        aguardandoResposta: 0,
        aguardandoAnalista: 0,
        devolvidos: 0,
        aprovados: 0,
      },
      porSegmento: {},
    },
  }),
}));

describe("DashboardProvasContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchDashboard.mockResolvedValue(undefined);
  });

  it("permite abrir a listagem filtrada a partir dos cartões de status", () => {
    render(<DashboardProvasContent />);

    expect(
      screen.getByRole("link", { name: /total de provas/i }),
    ).toHaveAttribute("href", "/provas/gestao/provas?status=todos");
    expect(
      screen.getByRole("link", { name: /aguardando impressao/i }),
    ).toHaveAttribute(
      "href",
      "/provas/gestao/provas?status=aguardando-impressao",
    );
    expect(screen.queryByText("Aguardando Resposta")).not.toBeInTheDocument();
  });
});
