"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { Calendar as CalendarIcon, Clock } from "lucide-react";

export function CalendarWidget() {
  const today = new Date();
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
  };
  const dateStr = today.toLocaleDateString("pt-BR", options);

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

        <div className="space-y-3">
          <div className="flex gap-3 group">
            <div className="w-12 flex flex-col items-center justify-center bg-slate-100 rounded-lg p-1 shrink-0 group-hover:bg-indigo-50 transition-colors">
              <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600">
                09:00
              </span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700 leading-tight">
                Reunião Pedagógica
              </p>
              <p className="text-xs text-slate-500">Sala de Reuniões 1</p>
            </div>
          </div>

          <div className="flex gap-3 group">
            <div className="w-12 flex flex-col items-center justify-center bg-slate-100 rounded-lg p-1 shrink-0 group-hover:bg-indigo-50 transition-colors">
              <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600">
                14:30
              </span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700 leading-tight">
                Conselho de Classe (8º B)
              </p>
              <p className="text-xs text-slate-500">Auditório</p>
            </div>
          </div>

          <div className="flex gap-3 group opacity-50">
            <div className="w-12 flex flex-col items-center justify-center bg-slate-50 rounded-lg p-1 shrink-0">
              <span className="text-xs font-bold text-slate-400">16:00</span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-600 leading-tight">
                Entrega de Notas
              </p>
              <p className="text-xs text-slate-400">Sistema</p>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 text-center">
          <button className="text-xs font-bold text-indigo-600 hover:underline flex items-center justify-center gap-1 w-full">
            <Clock className="w-3 h-3" />
            Ver agenda completa
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
