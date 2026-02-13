"use client";

import { api } from "@essencia/shared/fetchers/client";
import { useCallback, useEffect, useState } from "react";

interface PeriodoData {
  id: string;
  numero: number;
  descricao?: string;
  dataInicio: string;
  dataFim: string;
  dataMaximaEntrega: string;
  etapa?: string;
}

interface Stage {
  id: string;
  name: string;
  code: string;
}

interface UsePeriodoDataReturn {
  periodo: PeriodoData | null;
  etapaNome: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook para buscar dados de um período específico e sua etapa
 * Usado nas telas de revisão/análise para substituir UUIDs por info legível
 */
export function usePeriodoData(
  periodoId: string | undefined,
): UsePeriodoDataReturn {
  const [periodo, setPeriodo] = useState<PeriodoData | null>(null);
  const [etapaNome, setEtapaNome] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!periodoId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [periodoResult, stages] = await Promise.all([
        api.get<PeriodoData>(`/plano-aula-periodo/${periodoId}`),
        api.get<Stage[]>("/stages"),
      ]);

      setPeriodo(periodoResult);

      if (periodoResult?.etapa && Array.isArray(stages)) {
        const stage = stages.find((s) => s.code === periodoResult.etapa);
        setEtapaNome(stage?.name || periodoResult.etapa);
      }
    } catch (err) {
      console.error("Erro ao buscar dados do período:", err);
      setError(
        err instanceof Error ? err.message : "Erro ao buscar período",
      );
    } finally {
      setIsLoading(false);
    }
  }, [periodoId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { periodo, etapaNome, isLoading, error };
}
