"use client";

import { useState } from "react";
import type { Tarefa } from "@essencia/shared/types";
import { apiPatch } from "../../../lib/api";

interface EditarTarefaData {
  titulo?: string;
  descricao?: string;
  prioridade?: "ALTA" | "MEDIA" | "BAIXA";
  prazo?: string;
  responsavel?: string;
}

export function useEditarTarefa(id: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const editar = async (data: EditarTarefaData): Promise<Tarefa> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiPatch<{ data: Tarefa }>(`tarefas/${id}`, data);
      return response.data;
    } catch (err) {
      const erro =
        err instanceof Error ? err : new Error("Erro ao editar tarefa");
      setError(erro);
      throw erro;
    } finally {
      setIsLoading(false);
    }
  };

  return { editar, isLoading, error };
}
