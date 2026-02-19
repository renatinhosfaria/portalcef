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
  });
});
