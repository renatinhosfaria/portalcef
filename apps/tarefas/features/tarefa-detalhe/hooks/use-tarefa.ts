"use client";

import { useState, useEffect, useCallback } from "react";
import type { TarefaEnriquecida } from "@essencia/shared/types";
import { apiGet } from "../../../lib/api";

export function useTarefa(id: string) {
  const [tarefa, setTarefa] = useState<TarefaEnriquecida | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTarefa = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiGet<{ data: TarefaEnriquecida }>(
        `tarefas/${id}`,
      );
      setTarefa(response.data);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Erro ao buscar tarefa"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchTarefa();
  }, [fetchTarefa]);

  return { tarefa, isLoading, error, refetch: fetchTarefa };
}
