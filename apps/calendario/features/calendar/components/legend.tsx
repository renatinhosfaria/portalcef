"use client";

import type { CalendarEventType } from "@essencia/shared/schemas/calendar";
import { eventTypeConfig } from "@essencia/shared/types/calendar";

import { cn } from "@essencia/ui/lib/utils";

interface LegendProps {
  className?: string;
}

// Ordem conforme calendário oficial 2026
const eventTypes: CalendarEventType[] = [
  "DIA_LETIVO", // ⬜ Branco - Dias letivos
  "SABADO_LETIVO", // 🟠 Laranja - Sábados Letivos
  "INICIO_SEMESTRE", // 🔵 Azul - Início do semestre
  "TERMINO_SEMESTRE", // 🔵 Azul - Término do semestre
  "FERIADO", // 🟣 Roxo - Feriados
  "RECESSO", // 🟣 Roxo - Recessos
  "FERIAS_PROFESSORES", // 🟡 Amarelo - Férias dos Professores
  "REUNIAO_PEDAGOGICA", // 🟢 Verde - Dia Escolar
  "SEMANA_PROVAS", // 🔷 Azul Escuro - Semana de Provas
  "EVENTO_ESPECIAL", // Rosa - Evento Especial
];

// Item especial para Domingos e Sábados não letivos (não é um tipo de evento do banco)
const weekendLegendItem = {
  label: "Domingo / Sábado",
  bgColor: "bg-red-500",
  borderColor: "border-red-600",
};

export function Legend({ className }: LegendProps) {
  return (
    <div className={cn("bg-white rounded-lg border p-4", className)}>
      <h3 className="font-semibold text-sm text-slate-900 mb-3">Legenda</h3>
      <div className="grid grid-cols-2 gap-2">
        {/* 🔴 Vermelho - Domingos e Sábados não letivos (primeiro item) */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-3 h-3 rounded-sm border",
              weekendLegendItem.bgColor,
              weekendLegendItem.borderColor,
            )}
          />
          <span className="text-xs text-slate-600">
            {weekendLegendItem.label}
          </span>
        </div>

        {/* Demais tipos de evento */}
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
