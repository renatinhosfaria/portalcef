import { render, screen } from "@testing-library/react";
import { PeriodosEmptyState } from "./periodos-empty-state";
import { describe, it, expect } from "vitest";

describe("PeriodosEmptyState", () => {
  it("deve renderizar mensagem quando não há períodos", () => {
    render(<PeriodosEmptyState etapa="INFANTIL" />);
    expect(
      screen.getByText(/nenhum plano de aula disponível/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/infantil/i)).toBeInTheDocument();
  });
});
