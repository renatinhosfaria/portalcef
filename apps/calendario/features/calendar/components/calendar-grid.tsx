"use client";

import type { CalendarEvent } from "@essencia/shared/schemas/calendar";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import { DayCell } from "./day-cell";

interface CalendarGridProps {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectDate?: (date: Date) => void;
  onSelectEvent?: (event: CalendarEvent) => void;
}

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function CalendarGrid({
  currentDate,
  events,
  onSelectDate,
  onSelectEvent,
}: CalendarGridProps) {
  // Get all days to display (including days from prev/next months)
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Week days header */}
      <div className="grid grid-cols-7 bg-slate-50 border-b">
        {weekDays.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-sm font-medium text-slate-600 border-r last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => (
          <DayCell
            key={day.toISOString()}
            date={day}
            events={events}
            currentMonth={currentDate}
            onSelectDate={onSelectDate}
            onSelectEvent={onSelectEvent}
          />
        ))}
      </div>
    </div>
  );
}
