// apps/planejamento/features/periodos/hooks/use-periodos.ts
"use client";

import { api } from "@essencia/shared/fetchers/client";
import { useEffect, useState, useCallback } from "react";

export interface Periodo {
  id: string;
  unidadeId: string;
  etapa: string;
  numero: number;
  descricao?: string;
  dataInicio: string;
  dataFim: string;
  dataMaximaEntrega: string;
  planosVinculados?: number;
  criadoEm: Date;
  atualizadoEm: Date;
}

interface UsePeriodosReturn {
  periodos: Periodo[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  criarPeriodo: (dto: {
    etapa: string;
    descricao?: string;
    dataInicio: string;
    dataFim: string;
    dataMaximaEntrega: string;
  }) => Promise<Periodo>;
  editarPeriodo: (
    id: string,
    dto: Partial<{
      descricao: string;
      dataInicio: string;
      dataFim: string;
      dataMaximaEntrega: string;
    }>,
  ) => Promise<Periodo>;
  excluirPeriodo: (id: string) => Promise<void>;
}

/**
 * Hook para gerenciar períodos de planejamento
 */
export function usePeriodos(): UsePeriodosReturn {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPeriodos = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await api.get<Periodo[]>("/plano-aula-periodo");

      if (Array.isArray(response)) {
        setPeriodos(response);
      } else {
        setPeriodos([]);
      }
    } catch (err) {
      console.error("Erro ao buscar períodos:", err);
      setError(
        err instanceof Error ? err : new Error("Erro ao buscar períodos"),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeriodos();
  }, [fetchPeriodos]);

  const criarPeriodo = useCallback(
    async (dto: {
      etapa: string;
      descricao?: string;
      dataInicio: string;
      dataFim: string;
      dataMaximaEntrega: string;
    }) => {
      const response = await api.post<Periodo>("/plano-aula-periodo", dto);
      await fetchPeriodos();
      return response;
    },
    [fetchPeriodos],
  );

  const editarPeriodo = useCallback(
    async (
      id: string,
      dto: Partial<{
        descricao: string;
        dataInicio: string;
        dataFim: string;
        dataMaximaEntrega: string;
      }>,
    ) => {
      const response = await api.put<Periodo>(`/plano-aula-periodo/${id}`, dto);
      await fetchPeriodos();
      return response;
    },
    [fetchPeriodos],
  );

  const excluirPeriodo = useCallback(
    async (id: string) => {
      await api.delete(`/plano-aula-periodo/${id}`);
      await fetchPeriodos();
    },
    [fetchPeriodos],
  );

  return {
    periodos,
    isLoading,
    error,
    refetch: fetchPeriodos,
    criarPeriodo,
    editarPeriodo,
    excluirPeriodo,
  };
}

interface UsePeriodosDaTurmaReturn {
  periodos: Periodo[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook para buscar períodos de uma turma específica
 */
export function usePeriodosDaTurma(turmaId: string): UsePeriodosDaTurmaReturn {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPeriodos = useCallback(async () => {
    if (!turmaId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<Periodo[]>(
        `/plano-aula-periodo/turma/${turmaId}`,
      );

      if (Array.isArray(response)) {
        setPeriodos(response);
      } else {
        setPeriodos([]);
      }
    } catch (err) {
      console.error("Erro ao buscar períodos da turma:", err);
      setError(err instanceof Error ? err.message : "Erro ao buscar períodos");
      setPeriodos([]);
    } finally {
      setIsLoading(false);
    }
  }, [turmaId]);

  useEffect(() => {
    fetchPeriodos();
  }, [fetchPeriodos]);

  return {
    periodos,
    isLoading,
    error,
    refetch: fetchPeriodos,
  };
}
