"use client";

import { useRouter } from "next/navigation";
import {
  TarefasPendentesWidget,
  calcularDiasRestantes,
  isAtrasada,
} from "@essencia/components/tarefas";
import { useTarefas } from "../tarefas-list/hooks/use-tarefas";

export interface TarefasPendentesWidgetContainerProps {
  modulo?: string;
  quinzenaId?: string;
}

/**
 * Container para TarefasPendentesWidget que conecta ao hook de tarefas
 *
 * Busca os dados via useTarefas, filtra as tarefas urgentes,
 * e passa como props para o componente presentacional
 */
export function TarefasPendentesWidgetContainer({
  modulo,
  quinzenaId,
}: TarefasPendentesWidgetContainerProps) {
  const router = useRouter();
  const { tarefas, isLoading } = useTarefas({
    status: "PENDENTE",
    modulo,
    quinzenaId,
  });

  // Filtrar tarefas urgentes: atrasadas OU vencendo em até 2 dias
  const tarefasUrgentes = tarefas
    .filter((t) => {
      const atrasada = isAtrasada(t.prazo);
      const diasRestantes = calcularDiasRestantes(t.prazo);
      return atrasada || diasRestantes <= 2;
    })
    .slice(0, 5);

  const handleTarefaClick = (tarefaId: string) => {
    router.push(`/tarefas/${tarefaId}`);
  };

  const handleVerTodas = () => {
    router.push("/tarefas");
  };

  return (
    <TarefasPendentesWidget
      tarefas={tarefasUrgentes}
      isLoading={isLoading}
      onTarefaClick={handleTarefaClick}
      onVerTodas={handleVerTodas}
    />
  );
}
