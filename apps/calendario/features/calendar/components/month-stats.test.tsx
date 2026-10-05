import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MonthStats } from "./month-stats";

describe("MonthStats", () => {
  const stats = {
    year: 2027,
    totalSchoolDays: 200,
    totalEvents: 12,
    monthlyStats: [{ month: 3, schoolDays: 22, totalDays: 31, events: 4 }],
  };

  it("displays the statistics returned for the selected month", () => {
    const marchDate = new Date(2027, 2, 15);
    render(<MonthStats currentDate={marchDate} stats={stats} />);

    expect(screen.getByText("Estatísticas - Março")).toBeInTheDocument();
    expect(screen.getByText("22")).toBeInTheDocument(); // March has 22 school days
    expect(screen.getByText("31")).toBeInTheDocument(); // March has 31 total days
  });

  it("shows a loading message while statistics are unavailable", () => {
    const date = new Date(2027, 2, 15);
    render(<MonthStats currentDate={date} stats={null} />);

    expect(screen.getByText("Estatísticas indisponíveis")).toBeInTheDocument();
  });

  it("should display percentage progress", () => {
    const marchDate = new Date(2027, 2, 15);
    render(<MonthStats currentDate={marchDate} stats={stats} />);

    // 22/31 = ~71%
    expect(screen.getByText("71%")).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const marchDate = new Date(2027, 2, 15);
    const { container } = render(
      <MonthStats
        currentDate={marchDate}
        stats={stats}
        className="custom-class"
      />,
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });
});
