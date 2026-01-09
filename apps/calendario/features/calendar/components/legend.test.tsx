import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Legend } from "./legend";

describe("Legend", () => {
  it("should render all event types", () => {
    render(<Legend />);

    expect(screen.getByText("Legenda")).toBeInTheDocument();
    expect(screen.getByText("Feriado")).toBeInTheDocument();
    expect(screen.getByText("Recesso")).toBeInTheDocument();
    expect(screen.getByText("Dia Letivo")).toBeInTheDocument();
    expect(screen.getByText("Sábado Letivo")).toBeInTheDocument();
    expect(screen.getByText("Semana de Provas")).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const { container } = render(<Legend className="custom-class" />);

    expect(container.firstChild).toHaveClass("custom-class");
  });
});
