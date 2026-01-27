"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@essencia/ui/components/card";
import { Button } from "@essencia/ui/components/button";
import { Badge } from "@essencia/ui/components/badge";
import { PrioridadeBadge } from "./prioridade-badge";
import { PrazoIndicator } from "./prazo-indicator";
import type { TarefaPrioridade } from "@essencia/shared/types";

export interface TarefaWidget {
  id: string;
  titulo: string;
  prioridade: TarefaPrioridade;
  prazo: string;
}

export interface TarefasPendentesWidgetProps {
  /** Lista de tarefas a serem exibidas */
  tarefas: TarefaWidget[];
  /** Indica se está carregando */
  isLoading?: boolean;
  /** Callback ao clicar em uma tarefa */
  onTarefaClick?: (tarefaId: string) => void;
  /** Callback ao clicar em "Ver todas" */
  onVerTodas?: () => void;
}

export function TarefasPendentesWidget({
  tarefas,
  isLoading = false,
  onTarefaClick,
  onVerTodas,
}: TarefasPendentesWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Carregando...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Tarefas Urgentes</span>
          <Badge variant="destructive">{tarefas.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tarefas.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            Nenhuma tarefa urgente
          </div>
        ) : (
          <div className="space-y-2">
            {tarefas.map((tarefa) => (
              <div
                key={tarefa.id}
                className="flex items-start justify-between p-2 rounded border hover:bg-accent cursor-pointer"
                onClick={() => onTarefaClick?.(tarefa.id)}
              >
                <div className="flex-1">
                  <div className="text-sm font-medium">{tarefa.titulo}</div>
                  <div className="flex gap-2 mt-1">
                    <PrioridadeBadge
                      prioridade={tarefa.prioridade}
                      size="sm"
                    />
                    <PrazoIndicator prazo={tarefa.prazo} compact />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {onVerTodas && (
          <Button
            variant="link"
            className="w-full mt-4"
            onClick={onVerTodas}
          >
            Ver todas as tarefas →
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
