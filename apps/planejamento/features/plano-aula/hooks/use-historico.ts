"use client";

/**
 * Hook para buscar o histórico de ações de um plano de aula
 * Task 21: Frontend - Histórico Timeline
 */

import { useEffect, useState } from "react";

import { api } from "@essencia/shared/fetchers/client";
import type { HistoricoEntry } from "@essencia/shared/types";

interface UseHistoricoReturn {
  historico: HistoricoEntry[];
  isLoading: boolean;
  error: Error | null;
}

export function useHistorico(planoId: string): UseHistoricoReturn {
  const [historico, setHistorico] = useState<HistoricoEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!planoId) {
      setIsLoading(false);
      return;
    }

    const fetchHistorico = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await api.get<HistoricoEntry[]>(
          `/plano-aula/${planoId}/historico`,
        );
        setHistorico(data);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Erro ao carregar histórico"),
        );
      } finally {
        setIsLoading(false);
      }
    };

    void fetchHistorico();
  }, [planoId]);

  return { historico, isLoading, error };
}
