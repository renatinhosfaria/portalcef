"use client";

import { getMonth } from "date-fns";

import { cn } from "@essencia/ui/lib/utils";
import type { CalendarStats } from "@/lib/api";

interface MonthStatsProps {
  currentDate: Date;
  stats: CalendarStats | null;
  className?: string;
}

export function MonthStats({ currentDate, stats, className }: MonthStatsProps) {
  const currentMonth = getMonth(currentDate) + 1;
  const monthStats = stats?.monthlyStats.find((m) => m.month === currentMonth);
  const monthName = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
  }).format(currentDate);

  if (!stats || !monthStats) {
    return (
      <div className={cn("bg-white rounded-lg border p-4", className)}>
        <h3 className="font-semibold text-sm text-slate-900 mb-2">
          Estatísticas do Mês
        </h3>
        <p className="text-xs text-slate-500">Estatísticas indisponíveis</p>
      </div>
    );
  }

  const percentage = Math.round(
    (monthStats.schoolDays / monthStats.totalDays) * 100,
  );

  return (
    <div className={cn("bg-white rounded-lg border p-4", className)}>
      <h3 className="font-semibold text-sm text-slate-900 mb-3">
        {`Estatísticas - ${monthName.charAt(0).toUpperCase()}${monthName.slice(1)}`}
      </h3>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">Dias Letivos</span>
          <span className="font-semibold text-slate-900">
            {monthStats.schoolDays}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">Total de Dias</span>
          <span className="font-medium text-slate-700">
            {monthStats.totalDays}
          </span>
        </div>

        <div className="pt-2 border-t">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-slate-500">Aproveitamento</span>
            <span className="text-xs font-medium text-slate-700">
              {percentage}%
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
