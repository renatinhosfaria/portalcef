import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HistoricoEntry } from "@essencia/shared/types";

import { HistoricoTimeline } from "./historico-timeline";

const mockUseHistorico = vi.fn();

vi.mock("../hooks/use-historico", () => ({
  useHistorico: (...args: unknown[]) => mockUseHistorico(...args),
}));

describe("HistoricoTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza mudanças de status de prova sem usar cores de plano de aula", () => {
    const historico: HistoricoEntry[] = [
      {
        id: "historico-1",
        planoId: "prova-1",
        userId: "gestor-1",
        userName: "Gestora",
        userRole: "gerente_unidade",
        acao: "SUBMETIDO_ANALISTA",
        statusAnterior: "AGUARDANDO_IMPRESSAO",
        statusNovo: "AGUARDANDO_ANALISTA",
        detalhes: null,
        createdAt: "2026-06-18T12:00:00.000Z",
      },
    ];

    mockUseHistorico.mockReturnValue({
      historico,
      isLoading: false,
      error: null,
    });

    expect(() =>
      render(<HistoricoTimeline planoId="prova-1" modulo="prova" />),
    ).not.toThrow();

    expect(screen.getByText("Aguardando Impressao")).toBeInTheDocument();
    expect(screen.getByText("Aguardando Analise")).toBeInTheDocument();
  });

  it("renderiza ações e status de relatório com labels de relatório", () => {
    const historico: HistoricoEntry[] = [
      {
        id: "historico-1",
        planoId: "relatorio-1",
        userId: "prof-1",
        userName: "Patrícia Kelly",
        userRole: "professora",
        acao: "SUBMETIDO",
        statusAnterior: "RASCUNHO",
        statusNovo: "AGUARDANDO_ANALISTA",
        detalhes: null,
        createdAt: "2026-06-30T09:44:00.000Z",
      },
    ];

    mockUseHistorico.mockReturnValue({
      historico,
      isLoading: false,
      error: null,
    });

    render(<HistoricoTimeline planoId="relatorio-1" modulo="relatorio" />);

    expect(screen.getByText("Relatório submetido para análise")).toBeInTheDocument();
    expect(screen.getByText("Rascunho")).toBeInTheDocument();
    expect(screen.getByText("Aguardando Analista")).toBeInTheDocument();
  });
});
