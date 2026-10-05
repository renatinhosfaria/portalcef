"use client";

import { getYear } from "date-fns";

import { cn } from "@essencia/ui/lib/utils";
import type { CalendarStats } from "@/lib/api";

interface YearSummaryProps {
  currentDate: Date;
  stats: CalendarStats | null;
  className?: string;
}

export function YearSummary({
  currentDate,
  stats,
  className,
}: YearSummaryProps) {
  const currentYear = getYear(currentDate);

  if (!stats || stats.year !== currentYear) {
    return (
      <div className={cn("bg-white rounded-lg border p-4", className)}>
        <h3 className="font-semibold text-sm text-slate-900 mb-2">
          Resumo Anual
        </h3>
        <p className="text-xs text-slate-500">Resumo anual indisponível</p>
      </div>
    );
  }

  // Calculate cumulative school days up to current month
  const currentMonth = currentDate.getMonth() + 1;
  const cumulativeDays = stats.monthlyStats
    .filter((m) => m.month <= currentMonth)
    .reduce((acc, m) => acc + m.schoolDays, 0);

  const progressPercentage = Math.round(
    (cumulativeDays / stats.totalSchoolDays) * 100,
  );

  return (
    <div className={cn("bg-white rounded-lg border p-4", className)}>
      <h3 className="font-semibold text-sm text-slate-900 mb-3">
        Resumo Anual - {currentYear}
      </h3>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">Total do Ano</span>
          <span className="font-semibold text-slate-900">
            {stats.totalSchoolDays} dias
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">Dias Cumpridos</span>
          <span className="font-medium text-green-600">{cumulativeDays}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">Dias Restantes</span>
          <span className="font-medium text-slate-700">
            {stats.totalSchoolDays - cumulativeDays}
          </span>
        </div>

        <div className="pt-2 border-t">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-slate-500">Progresso</span>
            <span className="text-xs font-medium text-slate-700">
              {progressPercentage}%
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Mini month breakdown */}
      <div className="mt-4 pt-3 border-t">
        <p className="text-xs font-medium text-slate-600 mb-2">
          Dias por Semestre
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-50 rounded p-2">
            <span className="text-slate-500">1º Semestre</span>
            <p className="font-semibold text-slate-900">
              {stats.monthlyStats
                .filter((m) => m.month <= 6)
                .reduce((acc, m) => acc + m.schoolDays, 0)}{" "}
              dias
            </p>
          </div>
          <div className="bg-slate-50 rounded p-2">
            <span className="text-slate-500">2º Semestre</span>
            <p className="font-semibold text-slate-900">
              {stats.monthlyStats
                .filter((m) => m.month > 6)
                .reduce((acc, m) => acc + m.schoolDays, 0)}{" "}
              dias
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
