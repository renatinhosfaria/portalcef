"use client";

import type { MonthlyStats } from "@essencia/shared/types/calendar";
import {
  monthlyStats2026,
  TOTAL_SCHOOL_DAYS_2026,
} from "@essencia/shared/types/calendar";
import { getMonth, getYear } from "date-fns";

import { cn } from "@essencia/ui/lib/utils";

interface MonthStatsProps {
  currentDate: Date;
  className?: string;
}

export function MonthStats({ currentDate, className }: MonthStatsProps) {
  const currentMonth = getMonth(currentDate) + 1;
  const currentYear = getYear(currentDate);

  // For 2026, use reference data. For other years, show placeholder
  const stats =
    currentYear === 2026
      ? monthlyStats2026.find((m) => m.month === currentMonth)
      : null;

  if (!stats) {
    return (
      <div className={cn("bg-white rounded-lg border p-4", className)}>
        <h3 className="font-semibold text-sm text-slate-900 mb-2">
          Estatísticas do Mês
        </h3>
        <p className="text-xs text-slate-500">
          Dados disponíveis apenas para 2026
        </p>
      </div>
    );
  }

  const percentage = Math.round((stats.schoolDays / stats.totalDays) * 100);

  return (
    <div className={cn("bg-white rounded-lg border p-4", className)}>
      <h3 className="font-semibold text-sm text-slate-900 mb-3">
        Estatísticas - {stats.name}
      </h3>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">Dias Letivos</span>
          <span className="font-semibold text-slate-900">
            {stats.schoolDays}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">Total de Dias</span>
          <span className="font-medium text-slate-700">{stats.totalDays}</span>
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
