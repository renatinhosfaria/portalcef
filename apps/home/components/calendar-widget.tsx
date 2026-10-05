"use client";

import { formatarDataDiaSemana } from "@essencia/shared/formatar-data";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { Calendar as CalendarIcon, Clock } from "lucide-react";

export function CalendarWidget() {
  const today = new Date();
  const dateStr = formatarDataDiaSemana(today);

  return (
    <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-slate-500 flex items-center gap-2 uppercase tracking-wide">
          <CalendarIcon className="w-4 h-4" />
          Agenda de Hoje
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xl font-bold text-slate-800 capitalize mb-4 border-b border-slate-100 pb-2">
          {dateStr}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
          Nenhum evento disponível para hoje.
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 text-center">
          <a href="/calendario" className="text-xs font-bold text-indigo-600 hover:underline flex items-center justify-center gap-1 w-full">
            <Clock className="w-3 h-3" />
            Ver agenda completa
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
