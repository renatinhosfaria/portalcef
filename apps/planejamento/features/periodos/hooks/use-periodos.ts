// apps/planejamento/features/periodos/hooks/use-periodos.ts
"use client";

import { api } from "@essencia/shared/fetchers/client";
import { useEffect, useState, useCallback } from "react";

import { obterMensagemErro } from "../../../lib/mensagens-erro";

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
        new Error(
          obterMensagemErro(
            err,
            "Não foi possível carregar os períodos. Tente novamente.",
          ),
        ),
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
      try {
        const response = await api.post<Periodo>("/plano-aula-periodo", dto);
        await fetchPeriodos();
        return response;
      } catch (err) {
        throw new Error(
          obterMensagemErro(
            err,
            "Não foi possível criar o período. Revise as datas e tente novamente.",
          ),
        );
      }
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
      try {
        const response = await api.put<Periodo>(`/plano-aula-periodo/${id}`, dto);
        await fetchPeriodos();
        return response;
      } catch (err) {
        throw new Error(
          obterMensagemErro(
            err,
            "Não foi possível salvar o período. Revise as datas e tente novamente.",
          ),
        );
      }
    },
    [fetchPeriodos],
  );

  const excluirPeriodo = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/plano-aula-periodo/${id}`);
        await fetchPeriodos();
      } catch (err) {
        throw new Error(
          obterMensagemErro(
            err,
            "Não foi possível excluir o período. Tente novamente.",
          ),
        );
      }
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
      setError(
        obterMensagemErro(
          err,
          "Não foi possível carregar os períodos da turma. Tente novamente.",
        ),
      );
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
