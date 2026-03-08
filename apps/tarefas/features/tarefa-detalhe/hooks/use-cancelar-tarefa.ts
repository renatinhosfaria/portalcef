"use client";

import { useState } from "react";
import type { Tarefa } from "@essencia/shared/types";
import { apiPatch } from "../../../lib/api";

export function useCancelarTarefa(id: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const cancelar = async (): Promise<Tarefa> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiPatch<{ data: Tarefa }>(
        `tarefas/${id}/cancelar`,
      );
      return response.data;
    } catch (err) {
      const erro =
        err instanceof Error ? err : new Error("Erro ao cancelar tarefa");
      setError(erro);
      throw erro;
    } finally {
      setIsLoading(false);
    }
  };

  return { cancelar, isLoading, error };
}
