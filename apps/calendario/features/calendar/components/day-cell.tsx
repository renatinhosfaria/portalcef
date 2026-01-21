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
  parseISO,
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
  "REUNIAO_PEDAGOGICA",
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
  const dayOfWeek = getDay(date);

  // Helper para converter data sem problemas de timezone
  // Extrai ano/mês/dia diretamente da string ISO para evitar conversão UTC
  const toLocalDate = (dateInput: string | Date): Date => {
    let dateStr: string;
    if (typeof dateInput === "string") {
      dateStr = dateInput;
    } else {
      // Se é Date, converter para ISO string
      dateStr = dateInput.toISOString();
    }
    // Extrair apenas "YYYY-MM-DD" da string (ignorar hora e timezone)
    const datePart = dateStr.split("T")[0] ?? dateStr; // "2026-02-02"
    const parts = datePart.split("-").map(Number);
    const year = parts[0] ?? 2026;
    const month = parts[1] ?? 1;
    const day = parts[2] ?? 1;
    return new Date(year, month - 1, day); // month é 0-indexed no JS
  };

  // Get events for this specific day
  const dayEvents = events.filter((event) => {
    const eventStart = toLocalDate(event.startDate);
    const eventEnd = toLocalDate(event.endDate);
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

  // Verifica se é sábado letivo (tem evento SABADO_LETIVO)
  const hasSabadoLetivo = dayEvents.some(
    (event) => event.eventType === "SABADO_LETIVO",
  );

  // Domingo (0) = sempre vermelho | Sábado (6) sem sábado letivo = vermelho
  const isDomingo = dayOfWeek === 0;
  const isSabadoNaoLetivo = dayOfWeek === 6 && !hasSabadoLetivo;
  const isNonSchoolWeekend = isDomingo || isSabadoNaoLetivo;

  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // Determine background color based on primary event or weekend
  const getDayBackground = () => {
    if (!isCurrentMonth) return "bg-slate-100/50";
    // Evento tem prioridade sobre cor de fim de semana
    if (primaryEvent) {
      const config = eventTypeConfig[primaryEvent.eventType];
      return config.bgColor;
    }
    // 🔴 Vermelho para domingos e sábados não letivos
    if (isNonSchoolWeekend) return "bg-red-500";
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
    // 🔴 Texto branco para domingos e sábados não letivos
    if (isNonSchoolWeekend) return "text-white";
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
                : isNonSchoolWeekend
                  ? "text-white/80"
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
