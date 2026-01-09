"use client";

import { api } from "@essencia/shared/fetchers/client";
import type { Turma } from "@essencia/shared/schemas";
import { useEffect, useState } from "react";

interface UseTurmasReturn {
  turmas: Turma[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook para buscar turmas disponíveis para o usuário logado
 * GET /plannings/turmas
 *
 * Retorna turmas filtradas por:
 * - unitId do usuário (sessão)
 * - stageId do usuário (se aplicável)
 */
export function useTurmas(): UseTurmasReturn {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchTurmas() {
      try {
        setIsLoading(true);
        setError(null);

        const turmasData = await api.get<Turma[]>("/plannings/turmas");

        if (mounted) {
          setTurmas(turmasData);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err : new Error("Erro ao buscar turmas"),
          );
          console.error("Erro ao buscar turmas:", err);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchTurmas();

    return () => {
      mounted = false;
    };
  }, []);

  return { turmas, isLoading, error };
}
