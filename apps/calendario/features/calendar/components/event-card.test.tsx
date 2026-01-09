import type { CalendarEvent } from "@essencia/shared/schemas/calendar";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EventCard } from "./event-card";

describe("EventCard", () => {
  const mockEvent: CalendarEvent = {
    id: "event-1",
    unitId: "unit-1",
    title: "Feriado de Carnaval",
    description: "Carnaval 2026",
    eventType: "FERIADO",
    startDate: new Date("2026-02-16"),
    endDate: new Date("2026-02-17"),
    isSchoolDay: false,
    isRecurringAnnually: true,
    createdBy: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("should render event title", () => {
    render(<EventCard event={mockEvent} />);

    expect(screen.getByText("Feriado de Carnaval")).toBeInTheDocument();
  });

  it("should render event type badge", () => {
    render(<EventCard event={mockEvent} />);

    expect(screen.getByText("Feriado")).toBeInTheDocument();
  });

  it("should render date range for multi-day events", () => {
    render(<EventCard event={mockEvent} />);

    // The rendered format depends on locale - check for the date text pattern
    const dateText = screen.getByText(/\d{2}\/\d{2} - \d{2}\/\d{2}/);
    expect(dateText).toBeInTheDocument();
  });

  it("should render single date for single-day events", () => {
    const singleDayEvent = {
      ...mockEvent,
      endDate: mockEvent.startDate,
    };
    render(<EventCard event={singleDayEvent} />);

    // Check for "de fevereiro" pattern which appears in single day format
    expect(screen.getByText(/de fevereiro/i)).toBeInTheDocument();
  });

  it("should show edit button when canEdit is true", () => {
    render(<EventCard event={mockEvent} canEdit={true} />);

    // Edit button has Pencil icon
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("should call onEdit when edit button is clicked", async () => {
    const onEdit = vi.fn();
    render(<EventCard event={mockEvent} canEdit={true} onEdit={onEdit} />);

    const buttons = screen.getAllByRole("button");
    const editButton = buttons[0];
    expect(editButton).toBeDefined();
    await userEvent.click(editButton!);

    expect(onEdit).toHaveBeenCalledWith(mockEvent);
  });

  it("should show delete button when canDelete is true", () => {
    render(<EventCard event={mockEvent} canDelete={true} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("should call onDelete when delete button is clicked", async () => {
    const onDelete = vi.fn();
    render(
      <EventCard event={mockEvent} canDelete={true} onDelete={onDelete} />,
    );

    const buttons = screen.getAllByRole("button");
    const deleteButton = buttons[0];
    expect(deleteButton).toBeDefined();
    await userEvent.click(deleteButton!);

    expect(onDelete).toHaveBeenCalledWith(mockEvent);
  });

  it("should render compact version correctly", () => {
    render(<EventCard event={mockEvent} compact={true} />);

    const card = screen.getByText("Feriado de Carnaval");
    expect(card).toHaveClass("truncate");
  });

  it("should not show 'Dia Letivo' indicator when isSchoolDay is false", () => {
    render(<EventCard event={mockEvent} />);

    expect(screen.queryByText(/Dia Letivo/i)).not.toBeInTheDocument();
  });

  it("should show 'Dia Letivo' indicator when isSchoolDay is true", () => {
    const schoolDayEvent = {
      ...mockEvent,
      isSchoolDay: true,
    };
    render(<EventCard event={schoolDayEvent} />);

    expect(screen.getByText(/Dia Letivo/i)).toBeInTheDocument();
  });
});
