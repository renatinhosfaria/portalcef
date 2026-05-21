import { render, screen } from "@testing-library/react";
import { PeriodosList } from "./periodos-list";
import { describe, it, expect, vi } from "vitest";

describe("PeriodosList", () => {
  it("deve renderizar lista vazia quando não há períodos", () => {
    render(
      <PeriodosList
        periodos={[]}
        etapa="INFANTIL"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(/nenhum plano de aula/i)).toBeInTheDocument();
  });

  it("deve renderizar períodos da etapa", () => {
    const periodos = [
      {
        id: "1",
        numero: 1,
        etapa: "INFANTIL",
        descricao: "Tema: Meio Ambiente",
        dataInicio: "2026-03-01",
        dataFim: "2026-03-15",
        dataMaximaEntrega: "2026-02-25",
        unidadeId: "unidade-1",
        criadoEm: "2026-01-01T00:00:00Z",
        atualizadoEm: "2026-01-01T00:00:00Z",
      },
    ];

    render(
      <PeriodosList
        periodos={periodos}
        etapa="INFANTIL"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("1º Plano de Aula")).toBeInTheDocument();
    expect(screen.getByText("Tema: Meio Ambiente")).toBeInTheDocument();
    expect(screen.getByText(/Período:/).parentElement).toHaveTextContent(
      "01/03/2026 até 15/03/2026",
    );
    expect(
      screen.getByText(/Prazo de Entrega:/).parentElement,
    ).toHaveTextContent("25/02/2026");
  });

  it("não renderiza zero no título quando não há planos vinculados", () => {
    const periodos = [
      {
        id: "1",
        numero: 1,
        etapa: "INFANTIL",
        descricao: "Tema: Meio Ambiente",
        dataInicio: "2026-03-01",
        dataFim: "2026-03-15",
        dataMaximaEntrega: "2026-02-25",
        planosVinculados: 0,
        unidadeId: "unidade-1",
        criadoEm: "2026-01-01T00:00:00Z",
        atualizadoEm: "2026-01-01T00:00:00Z",
      },
    ];

    render(
      <PeriodosList
        periodos={periodos}
        etapa="INFANTIL"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("1º Plano de Aula")).toHaveTextContent(
      "1º Plano de Aula",
    );
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
