import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CalendarHeader } from "./calendar-header";

describe("CalendarHeader", () => {
  const mockDate = new Date(2026, 0, 15); // January 15, 2026

  it("should display current month and year", () => {
    render(
      <CalendarHeader
        currentDate={mockDate}
        onPrevMonth={vi.fn()}
        onNextMonth={vi.fn()}
        onToday={vi.fn()}
      />,
    );

    expect(screen.getByText(/janeiro 2026/i)).toBeInTheDocument();
  });

  it("should call onPrevMonth when clicking previous button", async () => {
    const onPrevMonth = vi.fn();
    render(
      <CalendarHeader
        currentDate={mockDate}
        onPrevMonth={onPrevMonth}
        onNextMonth={vi.fn()}
        onToday={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole("button");
    const prevButton = buttons[0];
    expect(prevButton).toBeDefined();
    await userEvent.click(prevButton!);

    expect(onPrevMonth).toHaveBeenCalledTimes(1);
  });

  it("should call onNextMonth when clicking next button", async () => {
    const onNextMonth = vi.fn();
    render(
      <CalendarHeader
        currentDate={mockDate}
        onPrevMonth={vi.fn()}
        onNextMonth={onNextMonth}
        onToday={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole("button");
    const nextButton = buttons[1];
    expect(nextButton).toBeDefined();
    await userEvent.click(nextButton!);

    expect(onNextMonth).toHaveBeenCalledTimes(1);
  });

  it("should call onToday when clicking today button", async () => {
    const onToday = vi.fn();
    render(
      <CalendarHeader
        currentDate={mockDate}
        onPrevMonth={vi.fn()}
        onNextMonth={vi.fn()}
        onToday={onToday}
      />,
    );

    await userEvent.click(screen.getByText("Hoje"));

    expect(onToday).toHaveBeenCalledTimes(1);
  });

  it("should show 'Novo Evento' button when canCreate is true", () => {
    render(
      <CalendarHeader
        currentDate={mockDate}
        onPrevMonth={vi.fn()}
        onNextMonth={vi.fn()}
        onToday={vi.fn()}
        onNewEvent={vi.fn()}
        canCreate={true}
      />,
    );

    expect(screen.getByText("Novo Evento")).toBeInTheDocument();
  });

  it("should hide 'Novo Evento' button when canCreate is false", () => {
    render(
      <CalendarHeader
        currentDate={mockDate}
        onPrevMonth={vi.fn()}
        onNextMonth={vi.fn()}
        onToday={vi.fn()}
      />,
    );

    expect(screen.queryByText("Novo Evento")).not.toBeInTheDocument();
  });
});
