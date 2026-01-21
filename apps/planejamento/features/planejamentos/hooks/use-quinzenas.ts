"use client";

import { api } from "@essencia/shared/fetchers/client";
import { useEffect, useState } from "react";

interface ApiQuinzena {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  deadline: string;
  semester: 1 | 2;
  isCurrent?: boolean;
  schoolDaysCount?: number;
  hasSchoolDays?: boolean;
}

interface UseQuinzenasReturn {
  quinzenas: ApiQuinzena[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook para buscar quinzenas da API
 */
export function useQuinzenas(): UseQuinzenasReturn {
  const [quinzenas, setQuinzenas] = useState<ApiQuinzena[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchQuinzenas() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await api.get<ApiQuinzena[]>(
          "/plannings/quinzenas"
        );

        if (Array.isArray(response)) {
          setQuinzenas(response);
        } else {
          setQuinzenas([]);
        }
      } catch (err) {
        console.error("Erro ao buscar quinzenas:", err);
        setError(
          err instanceof Error ? err : new Error("Erro ao buscar quinzenas")
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchQuinzenas();
  }, []);

  return { quinzenas, isLoading, error };
}
