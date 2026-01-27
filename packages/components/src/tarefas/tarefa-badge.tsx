"use client";

import { Button } from "@essencia/ui/components/button";
import { Badge } from "@essencia/ui/components/badge";
import { CheckSquare } from "lucide-react";

export interface TarefaBadgeProps {
  /** Número de tarefas pendentes */
  pendentes: number;
  /** Número de tarefas atrasadas */
  atrasadas: number;
  /** Callback ao clicar no badge */
  onClick?: () => void;
}

/**
 * Widget de badge para notificação de tarefas pendentes
 *
 * Exibe um botão com ícone de checkbox e badge indicando:
 * - Tarefas atrasadas (badge vermelho) quando houver tarefas atrasadas
 * - Tarefas pendentes (badge cinza) quando não houver tarefas atrasadas
 * - Esconde o widget quando não há tarefas pendentes
 */
export function TarefaBadge({ pendentes, atrasadas, onClick }: TarefaBadgeProps) {
  // Não exibe o widget se não há tarefas pendentes
  if (pendentes === 0) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="relative"
      onClick={onClick}
      title={
        atrasadas > 0
          ? `${atrasadas} tarefa${atrasadas > 1 ? "s" : ""} atrasada${atrasadas > 1 ? "s" : ""}`
          : `${pendentes} tarefa${pendentes > 1 ? "s" : ""} pendente${pendentes > 1 ? "s" : ""}`
      }
    >
      <CheckSquare className="h-5 w-5" />
      <Badge
        variant={atrasadas > 0 ? "destructive" : "secondary"}
        className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center"
      >
        {atrasadas > 0 ? atrasadas : pendentes}
      </Badge>
    </Button>
  );
}
