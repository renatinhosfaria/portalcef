"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getCalendarStats, type CalendarStats } from "@/lib/api";

interface UseCalendarStatsOptions {
  unitId?: string | null;
  year: number;
}

interface UseCalendarStatsReturn {
  stats: CalendarStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCalendarStats({
  unitId,
  year,
}: UseCalendarStatsOptions): UseCalendarStatsReturn {
  const [stats, setStats] = useState<CalendarStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const fetchStats = useCallback(async () => {
    const currentRequest = ++requestId.current;
    try {
      setIsLoading(true);
      setError(null);
      const result = await getCalendarStats({
        ...(unitId ? { unitId } : {}),
        year,
      });
      if (currentRequest !== requestId.current) return;
      setStats(result);
    } catch (err) {
      if (currentRequest !== requestId.current) return;
      setError(
        err instanceof Error ? err.message : "Erro ao carregar estatísticas",
      );
    } finally {
      if (currentRequest === requestId.current) setIsLoading(false);
    }
  }, [unitId, year]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  return { stats, isLoading, error, refetch: fetchStats };
}
