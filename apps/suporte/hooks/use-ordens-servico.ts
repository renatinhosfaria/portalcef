"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  OrdemServicoEnriquecida,
  OrdemServicoCategoria,
  OrdemServicoStatus,
  SuporteContagem,
} from "@essencia/shared/types";
import { apiGet } from "@/lib/api";

export interface UseOrdensServicoParams {
  status?: OrdemServicoStatus;
  categoria?: OrdemServicoCategoria;
  page?: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function useOrdensServico(params: UseOrdensServicoParams = {}) {
  const [ordens, setOrdens] = useState<OrdemServicoEnriquecida[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [contagem, setContagem] = useState<SuporteContagem>({
    total: 0,
    abertas: 0,
    emAndamento: 0,
    resolvidas: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrdens = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();

      if (params.status) {
        queryParams.append("status", params.status);
      }
      if (params.categoria) {
        queryParams.append("categoria", params.categoria);
      }
      if (params.page) {
        queryParams.append("page", String(params.page));
      }

      const response = await apiGet<{
        data: OrdemServicoEnriquecida[];
        pagination: Pagination;
      }>(`suporte?${queryParams.toString()}`);

      setOrdens(response.data);
      setPagination(response.pagination);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Erro desconhecido"));
    } finally {
      setIsLoading(false);
    }
  }, [params.status, params.categoria, params.page]);

  const fetchContagem = useCallback(async () => {
    try {
      const contagemData = await apiGet<SuporteContagem>("suporte/contagem");
      setContagem(contagemData);
    } catch (err) {
      console.error("Erro ao buscar contagem:", err);
    }
  }, []);

  useEffect(() => {
    void fetchOrdens();
    void fetchContagem();
  }, [fetchOrdens, fetchContagem]);

  return {
    ordens,
    pagination,
    contagem,
    isLoading,
    error,
    refetch: fetchOrdens,
  };
}
