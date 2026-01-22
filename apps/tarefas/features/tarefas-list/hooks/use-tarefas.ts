"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  TarefaEnriquecida,
  TarefaStats,
  TarefaStatus,
  TarefaPrioridade,
} from "@essencia/shared/types";
import { apiGet, apiPatch } from "../../../lib/api";

export interface UseTarefasParams {
  status?: TarefaStatus;
  prioridade?: TarefaPrioridade;
  modulo?: string;
  quinzenaId?: string;
  tipo?: "criadas" | "atribuidas" | "todas";
}

export function useTarefas(params: UseTarefasParams = {}) {
  const [tarefas, setTarefas] = useState<TarefaEnriquecida[]>([]);
  const [stats, setStats] = useState<TarefaStats>({
    total: 0,
    pendentes: 0,
    concluidas: 0,
    canceladas: 0,
    atrasadas: 0,
    proximasVencer: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTarefas = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();

      if (params.status) {
        queryParams.append("status", params.status);
      }
      if (params.prioridade) {
        queryParams.append("prioridade", params.prioridade);
      }
      if (params.modulo) {
        queryParams.append("modulo", params.modulo);
      }
      if (params.quinzenaId) {
        queryParams.append("quinzenaId", params.quinzenaId);
      }
      if (params.tipo) {
        queryParams.append("tipo", params.tipo);
      }

      const response = await apiGet<{ data: TarefaEnriquecida[] }>(
        `tarefas?${queryParams.toString()}`,
      );

      setTarefas(response.data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Erro desconhecido"));
    } finally {
      setIsLoading(false);
    }
  }, [params.status, params.prioridade, params.modulo, params.quinzenaId, params.tipo]);

  const fetchStats = useCallback(async () => {
    try {
      const statsData = await apiGet<TarefaStats>("tarefas/stats/resumo");
      setStats(statsData);
    } catch (err) {
      console.error("Erro ao buscar estatísticas:", err);
    }
  }, []);

  const concluir = useCallback(
    async (tarefaId: string) => {
      try {
        await apiPatch(`tarefas/${tarefaId}/concluir`);
        await fetchTarefas();
        await fetchStats();
      } catch (err) {
        throw err instanceof Error ? err : new Error("Erro ao concluir tarefa");
      }
    },
    [fetchTarefas, fetchStats],
  );

  useEffect(() => {
    void fetchTarefas();
    void fetchStats();
  }, [fetchTarefas, fetchStats]);

  return {
    tarefas,
    stats,
    isLoading,
    error,
    refetch: fetchTarefas,
    concluir,
  };
}
