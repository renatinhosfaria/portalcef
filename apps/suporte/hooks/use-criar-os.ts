"use client";

import { useState } from "react";
import type {
  OrdemServico,
  OrdemServicoCategoria,
} from "@essencia/shared/types";
import { apiPost } from "@/lib/api";

export interface CriarOsData {
  titulo: string;
  descricao: string;
  categoria: OrdemServicoCategoria;
  arquivos: File[];
}

export function useCriarOs() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const criar = async (data: CriarOsData) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("titulo", data.titulo);
      formData.append("descricao", data.descricao);
      formData.append("categoria", data.categoria);

      for (const arquivo of data.arquivos) {
        formData.append("arquivos", arquivo);
      }

      const result = await apiPost<OrdemServico>("suporte", formData);
      return result;
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error("Erro ao criar ordem de servico");
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
