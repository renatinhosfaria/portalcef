"use client";

import { useState, useEffect } from "react";
import { apiGet } from "@/lib/api";

export interface HistoricoTarefaEntry {
  id: string;
  tarefaId: string;
  userId: string;
  userName: string;
  userRole: string;
  acao: "CRIADA" | "EDITADA" | "CONCLUIDA" | "CANCELADA";
  campoAlterado: string | null;
  valorAnterior: string | null;
  valorNovo: string | null;
  createdAt: string;
}

export function useHistoricoTarefa(tarefaId: string) {
  const [historico, setHistorico] = useState<HistoricoTarefaEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistorico = async () => {
      try {
        const data = await apiGet<{ data: HistoricoTarefaEntry[] }>(
          `tarefas/${tarefaId}/historico`,
        );
        setHistorico(data.data);
      } catch {
        setHistorico([]);
      } finally {
        setIsLoading(false);
      }
    };
    void fetchHistorico();
  }, [tarefaId]);

  return { historico, isLoading };
}
