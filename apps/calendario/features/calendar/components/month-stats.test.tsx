import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MonthStats } from "./month-stats";

describe("MonthStats", () => {
  it("should display month stats for 2026", () => {
    const marchDate = new Date(2026, 2, 15); // March 15, 2026
    render(<MonthStats currentDate={marchDate} />);

    expect(screen.getByText("Estatísticas - Março")).toBeInTheDocument();
    expect(screen.getByText("22")).toBeInTheDocument(); // March has 22 school days
    expect(screen.getByText("31")).toBeInTheDocument(); // March has 31 total days
  });

  it("should show message for non-2026 years", () => {
    const date2025 = new Date(2025, 2, 15);
    render(<MonthStats currentDate={date2025} />);

    expect(
      screen.getByText("Dados disponíveis apenas para 2026"),
    ).toBeInTheDocument();
  });

  it("should display percentage progress", () => {
    const marchDate = new Date(2026, 2, 15);
    render(<MonthStats currentDate={marchDate} />);

    // 22/31 = ~71%
    expect(screen.getByText("71%")).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const marchDate = new Date(2026, 2, 15);
    const { container } = render(
      <MonthStats currentDate={marchDate} className="custom-class" />,
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });
});
