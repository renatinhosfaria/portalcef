"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  TarefaEnriquecida,
  TarefaStats,
  TarefaStatus,
  TarefaPrioridade,
  TarefaContextoModulo,
} from "@essencia/shared/types";
import { apiGet, apiPatch } from "../../../lib/api";

export interface UseTarefasParams {
  status?: TarefaStatus;
  prioridade?: TarefaPrioridade;
  modulo?: TarefaContextoModulo;
  quinzenaId?: string;
  planoId?: string;
  provaId?: string;
  etapaId?: string;
  turmaId?: string;
  responsavel?: string;
  criadoPor?: string;
  prazoInicio?: string;
  prazoFim?: string;
  tipo?: "criadas" | "atribuidas" | "todas";
  page?: number;
  limit?: number;
  orderBy?: "prazo" | "prioridade" | "createdAt" | "updatedAt";
  orderDir?: "asc" | "desc";
  includeStats?: boolean;
}

interface PaginacaoTarefas {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useTarefas(params: UseTarefasParams = {}) {
  const [tarefas, setTarefas] = useState<TarefaEnriquecida[]>([]);
  const [pagination, setPagination] = useState<PaginacaoTarefas>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  const [stats, setStats] = useState<TarefaStats>({
    total: 0,
    pendentes: 0,
    concluidas: 0,
    canceladas: 0,
    atrasadas: 0,
    proximasVencer: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requisicaoRef = useRef(0);

  const fetchTarefas = useCallback(async () => {
    const requisicao = ++requisicaoRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();

      if (params.status) {
        queryParams.append("status", params.status);
      }
      if (params.prioridade) {
        queryParams.append("prioridade", params.prioridade);
      }
      if (params.modulo) {
        queryParams.append("modulo", params.modulo);
      }
      if (params.quinzenaId) {
        queryParams.append("quinzenaId", params.quinzenaId);
      }
      for (const [nome, valor] of [
        ["planoId", params.planoId],
        ["provaId", params.provaId],
        ["etapaId", params.etapaId],
        ["turmaId", params.turmaId],
        ["responsavel", params.responsavel],
        ["criadoPor", params.criadoPor],
        ["prazoInicio", params.prazoInicio],
        ["prazoFim", params.prazoFim],
        ["orderBy", params.orderBy],
        ["orderDir", params.orderDir],
      ] as const) {
        if (valor) queryParams.append(nome, valor);
      }
      if (params.tipo) {
        queryParams.append("tipo", params.tipo);
      }
      if (params.page) queryParams.append("page", String(params.page));
      if (params.limit) queryParams.append("limit", String(params.limit));

      const response = await apiGet<{
        data: TarefaEnriquecida[];
        pagination?: PaginacaoTarefas;
      }>(
        `tarefas?${queryParams.toString()}`,
      );

      if (requisicao === requisicaoRef.current) {
        setTarefas(response.data);
        if (response.pagination) setPagination(response.pagination);
      }
    } catch (err) {
      if (requisicao === requisicaoRef.current) {
        setError(err instanceof Error ? err : new Error("Erro desconhecido"));
      }
    } finally {
      if (requisicao === requisicaoRef.current) setIsLoading(false);
    }
  }, [
    params.status,
    params.prioridade,
    params.modulo,
    params.quinzenaId,
    params.tipo,
    params.page,
    params.limit,
    params.planoId,
    params.provaId,
    params.etapaId,
    params.turmaId,
    params.responsavel,
    params.criadoPor,
    params.prazoInicio,
    params.prazoFim,
    params.orderBy,
    params.orderDir,
  ]);

  const fetchStats = useCallback(async () => {
    if (params.includeStats === false) return;
    try {
      const statsData = await apiGet<{ data: TarefaStats }>(
        "tarefas/stats/resumo",
      );
      setStats(statsData.data);
    } catch (err) {
      console.error("Erro ao buscar estatísticas:", err);
    }
  }, [params.includeStats]);

  const concluir = useCallback(
    async (tarefaId: string) => {
      try {
        await apiPatch(`tarefas/${tarefaId}/concluir`);
        await fetchTarefas();
        await fetchStats();
      } catch (err) {
        throw err instanceof Error ? err : new Error("Erro ao concluir tarefa");
      }
    },
    [fetchTarefas, fetchStats],
  );

  useEffect(() => {
    void fetchTarefas();
    void fetchStats();
  }, [fetchTarefas, fetchStats]);

  useEffect(() => {
    const atualizar = () => {
      void fetchTarefas();
      void fetchStats();
    };
    window.addEventListener("tarefas:atualizada", atualizar);
    return () => window.removeEventListener("tarefas:atualizada", atualizar);
  }, [fetchTarefas, fetchStats]);

  return {
    tarefas,
    pagination,
    stats,
    isLoading,
    error,
    refetch: fetchTarefas,
    refetchStats: fetchStats,
    concluir,
  };
}
