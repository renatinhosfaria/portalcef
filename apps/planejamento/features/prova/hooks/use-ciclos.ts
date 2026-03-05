"use client";

import { api } from "@essencia/shared/fetchers/client";
import { useEffect, useState, useCallback } from "react";

import type { ProvaCiclo } from "../types";

interface UseCiclosReturn {
  ciclos: ProvaCiclo[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  criarCiclo: (dto: {
    etapa: string;
    descricao?: string;
    dataInicio: string;
    dataFim: string;
    dataMaximaEntrega: string;
  }) => Promise<ProvaCiclo>;
  editarCiclo: (
    id: string,
    dto: Partial<{
      descricao: string;
      dataInicio: string;
      dataFim: string;
      dataMaximaEntrega: string;
    }>,
  ) => Promise<ProvaCiclo>;
  excluirCiclo: (id: string) => Promise<void>;
}

/**
 * Hook para gerenciar ciclos de prova (CRUD)
 */
export function useCiclos(): UseCiclosReturn {
  const [ciclos, setCiclos] = useState<ProvaCiclo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCiclos = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await api.get<ProvaCiclo[]>("/prova-ciclo");

      if (Array.isArray(response)) {
        setCiclos(response);
      } else {
        setCiclos([]);
      }
    } catch (err) {
      console.error("Erro ao buscar ciclos de prova:", err);
      setError(
        err instanceof Error ? err : new Error("Erro ao buscar ciclos de prova"),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCiclos();
  }, [fetchCiclos]);

  const criarCiclo = useCallback(
    async (dto: {
      etapa: string;
      descricao?: string;
      dataInicio: string;
      dataFim: string;
      dataMaximaEntrega: string;
    }) => {
      const response = await api.post<ProvaCiclo>("/prova-ciclo", dto);
      await fetchCiclos();
      return response;
    },
    [fetchCiclos],
  );

  const editarCiclo = useCallback(
    async (
      id: string,
      dto: Partial<{
        descricao: string;
        dataInicio: string;
        dataFim: string;
        dataMaximaEntrega: string;
      }>,
    ) => {
      const response = await api.put<ProvaCiclo>(`/prova-ciclo/${id}`, dto);
      await fetchCiclos();
      return response;
    },
    [fetchCiclos],
  );

  const excluirCiclo = useCallback(
    async (id: string) => {
      await api.delete(`/prova-ciclo/${id}`);
      await fetchCiclos();
    },
    [fetchCiclos],
  );

  return {
    ciclos,
    isLoading,
    error,
    refetch: fetchCiclos,
    criarCiclo,
    editarCiclo,
    excluirCiclo,
  };
}

interface UseCiclosDaTurmaReturn {
  ciclos: ProvaCiclo[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook para buscar ciclos de prova de uma turma especifica
 */
export function useCiclosDaTurma(turmaId: string): UseCiclosDaTurmaReturn {
  const [ciclos, setCiclos] = useState<ProvaCiclo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCiclos = useCallback(async () => {
    if (!turmaId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<ProvaCiclo[]>(
        `/prova-ciclo/turma/${turmaId}`,
      );

      if (Array.isArray(response)) {
        setCiclos(response);
      } else {
        setCiclos([]);
      }
    } catch (err) {
      console.error("Erro ao buscar ciclos da turma:", err);
      setError(err instanceof Error ? err.message : "Erro ao buscar ciclos");
      setCiclos([]);
    } finally {
      setIsLoading(false);
    }
  }, [turmaId]);

  useEffect(() => {
    fetchCiclos();
  }, [fetchCiclos]);

  return {
    ciclos,
    isLoading,
    error,
    refetch: fetchCiclos,
  };
}
