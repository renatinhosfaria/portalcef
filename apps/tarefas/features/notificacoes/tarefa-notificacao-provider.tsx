"use client";

import { useEffect, useRef, type PropsWithChildren } from "react";
import { toast } from "@essencia/ui/components/toaster";
import { useTarefas } from "../tarefas-list/hooks/use-tarefas";
import { isAtrasada } from "@/lib/prazo-utils";

export function TarefaNotificacaoProvider({ children }: PropsWithChildren) {
  const mostradas = useRef<Set<string>>(new Set());
  const { tarefas, isLoading, refetch } = useTarefas({
    status: "PENDENTE",
    includeStats: false,
    limit: 100,
  });

  // Notifica tarefas atrasadas novas assim que a lista é atualizada.
  useEffect(() => {
    if (isLoading) return;

    const novasAtrasadas = tarefas.filter(
      (t) => isAtrasada(t.prazo) && !mostradas.current.has(t.id),
    );
    if (novasAtrasadas.length === 0) return;

    novasAtrasadas.forEach((tarefa) => {
      toast.error("⚠️ Tarefa Atrasada", { description: tarefa.titulo });
    });
    novasAtrasadas.forEach((tarefa) => mostradas.current.add(tarefa.id));
  }, [isLoading, tarefas]);

  // Atualiza a lista de tarefas a cada 5 minutos.
  useEffect(() => {
    const interval = setInterval(
      () => {
        void refetch();
      },
      5 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, [refetch]);

  return <>{children}</>;
}
