import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DayCell } from "./day-cell";

describe("DayCell", () => {
  it("não seleciona dia de mês adjacente para criar evento", () => {
    const onSelectDate = vi.fn();
    const { container } = render(
      <DayCell
        date={new Date(2027, 1, 28)}
        currentMonth={new Date(2027, 2, 15)}
        events={[]}
        onSelectDate={onSelectDate}
      />,
    );

    container.firstElementChild?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );

    expect(onSelectDate).not.toHaveBeenCalled();
  });

  it("permite abrir um evento pelo teclado", () => {
    const onSelectEvent = vi.fn();
    const event = {
      id: "event-a",
      title: "Reunião pedagógica",
      startDate: new Date(2027, 2, 15),
      endDate: new Date(2027, 2, 15),
      eventType: "REUNIAO_PEDAGOGICA",
    } as never;

    render(
      <DayCell
        date={new Date(2027, 2, 15)}
        currentMonth={new Date(2027, 2, 1)}
        events={[event]}
        onSelectEvent={onSelectEvent}
      />,
    );

    const eventButton = screen.getByRole("button", {
      name: "Reunião pedagógica",
    });
    fireEvent.keyDown(eventButton, { key: "Enter" });

    expect(onSelectEvent).toHaveBeenCalledWith(event);
  });
});
