"use client";

import { formatarDataDiaSemana } from "@essencia/shared/formatar-data";
import { useTenant } from "@essencia/shared/providers/tenant";
import {
  Card,
  CardContent,
  CardHeader,
} from "@essencia/ui/components/card";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  formatarDataCivil,
  getTodayCalendarEvents,
} from "../lib/home-api";

interface HomeCalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
}

interface CalendarWidgetProps {
  titleId?: string;
}

export function CalendarWidget({ titleId = "agenda-titulo" }: CalendarWidgetProps) {
  const { unitId } = useTenant();
  const [events, setEvents] = useState<HomeCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const carregar = useCallback(async () => {
    setIsLoading(true);
    setError(false);

    try {
      setEvents(await getTodayCalendarEvents(unitId || undefined));
    } catch {
      setEvents([]);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [unitId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const today = new Date();
  const dateStr = formatarDataDiaSemana(today);

  return (
    <Card className="border-none bg-white/50 shadow-sm backdrop-blur-sm">
      <CardHeader className="pb-2">
        <h2
          id={titleId}
          className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500"
        >
          <CalendarIcon className="h-4 w-4" aria-hidden="true" />
          Agenda de Hoje
        </h2>
      </CardHeader>
      <CardContent>
        <div className="mb-4 border-b border-slate-100 pb-2 text-xl font-bold capitalize text-slate-800">
          {dateStr}
        </div>

        {isLoading && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500" role="status">
            Carregando agenda...
          </div>
        )}

        {error && (
          <div className="space-y-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
            <p>Não foi possível carregar a agenda.</p>
            <button type="button" className="font-semibold underline" onClick={() => void carregar()}>
              Tentar novamente
            </button>
          </div>
        )}

        {!isLoading && !error && events.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500" role="status">
            Nenhum evento disponível para hoje.
          </div>
        )}

        {!isLoading && !error && events.length > 0 && (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-100 p-1">
                  <span className="text-xs font-bold text-slate-500">Dia todo</span>
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight text-slate-700">{event.title}</p>
                  <p className="text-xs text-slate-500">
                    {formatarDataCivil(event.startDate)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 border-t border-slate-100 pt-3 text-center">
          <a href="/calendario" className="flex w-full items-center justify-center gap-1 text-xs font-bold text-indigo-600 hover:underline">
            <Clock className="h-3 w-3" aria-hidden="true" />
            Ver agenda completa
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
