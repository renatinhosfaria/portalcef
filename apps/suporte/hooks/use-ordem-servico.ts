"use client";

import { useState, useEffect, useCallback } from "react";
import type { OrdemServicoDetalhe } from "@essencia/shared/types";
import { apiGet } from "@/lib/api";

export function useOrdemServico(id: string) {
  const [ordem, setOrdem] = useState<OrdemServicoDetalhe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrdem = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiGet<{ data: OrdemServicoDetalhe }>(
        `suporte/${id}`,
      );
      setOrdem(response.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error("Erro ao buscar ordem de servico"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchOrdem();
  }, [fetchOrdem]);

  return { ordem, isLoading, error, refetch: fetchOrdem };
}
