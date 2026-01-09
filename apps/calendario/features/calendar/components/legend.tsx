"use client";

import type { CalendarEventType } from "@essencia/shared/schemas/calendar";
import { eventTypeConfig } from "@essencia/shared/types/calendar";

import { cn } from "@essencia/ui/lib/utils";

interface LegendProps {
  className?: string;
}

const eventTypes: CalendarEventType[] = [
  "DIA_LETIVO",
  "FERIADO",
  "RECESSO",
  "FERIAS_PROFESSORES",
  "SABADO_LETIVO",
  "SEMANA_PROVAS",
  "REUNIAO_PEDAGOGICA",
  "EVENTO_ESPECIAL",
  "INICIO_SEMESTRE",
  "TERMINO_SEMESTRE",
];

export function Legend({ className }: LegendProps) {
  return (
    <div className={cn("bg-white rounded-lg border p-4", className)}>
      <h3 className="font-semibold text-sm text-slate-900 mb-3">Legenda</h3>
      <div className="grid grid-cols-2 gap-2">
        {eventTypes.map((type) => {
          const config = eventTypeConfig[type];
          return (
            <div key={type} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-3 h-3 rounded-sm border",
                  config.bgColor,
                  config.borderColor,
                )}
              />
              <span className="text-xs text-slate-600">{config.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
