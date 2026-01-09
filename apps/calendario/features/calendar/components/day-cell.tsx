"use client";

import type {
  CalendarEvent,
  CalendarEventType,
} from "@essencia/shared/schemas/calendar";
import { eventTypeConfig } from "@essencia/shared/types/calendar";
import {
  format,
  getDay,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  isWeekend,
} from "date-fns";

import { cn } from "@essencia/ui/lib/utils";

interface DayCellProps {
  date: Date;
  events: CalendarEvent[];
  currentMonth: Date;
  onSelectDate?: (date: Date) => void;
  onSelectEvent?: (event: CalendarEvent) => void;
}

// Prioridade de eventos para colorir o dia (menor número = maior prioridade)
const EVENT_PRIORITY: Record<CalendarEventType, number> = {
  FERIADO: 1,
  RECESSO: 2,
  FERIAS_PROFESSORES: 3,
  INICIO_SEMESTRE: 4,
  TERMINO_SEMESTRE: 5,
  SEMANA_PROVAS: 6,
  SABADO_LETIVO: 7,
  EVENTO_ESPECIAL: 8,
  REUNIAO_PEDAGOGICA: 9,
  DIA_LETIVO: 10,
};

// Eventos que colorem o dia inteiro (não apenas um badge)
const FULL_DAY_EVENT_TYPES: CalendarEventType[] = [
  "FERIADO",
  "RECESSO",
  "FERIAS_PROFESSORES",
  "INICIO_SEMESTRE",
  "TERMINO_SEMESTRE",
  "SEMANA_PROVAS",
  "SABADO_LETIVO",
];

export function DayCell({
  date,
  events,
  currentMonth,
  onSelectDate,
  onSelectEvent,
}: DayCellProps) {
  const isCurrentMonth = isSameMonth(date, currentMonth);
  const isTodayDate = isToday(date);
  const isWeekendDay = isWeekend(date);
  const dayNumber = format(date, "d");

  // Get events for this specific day
  const dayEvents = events.filter((event) => {
    const eventStart = new Date(event.startDate);
    const eventEnd = new Date(event.endDate);
    return (
      isSameDay(date, eventStart) ||
      isSameDay(date, eventEnd) ||
      (isAfter(date, eventStart) && isBefore(date, eventEnd))
    );
  });

  // Sort events by priority and get the primary event that should color the day
  const sortedEvents = [...dayEvents].sort(
    (a, b) => EVENT_PRIORITY[a.eventType] - EVENT_PRIORITY[b.eventType],
  );

  const primaryEvent = sortedEvents.find((event) =>
    FULL_DAY_EVENT_TYPES.includes(event.eventType),
  );

  // Get day of week for display
  const dayOfWeek = getDay(date);
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // Determine background color based on primary event
  const getDayBackground = () => {
    if (!isCurrentMonth) return "bg-slate-100/50";
    if (primaryEvent) {
      const config = eventTypeConfig[primaryEvent.eventType];
      return config.bgColor;
    }
    if (isWeekendDay) return "bg-slate-50";
    return "bg-white";
  };

  // Determine text color for day number based on background
  const getDayNumberColor = () => {
    if (!isCurrentMonth) return "text-slate-400";
    if (isTodayDate) return ""; // Handled by badge
    if (primaryEvent) {
      const config = eventTypeConfig[primaryEvent.eventType];
      return config.textColor;
    }
    if (isWeekendDay) return "text-slate-500";
    return "text-slate-900";
  };

  return (
    <div
      className={cn(
        "min-h-[100px] p-1 border-b border-r cursor-pointer transition-colors relative",
        getDayBackground(),
        isTodayDate && "ring-2 ring-inset ring-green-500",
        "hover:opacity-90",
      )}
      onClick={() => onSelectDate?.(date)}
    >
      {/* Day number */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            "text-sm font-semibold w-6 h-6 flex items-center justify-center rounded-full",
            getDayNumberColor(),
            isTodayDate && "bg-green-500 text-white",
          )}
        >
          {dayNumber}
        </span>
        {isWeekendDay && (
          <span
            className={cn(
              "text-[10px]",
              primaryEvent
                ? eventTypeConfig[primaryEvent.eventType].textColor
                : "text-slate-400",
            )}
          >
            {dayNames[dayOfWeek]}
          </span>
        )}
      </div>

      {/* Primary event title (for full-day events) */}
      {primaryEvent && (
        <div
          className={cn(
            "text-[10px] font-medium px-1 py-0.5 truncate cursor-pointer",
            eventTypeConfig[primaryEvent.eventType].textColor,
          )}
          title={primaryEvent.title}
          onClick={(e) => {
            e.stopPropagation();
            onSelectEvent?.(primaryEvent);
          }}
        >
          {primaryEvent.title}
        </div>
      )}

      {/* Other events (non-primary or additional events) */}
      <div className="space-y-0.5 overflow-hidden">
        {sortedEvents
          .filter((event) => event.id !== primaryEvent?.id)
          .slice(0, 2)
          .map((event) => {
            const config = eventTypeConfig[event.eventType];
            return (
              <div
                key={event.id}
                className={cn(
                  "text-[10px] px-1 py-0.5 rounded truncate cursor-pointer",
                  config.bgColor,
                  config.textColor,
                  "hover:opacity-80",
                )}
                title={event.title}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEvent?.(event);
                }}
              >
                {event.title}
              </div>
            );
          })}
        {sortedEvents.length > (primaryEvent ? 3 : 2) && (
          <div
            className={cn(
              "text-[10px] px-1",
              primaryEvent
                ? eventTypeConfig[primaryEvent.eventType].textColor
                : "text-slate-500",
            )}
          >
            +{sortedEvents.length - (primaryEvent ? 3 : 2)} mais
          </div>
        )}
      </div>
    </div>
  );
}
