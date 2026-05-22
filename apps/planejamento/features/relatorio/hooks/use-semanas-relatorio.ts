"use client";

import { api } from "@essencia/shared/fetchers/client";
import { useCallback, useEffect, useState } from "react";

import { obterMensagemErro } from "../../../lib/mensagens-erro";
import type { SemanaRelatorio } from "../types";

interface SemanaRelatorioDto {
  etapa: "BERCARIO" | "INFANTIL";
  numero: number;
  descricao?: string;
  dataInicio: string;
  dataFim: string;
  dataMaximaEntrega: string;
}

interface UseSemanaRelatorioReturn {
  semanas: SemanaRelatorio[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  buscarPorTurma: (turmaId: string) => Promise<SemanaRelatorio[]>;
  criarSemana: (dto: SemanaRelatorioDto) => Promise<SemanaRelatorio>;
  editarSemana: (
    id: string,
    dto: Partial<Omit<SemanaRelatorioDto, "etapa" | "numero">>,
  ) => Promise<SemanaRelatorio>;
  excluirSemana: (id: string) => Promise<void>;
}

export function useSemanaRelatorio(): UseSemanaRelatorioReturn {
  const [semanas, setSemanas] = useState<SemanaRelatorio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSemanas = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get<SemanaRelatorio[]>("/semana-relatorio");
      setSemanas(Array.isArray(response) ? response : []);
    } catch (err) {
      setError(
        new Error(
          obterMensagemErro(
            err,
            "Não foi possível carregar as semanas de relatório. Tente novamente.",
          ),
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSemanas();
  }, [fetchSemanas]);

  const buscarPorTurma = useCallback(async (turmaId: string) => {
    try {
      const response = await api.get<SemanaRelatorio[]>(
        `/semana-relatorio/turma/${turmaId}`,
      );
      return Array.isArray(response) ? response : [];
    } catch (err) {
      throw new Error(
        obterMensagemErro(
          err,
          "Não foi possível carregar as semanas da turma. Tente novamente.",
        ),
      );
    }
  }, []);

  const criarSemana = useCallback(
    async (dto: SemanaRelatorioDto) => {
      try {
        const response = await api.post<SemanaRelatorio>(
          "/semana-relatorio",
          dto,
        );
        await fetchSemanas();
        return response;
      } catch (err) {
        throw new Error(
          obterMensagemErro(
            err,
            "Não foi possível criar a semana. Revise as datas e tente novamente.",
          ),
        );
      }
    },
    [fetchSemanas],
  );

  const editarSemana = useCallback(
    async (
      id: string,
      dto: Partial<Omit<SemanaRelatorioDto, "etapa" | "numero">>,
    ) => {
      try {
        const response = await api.patch<SemanaRelatorio>(
          `/semana-relatorio/${id}`,
          dto,
        );
        await fetchSemanas();
        return response;
      } catch (err) {
        throw new Error(
          obterMensagemErro(
            err,
            "Não foi possível salvar a semana. Revise as datas e tente novamente.",
          ),
        );
      }
    },
    [fetchSemanas],
  );

  const excluirSemana = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/semana-relatorio/${id}`);
        await fetchSemanas();
      } catch (err) {
        throw new Error(
          obterMensagemErro(
            err,
            "Não foi possível excluir a semana. Tente novamente.",
          ),
        );
      }
    },
    [fetchSemanas],
  );

  return {
    semanas,
    isLoading,
    error,
    refetch: fetchSemanas,
    buscarPorTurma,
    criarSemana,
    editarSemana,
    excluirSemana,
  };
}
