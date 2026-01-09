"use client";

import { api } from "@essencia/shared/fetchers/client";
import type { Quinzena } from "@essencia/shared/schemas";
import { useEffect, useState } from "react";

interface UseQuinzenasReturn {
  quinzenas: Quinzena[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook para buscar quinzenas disponíveis
 * GET /plannings/quinzenas
 *
 * Retorna as 4 próximas quinzenas a partir da data atual
 */
export function useQuinzenas(): UseQuinzenasReturn {
  const [quinzenas, setQuinzenas] = useState<Quinzena[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchQuinzenas() {
      try {
        setIsLoading(true);
        setError(null);

        const quinzenasData = await api.get<Quinzena[]>("/plannings/quinzenas");

        if (mounted) {
          setQuinzenas(quinzenasData);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err : new Error("Erro ao buscar quinzenas"),
          );
          console.error("Erro ao buscar quinzenas:", err);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchQuinzenas();

    return () => {
      mounted = false;
    };
  }, []);

  return { quinzenas, isLoading, error };
}
