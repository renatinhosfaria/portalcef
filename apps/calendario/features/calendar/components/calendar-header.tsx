"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@essencia/ui/components/button";

interface CalendarHeaderProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onNewEvent?: () => void;
  canCreate?: boolean;
}

export function CalendarHeader({
  currentDate,
  onPrevMonth,
  onNextMonth,
  onToday,
  onNewEvent,
  canCreate = false,
}: CalendarHeaderProps) {
  const monthYear = format(currentDate, "MMMM yyyy", { locale: ptBR });

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={onPrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={onNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-semibold capitalize ml-2">{monthYear}</h2>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onToday}>
          Hoje
        </Button>
        {canCreate && (
          <Button onClick={onNewEvent}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Evento
          </Button>
        )}
      </div>
    </div>
  );
}
