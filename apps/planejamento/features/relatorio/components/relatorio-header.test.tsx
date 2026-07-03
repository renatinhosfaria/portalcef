import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RelatorioHeader } from "./relatorio-header";

describe("RelatorioHeader", () => {
  it("exibe as informações de capa do relatório no mesmo padrão do plano de aula", () => {
    render(
      <RelatorioHeader
        professorName="Patrícia Kelly"
        turmaName="Infantil 2"
        turmaCode="INF-2-M"
        semestreNumero={1}
        semestreDescricao="Relatório Infantil"
        semestreInicio="2026-02-01"
        semestreFim="2026-06-30"
        prazoEntrega="2026-06-20"
        etapaNome="Infantil"
        status="AGUARDANDO_ANALISTA"
        submittedAt="2026-06-30T09:44:00.000Z"
      />,
    );

    expect(screen.getByRole("heading", { name: "Relatório Infantil" })).toBeInTheDocument();
    expect(screen.getByText("01/02/2026 - 30/06/2026")).toBeInTheDocument();
    expect(screen.getByText("Patrícia Kelly")).toBeInTheDocument();
    expect(screen.getByText("Infantil 2")).toBeInTheDocument();
    expect(screen.getByText("(INF-2-M)")).toBeInTheDocument();
    expect(screen.getByText("Infantil")).toBeInTheDocument();
    expect(screen.getByText("30 de junho de 2026 às 06:44")).toBeInTheDocument();
    expect(screen.getByText("Aguardando Analista")).toBeInTheDocument();
    expect(screen.getByText("20 de junho de 2026")).toBeInTheDocument();
  });
});
