import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { YearSummary } from "./year-summary";

describe("YearSummary", () => {
  const stats = {
    year: 2027,
    totalSchoolDays: 200,
    totalEvents: 12,
    monthlyStats: [
      { month: 1, schoolDays: 0, totalDays: 31, events: 1 },
      { month: 2, schoolDays: 17, totalDays: 28, events: 2 },
      { month: 3, schoolDays: 22, totalDays: 31, events: 1 },
      { month: 4, schoolDays: 18, totalDays: 30, events: 1 },
      { month: 5, schoolDays: 21, totalDays: 31, events: 1 },
      { month: 6, schoolDays: 21, totalDays: 30, events: 1 },
      { month: 7, schoolDays: 11, totalDays: 31, events: 1 },
      { month: 8, schoolDays: 21, totalDays: 31, events: 1 },
      { month: 9, schoolDays: 21, totalDays: 30, events: 1 },
      { month: 10, schoolDays: 17, totalDays: 31, events: 1 },
      { month: 11, schoolDays: 20, totalDays: 30, events: 1 },
      { month: 12, schoolDays: 11, totalDays: 31, events: 0 },
    ],
  };

  it("displays the selected year summary from API data", () => {
    const date2027 = new Date(2027, 5, 15);
    render(<YearSummary currentDate={date2027} stats={stats} />);

    expect(screen.getByText("Resumo Anual - 2027")).toBeInTheDocument();
    expect(screen.getByText("200 dias")).toBeInTheDocument(); // Total school days
  });

  it("shows an unavailable state when API data is missing", () => {
    const date = new Date(2027, 5, 15);
    render(<YearSummary currentDate={date} stats={null} />);

    expect(screen.getByText("Resumo anual indisponível")).toBeInTheDocument();
  });

  it("should display cumulative days", () => {
    const juneDate = new Date(2027, 5, 15);
    render(<YearSummary currentDate={juneDate} stats={stats} />);

    // Sum of school days Jan-Jun: 0+17+22+18+21+21 = 99
    expect(screen.getByText("99")).toBeInTheDocument();
  });

  it("should display remaining days", () => {
    const juneDate = new Date(2027, 5, 15);
    render(<YearSummary currentDate={juneDate} stats={stats} />);

    // 200 - 99 = 101
    expect(screen.getByText("101")).toBeInTheDocument();
  });

  it("should display semester breakdown", () => {
    const date2027 = new Date(2027, 0, 15);
    render(<YearSummary currentDate={date2027} stats={stats} />);

    // 1st semester: 0+17+22+18+21+21 = 99
    // 2nd semester: 11+21+21+17+20+11 = 101
    expect(screen.getByText("99 dias")).toBeInTheDocument();
    expect(screen.getByText("101 dias")).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const date2027 = new Date(2027, 0, 15);
    const { container } = render(
      <YearSummary
        currentDate={date2027}
        stats={stats}
        className="custom-class"
      />,
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });
});
