import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { YearSummary } from "./year-summary";

describe("YearSummary", () => {
  it("should display year summary for 2026", () => {
    const date2026 = new Date(2026, 5, 15); // June 15, 2026
    render(<YearSummary currentDate={date2026} />);

    expect(screen.getByText("Resumo Anual - 2026")).toBeInTheDocument();
    expect(screen.getByText("200 dias")).toBeInTheDocument(); // Total school days
  });

  it("should show message for non-2026 years", () => {
    const date2025 = new Date(2025, 5, 15);
    render(<YearSummary currentDate={date2025} />);

    expect(
      screen.getByText("Dados disponíveis apenas para 2026"),
    ).toBeInTheDocument();
  });

  it("should display cumulative days", () => {
    const juneDate = new Date(2026, 5, 15); // June = month 6
    render(<YearSummary currentDate={juneDate} />);

    // Sum of school days Jan-Jun: 0+17+22+18+21+21 = 99
    expect(screen.getByText("99")).toBeInTheDocument();
  });

  it("should display remaining days", () => {
    const juneDate = new Date(2026, 5, 15);
    render(<YearSummary currentDate={juneDate} />);

    // 200 - 99 = 101
    expect(screen.getByText("101")).toBeInTheDocument();
  });

  it("should display semester breakdown", () => {
    const date2026 = new Date(2026, 0, 15);
    render(<YearSummary currentDate={date2026} />);

    // 1st semester: 0+17+22+18+21+21 = 99
    // 2nd semester: 11+21+21+17+20+11 = 101
    expect(screen.getByText("99 dias")).toBeInTheDocument();
    expect(screen.getByText("101 dias")).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const date2026 = new Date(2026, 0, 15);
    const { container } = render(
      <YearSummary currentDate={date2026} className="custom-class" />,
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });
});
