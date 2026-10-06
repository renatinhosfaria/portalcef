import type { CalendarEvent } from "@essencia/shared/schemas/calendar";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EventForm } from "./event-form";

describe("EventForm", () => {
  it("atualiza os campos quando o evento selecionado muda", () => {
    const primeiro = {
      id: "event-a",
      title: "Primeiro evento",
      description: null,
      eventType: "FERIADO",
      startDate: new Date("2027-02-10"),
      endDate: new Date("2027-02-10"),
      isSchoolDay: false,
      isRecurringAnnually: false,
    } as CalendarEvent;
    const segundo = {
      ...primeiro,
      id: "event-b",
      title: "Segundo evento",
      eventType: "RECESSO",
    } as CalendarEvent;

    const { rerender } = render(
      <EventForm
        open
        onOpenChange={vi.fn()}
        event={primeiro}
        unitId="unit-a"
        onSubmit={async () => true}
      />,
    );

    rerender(
      <EventForm
        open
        onOpenChange={vi.fn()}
        event={segundo}
        unitId="unit-a"
        onSubmit={async () => true}
      />,
    );

    expect(screen.getByLabelText("Título *")).toHaveValue("Segundo evento");
  });
});
