"use client";

import { useCallback, useEffect, useState, type PropsWithChildren } from "react";
import { toast } from "@essencia/ui/components/toaster";
import type { Tarefa } from "@essencia/shared/types";
import { useTarefas } from "../tarefas-list/hooks/use-tarefas";
import { useTarefasSocket } from "./hooks/use-tarefas-socket";
import { isAtrasada } from "@/lib/prazo-utils";

const LABELS_EVENTO: Record<string, { titulo: string; tipo: "success" | "info" | "error" }> = {
  "tarefa:criada": { titulo: "Nova tarefa atribuída", tipo: "info" },
  "tarefa:atualizada": { titulo: "Tarefa atualizada", tipo: "info" },
  "tarefa:concluida": { titulo: "Tarefa concluída", tipo: "success" },
  "tarefa:cancelada": { titulo: "Tarefa cancelada", tipo: "error" },
};

export function TarefaNotificacaoProvider({ children }: PropsWithChildren) {
  const [mostradas, setMostradas] = useState<Set<string>>(new Set());
  const { stats, tarefas, refetch } = useTarefas({ status: "PENDENTE" });

  // Notificação inicial ao montar (tarefas atrasadas)
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
  }, []);

  // Handler de eventos WebSocket
  const handleEvento = useCallback(
    (evento: string, tarefa: Tarefa) => {
      const config = LABELS_EVENTO[evento];
      if (!config) return;

      if (config.tipo === "success") {
        toast.success(config.titulo, { description: tarefa.titulo });
      } else if (config.tipo === "error") {
        toast.error(config.titulo, { description: tarefa.titulo });
      } else {
        toast.info(config.titulo, { description: tarefa.titulo });
      }

      // Refetch para atualizar lista e stats
      void refetch();
    },
    [refetch],
  );

  // Conectar ao WebSocket
  useTarefasSocket({ onEvento: handleEvento });

  // Fallback: verificar tarefas atrasadas a cada 5 minutos
  useEffect(() => {
    const interval = setInterval(() => {
      const novasAtrasadas = tarefas.filter(
        (t) => isAtrasada(t.prazo) && !mostradas.has(t.id)
      );

      novasAtrasadas.forEach((tarefa) => {
        toast.error("Tarefa Atrasada", {
          description: tarefa.titulo,
        });
        setMostradas((prev) => new Set([...prev, tarefa.id]));
      });
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [tarefas, mostradas]);

  return <>{children}</>;
}
