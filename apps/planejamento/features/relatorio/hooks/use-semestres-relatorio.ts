"use client";

import { api } from "@essencia/shared/fetchers/client";
import { useCallback, useEffect, useState } from "react";

import { obterMensagemErro } from "../../../lib/mensagens-erro";
import type { SemestreRelatorio } from "../types";

interface SemestreRelatorioDto {
  etapa: "BERCARIO" | "INFANTIL";
  anoLetivo: number;
  semestre: number;
  descricao?: string;
  dataInicio: string;
  dataFim: string;
  dataMaximaEntrega: string;
}

interface UseSemestreRelatorioReturn {
  semestres: SemestreRelatorio[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  buscarPorTurma: (turmaId: string) => Promise<SemestreRelatorio[]>;
  criarSemestre: (dto: SemestreRelatorioDto) => Promise<SemestreRelatorio>;
  editarSemestre: (
    id: string,
    dto: Partial<Omit<SemestreRelatorioDto, "etapa" | "semestre">>,
  ) => Promise<SemestreRelatorio>;
  excluirSemestre: (id: string) => Promise<void>;
}

export function useSemestreRelatorio(): UseSemestreRelatorioReturn {
  const [semestres, setSemestres] = useState<SemestreRelatorio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSemestres = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get<SemestreRelatorio[]>("/semestre-relatorio");
      setSemestres(Array.isArray(response) ? response : []);
    } catch (err) {
      setError(
        new Error(
          obterMensagemErro(
            err,
            "Não foi possível carregar os semestres de relatório. Tente novamente.",
          ),
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSemestres();
  }, [fetchSemestres]);

  const buscarPorTurma = useCallback(async (turmaId: string) => {
    try {
      const response = await api.get<SemestreRelatorio[]>(
        `/semestre-relatorio/turma/${turmaId}`,
      );
      return Array.isArray(response) ? response : [];
    } catch (err) {
      throw new Error(
        obterMensagemErro(
          err,
          "Não foi possível carregar os semestres da turma. Tente novamente.",
        ),
      );
    }
  }, []);

  const criarSemestre = useCallback(
    async (dto: SemestreRelatorioDto) => {
      try {
        const response = await api.post<SemestreRelatorio>(
          "/semestre-relatorio",
          dto,
        );
        await fetchSemestres();
        return response;
      } catch (err) {
        throw new Error(
          obterMensagemErro(
            err,
            "Não foi possível criar o semestre. Revise as datas e tente novamente.",
          ),
        );
      }
    },
    [fetchSemestres],
  );

  const editarSemestre = useCallback(
    async (
      id: string,
      dto: Partial<Omit<SemestreRelatorioDto, "etapa" | "semestre">>,
    ) => {
      try {
        const response = await api.patch<SemestreRelatorio>(
          `/semestre-relatorio/${id}`,
          dto,
        );
        await fetchSemestres();
        return response;
      } catch (err) {
        throw new Error(
          obterMensagemErro(
            err,
            "Não foi possível salvar o semestre. Revise as datas e tente novamente.",
          ),
        );
      }
    },
    [fetchSemestres],
  );

  const excluirSemestre = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/semestre-relatorio/${id}`);
        await fetchSemestres();
      } catch (err) {
        throw new Error(
          obterMensagemErro(
            err,
            "Não foi possível excluir o semestre. Tente novamente.",
          ),
        );
      }
    },
    [fetchSemestres],
  );

  return {
    semestres,
    isLoading,
    error,
    refetch: fetchSemestres,
    buscarPorTurma,
    criarSemestre,
    editarSemestre,
    excluirSemestre,
  };
}
