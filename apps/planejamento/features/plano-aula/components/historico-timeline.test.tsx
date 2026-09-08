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

    expect(
      screen.getByText("Relatório submetido para análise"),
    ).toBeInTheDocument();
    expect(screen.getByText("Rascunho")).toBeInTheDocument();
    expect(screen.getByText("Aguardando Analista")).toBeInTheDocument();
  });

  it("renderiza exclusão com label, ícone, cor e detalhes amigáveis", () => {
    const historico: HistoricoEntry[] = [
      {
        id: "historico-exclusao",
        planoId: "relatorio-1",
        userId: "gestora-1",
        userName: "Gestora",
        userRole: "gerente_unidade",
        acao: "DOCUMENTO_EXCLUIDO",
        statusAnterior: "RASCUNHO",
        statusNovo: "RASCUNHO",
        detalhes: {
          documentoId: "documento-1",
          documentoNome: "relatorio-final.pdf",
          documentoTipo: "ARQUIVO",
          tamanhoBytes: 12345,
          motivo: "Arquivo enviado com informações incorretas",
        },
        createdAt: "2026-09-08T12:00:00.000Z",
      },
    ];

    mockUseHistorico.mockReturnValue({
      historico,
      isLoading: false,
      error: null,
    });

    render(<HistoricoTimeline planoId="relatorio-1" modulo="relatorio" />);

    expect(
      screen.getByText("Documento do relatório excluído"),
    ).toBeInTheDocument();
    expect(document.querySelector("svg.lucide-trash2")).toBeInTheDocument();
    expect(
      document.querySelector(".bg-red-100.text-red-600"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Arquivo: relatorio-final\.pdf/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Motivo: Arquivo enviado com informações incorretas/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/documento-1|ARQUIVO|12345/),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["plano-aula", "Documento do plano excluído"],
    ["prova", "Documento da prova excluído"],
    ["relatorio", "Documento do relatório excluído"],
  ] as const)(
    "renderiza o label de exclusão para o módulo %s",
    (modulo, labelEsperado) => {
      const historico: HistoricoEntry[] = [
        {
          id: `historico-exclusao-${modulo}`,
          planoId: `${modulo}-1`,
          userId: "gestora-1",
          userName: "Gestora",
          userRole: "gerente_unidade",
          acao: "DOCUMENTO_EXCLUIDO",
          statusAnterior: "RASCUNHO",
          statusNovo: "RASCUNHO",
          detalhes: null,
          createdAt: "2026-09-08T12:00:00.000Z",
        },
      ];

      mockUseHistorico.mockReturnValue({
        historico,
        isLoading: false,
        error: null,
      });

      render(<HistoricoTimeline planoId={`${modulo}-1`} modulo={modulo} />);

      expect(screen.getByText(labelEsperado)).toBeInTheDocument();
    },
  );
});
