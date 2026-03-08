"use client";

import { useState } from "react";
import type { OrdemServicoMensagem } from "@essencia/shared/types";
import { apiPost } from "@/lib/api";

export interface EnviarMensagemData {
  conteudo?: string;
  arquivos: File[];
}

export function useEnviarMensagem() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const enviar = async (ordemServicoId: string, data: EnviarMensagemData) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();

      if (data.conteudo) {
        formData.append("conteudo", data.conteudo);
      }

      for (const arquivo of data.arquivos) {
        formData.append("arquivos", arquivo);
      }

      const response = await apiPost<{ data: OrdemServicoMensagem[] }>(
        `suporte/${ordemServicoId}/mensagem`,
        formData,
      );
      return response.data;
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Erro ao enviar mensagem");
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    enviar,
    isLoading,
    error,
  };
}
