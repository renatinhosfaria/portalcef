"use client";

import { useRouter } from "next/navigation";
import { Button } from "@essencia/ui/components/button";
import { Badge } from "@essencia/ui/components/badge";
import { CheckSquare } from "lucide-react";
import { useTarefas } from "../tarefas-list/hooks/use-tarefas";

/**
 * Widget de badge para notificação de tarefas pendentes
 *
 * Exibe um botão com ícone de checkbox e badge indicando:
 * - Tarefas atrasadas (badge vermelho) quando houver tarefas atrasadas
 * - Tarefas pendentes (badge cinza) quando não houver tarefas atrasadas
 * - Esconde o widget quando não há tarefas pendentes
 *
 * Clicando no widget, navega para o dashboard de tarefas (/tarefas)
 */
export function TarefaBadge() {
  const router = useRouter();
  const { stats } = useTarefas({ status: "PENDENTE" });

  // Não exibe o widget se não há tarefas pendentes
  if (stats.pendentes === 0) {
    return null;
  }

  const handleClick = () => {
    router.push("/tarefas");
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="relative"
      onClick={handleClick}
      title={
        stats.atrasadas > 0
          ? `${stats.atrasadas} tarefa${stats.atrasadas > 1 ? "s" : ""} atrasada${stats.atrasadas > 1 ? "s" : ""}`
          : `${stats.pendentes} tarefa${stats.pendentes > 1 ? "s" : ""} pendente${stats.pendentes > 1 ? "s" : ""}`
      }
    >
      <CheckSquare className="h-5 w-5" />
      <Badge
        variant={stats.atrasadas > 0 ? "destructive" : "secondary"}
        className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center"
      >
        {stats.atrasadas > 0 ? stats.atrasadas : stats.pendentes}
      </Badge>
    </Button>
  );
}
