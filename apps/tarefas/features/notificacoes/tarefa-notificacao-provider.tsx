"use client";

import { useEffect, useState, type PropsWithChildren } from "react";
import { toast } from "@essencia/ui/components/toaster";
import { useTarefas } from "../tarefas-list/hooks/use-tarefas";
import { isAtrasada } from "@/lib/prazo-utils";

export function TarefaNotificacaoProvider({ children }: PropsWithChildren) {
  const [mostradas, setMostradas] = useState<Set<string>>(new Set());
  const { stats, tarefas } = useTarefas({ status: "PENDENTE" });

  // Notificação inicial ao montar
  useEffect(() => {
    if (stats.atrasadas > 0) {
      toast.error(
        `Você tem ${stats.atrasadas} tarefa(s) atrasada(s)`,
        {
          description: "Acesse o painel de tarefas para mais detalhes",
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Roda apenas uma vez na montagem

  // Polling para novas tarefas atrasadas a cada 5 minutos
  useEffect(() => {
    const interval = setInterval(() => {
      // Filtrar tarefas atrasadas que ainda não foram mostradas
      const novasAtrasadas = tarefas.filter(
        (t) => isAtrasada(t.prazo) && !mostradas.has(t.id)
      );

      novasAtrasadas.forEach((tarefa) => {
        toast.error("⚠️ Tarefa Atrasada", {
          description: tarefa.titulo,
        });

        // Adicionar ao conjunto de tarefas já mostradas
        setMostradas((prev) => new Set([...prev, tarefa.id]));
      });
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, [tarefas, mostradas]);

  return <>{children}</>;
}
