"use client";

import { useEffect, useState } from "react";
import { TarefaBadge } from "./tarefa-badge";
import { montarUrlPortal } from "./url-utils";

interface TarefasStats {
  pendentes: number;
  atrasadas: number;
  concluidasHoje: number;
  concluidasSemana: number;
}

/**
 * Container para TarefaBadge que busca dados da API
 *
 * Versão genérica que pode ser usada por qualquer app
 */
export function TarefaBadgeContainer() {
  const [stats, setStats] = useState<TarefasStats>({
    pendentes: 0,
    atrasadas: 0,
    concluidasHoje: 0,
    concluidasSemana: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/tarefas/stats/resumo");
        if (response.ok) {
          const data = await response.json();
          setStats(data.data);
        }
      } catch (error) {
        console.error("Erro ao buscar estatísticas de tarefas:", error);
      }
    }

    fetchStats();
    // Atualizar a cada 60 segundos
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  const redirecionarParaTarefas = (path: string) => {
    window.location.assign(montarUrlPortal(path));
  };

  const handleClick = () => {
    redirecionarParaTarefas("/tarefas");
  };

  return (
    <TarefaBadge
      pendentes={stats.pendentes}
      atrasadas={stats.atrasadas}
      onClick={handleClick}
    />
  );
}
