"use client";

import { useRouter } from "next/navigation";
import { TarefaBadge } from "@essencia/components/tarefas";
import { useTarefas } from "../tarefas-list/hooks/use-tarefas";

/**
 * Container para TarefaBadge que conecta ao hook de tarefas
 *
 * Busca os dados via useTarefas e passa como props para o componente presentacional
 */
export function TarefaBadgeContainer() {
  const router = useRouter();
  const { stats } = useTarefas({ status: "PENDENTE" });

  const handleClick = () => {
    router.push("/tarefas");
  };

  return (
    <TarefaBadge
      pendentes={stats.pendentes}
      atrasadas={stats.atrasadas}
      onClick={handleClick}
    />
  );
}
