import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CiclosList } from "./ciclos-list";

const cicloBase = {
  id: "ciclo-1",
  unidadeId: "unidade-1",
  etapa: "INFANTIL",
  numero: 1,
  descricao: "Primeira avaliação",
  dataInicio: "2026-03-01",
  dataFim: "2026-03-15",
  dataMaximaEntrega: "2026-02-25",
  criadoEm: "2026-01-01T00:00:00Z",
  atualizadoEm: "2026-01-01T00:00:00Z",
};

describe("CiclosList", () => {
  it("não renderiza zero no título quando não há provas vinculadas", () => {
    render(
      <CiclosList
        ciclos={[{ ...cicloBase, provasVinculadas: 0 }]}
        etapa="INFANTIL"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("1a Prova")).toHaveTextContent("1a Prova");
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("usa nomes acessíveis nos botões de editar e excluir", () => {
    render(
      <CiclosList
        ciclos={[cicloBase]}
        etapa="INFANTIL"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Editar 1a Prova" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Excluir 1a Prova" }),
    ).toBeInTheDocument();
  });
});
