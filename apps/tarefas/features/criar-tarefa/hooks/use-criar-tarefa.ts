"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import type { Tarefa } from "@essencia/shared/types";

export interface CriarTarefaData {
  titulo: string;
  descricao?: string;
  prioridade: "ALTA" | "MEDIA" | "BAIXA";
  prazo: string;
  responsavel: string;
  contextos: {
    modulo: string;
    quinzenaId?: string;
    etapaId?: string;
    turmaId?: string;
    professoraId?: string;
  };
}

export function useCriarTarefa() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const criar = async (data: CriarTarefaData) => {
    setIsLoading(true);
    setError(null);

    try {
      await apiPost<Tarefa>("tarefas", data);
      router.push("/tarefas");
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Erro ao criar tarefa");
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    criar,
    isLoading,
    error,
  };
}
