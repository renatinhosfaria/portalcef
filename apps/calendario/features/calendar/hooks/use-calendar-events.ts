"use client";

import type {
  CalendarEvent,
  QueryCalendarEventsInput,
} from "@essencia/shared/schemas/calendar";
import { useCallback, useEffect, useRef, useState } from "react";

import { getCalendarEvents } from "@/lib/api";

interface UseCalendarEventsOptions {
  unitId?: string | null;
  year?: number;
  month?: number;
}

interface UseCalendarEventsReturn {
  events: CalendarEvent[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCalendarEvents(
  options: UseCalendarEventsOptions = {},
): UseCalendarEventsReturn {
  const { unitId, year, month } = options;
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const fetchEvents = useCallback(async () => {
    const currentRequest = ++requestId.current;
    try {
      setIsLoading(true);
      setError(null);

      const params: QueryCalendarEventsInput = {};
      if (unitId) params.unitId = unitId;
      if (year) params.year = year;
      if (month) params.month = month;

      const data = await getCalendarEvents(params);
      if (currentRequest !== requestId.current) return;
      setEvents(data);
    } catch (err) {
      if (currentRequest !== requestId.current) return;
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Erro ao carregar eventos");
      }
    } finally {
      if (currentRequest === requestId.current) setIsLoading(false);
    }
  }, [unitId, year, month]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    isLoading,
    error,
    refetch: fetchEvents,
  };
}
