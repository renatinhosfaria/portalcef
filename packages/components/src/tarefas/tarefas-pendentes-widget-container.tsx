"use client";

import { useEffect, useState } from "react";
import {
  TarefasPendentesWidget,
  type TarefaWidget,
} from "./tarefas-pendentes-widget";
import { calcularDiasRestantes, isAtrasada } from "./prazo-utils";
import { montarUrlPortal } from "./url-utils";

export interface TarefasPendentesWidgetContainerProps {
  modulo?: string;
  quinzenaId?: string;
}

/**
 * Container para TarefasPendentesWidget que busca dados da API
 *
 * Versão genérica que pode ser usada por qualquer app
 */
export function TarefasPendentesWidgetContainer({
  modulo,
  quinzenaId,
}: TarefasPendentesWidgetContainerProps) {
  const [tarefas, setTarefas] = useState<TarefaWidget[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTarefas() {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({
          status: "PENDENTE",
          tipo: "todas",
          limit: "100",
        });

        if (modulo) params.set("modulo", modulo);
        if (quinzenaId) params.set("quinzenaId", quinzenaId);

        const response = await fetch(`/api/tarefas?${params}`);
        if (response.ok) {
          const data = await response.json();

          // Filtrar tarefas urgentes: atrasadas OU vencendo em até 2 dias
          const urgentes = data.data
            .filter((t: TarefaWidget) => {
              const atrasada = isAtrasada(t.prazo);
              const diasRestantes = calcularDiasRestantes(t.prazo);
              return atrasada || diasRestantes <= 2;
            })
            .slice(0, 5);

          setTarefas(urgentes);
        }
      } catch (error) {
        console.error("Erro ao buscar tarefas:", error);
        setTarefas([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTarefas();
  }, [modulo, quinzenaId]);

  const redirecionarParaTarefas = (path: string) => {
    window.location.assign(montarUrlPortal(path));
  };

  const handleTarefaClick = (tarefaId: string) => {
    redirecionarParaTarefas(`/tarefas/${tarefaId}`);
  };

  const handleVerTodas = () => {
    redirecionarParaTarefas("/tarefas");
  };

  return (
    <TarefasPendentesWidget
      tarefas={tarefas}
      isLoading={isLoading}
      onTarefaClick={handleTarefaClick}
      onVerTodas={handleVerTodas}
    />
  );
}
