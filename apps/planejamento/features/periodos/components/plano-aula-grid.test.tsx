import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlanoAulaGrid } from "./plano-aula-grid";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("turmaId=turma-1"),
}));

const periodo = (id: string, dataInicio: string, numero = 1) => ({
  id,
  numero,
  descricao: id,
  dataInicio,
  dataFim: dataInicio,
  dataMaximaEntrega: dataInicio,
});

describe("PlanoAulaGrid", () => {
  it("classifica 01/01 no primeiro semestre usando data civil", () => {
    render(<PlanoAulaGrid periodos={[periodo("p1", "2026-01-01")]} />);

    expect(
      screen.getByRole("heading", { name: "1º Semestre" }).closest("section"),
    ).toHaveTextContent("p1");
    expect(
      screen.queryByRole("heading", { name: "2º Semestre" }),
    ).not.toBeInTheDocument();
  });

  it("usa data civil de férias como divisor entre semestres", () => {
    render(
      <PlanoAulaGrid
        dataInicioFeriasJulho="2026-07-13"
        periodos={[
          periodo("antes-das-ferias", "2026-07-12", 1),
          periodo("inicio-das-ferias", "2026-07-13", 2),
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "1º Semestre" }).closest("section"),
    ).toHaveTextContent("antes-das-ferias");
    expect(
      screen.getByRole("heading", { name: "2º Semestre" }).closest("section"),
    ).toHaveTextContent("inicio-das-ferias");
  });

  it("ignora plano aprovado de outra turma ao calcular bloqueio", () => {
    render(
      <PlanoAulaGrid
        turmaId="turma-1"
        periodos={[
          periodo("p1", "2026-01-01", 1),
          periodo("p2", "2026-01-02", 2),
        ]}
        planosExistentes={[
          {
            id: "plano-outra-turma",
            turmaId: "turma-2",
            planoAulaPeriodoId: "p1",
            status: "APROVADO",
          },
        ]}
      />,
    );

    expect(screen.getByText("Aprove o plano anterior para liberar")).toBeInTheDocument();
  });
});
