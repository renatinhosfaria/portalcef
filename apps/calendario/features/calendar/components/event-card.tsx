"use client";

import type { CalendarEvent } from "@essencia/shared/schemas/calendar";
import { eventTypeConfig } from "@essencia/shared/types/calendar";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@essencia/ui/components/button";
import { cn } from "@essencia/ui/lib/utils";

interface EventCardProps {
  event: CalendarEvent;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (event: CalendarEvent) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  compact?: boolean;
}

export function EventCard({
  event,
  onEdit,
  onDelete,
  canEdit = false,
  canDelete = false,
  compact = false,
}: EventCardProps) {
  const config = eventTypeConfig[event.eventType];

  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);
  const isSingleDay = isSameDay(startDate, endDate);

  if (compact) {
    return (
      <div
        className={cn(
          "px-1.5 py-0.5 rounded text-xs truncate cursor-pointer",
          config.bgColor,
          config.textColor,
          "hover:opacity-80 transition-opacity",
        )}
        title={event.title}
        onClick={() => onEdit?.(event)}
      >
        {event.title}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "p-3 rounded-lg border",
        config.bgColor,
        config.borderColor,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className={cn("font-medium text-sm", config.textColor)}>
            {event.title}
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSingleDay
              ? format(startDate, "dd 'de' MMMM", { locale: ptBR })
              : `${format(startDate, "dd/MM")} - ${format(endDate, "dd/MM")}`}
          </p>
          {event.description && (
            <p className="text-xs text-slate-600 mt-1 line-clamp-2">
              {event.description}
            </p>
          )}
        </div>

        {(canEdit || canDelete) && (
          <div className="flex gap-1">
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onEdit?.(event)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => onDelete?.(event)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-2">
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
            config.bgColor,
            config.textColor,
          )}
        >
          {config.label}
        </span>
        {event.isSchoolDay && (
          <span className="text-xs text-green-600">• Dia Letivo</span>
        )}
      </div>
    </div>
  );
}
