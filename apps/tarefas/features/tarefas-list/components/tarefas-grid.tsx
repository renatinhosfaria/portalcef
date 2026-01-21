"use client";

import type { TarefaEnriquecida } from "@essencia/shared/types";
import { TarefaCard } from "./tarefa-card";

interface TarefasGridProps {
  tarefas: TarefaEnriquecida[];
  onConcluir: (id: string) => Promise<void>;
}

export function TarefasGrid({ tarefas, onConcluir }: TarefasGridProps) {
  if (tarefas.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground text-center">
          Nenhuma tarefa encontrada
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tarefas.map((tarefa) => (
        <TarefaCard
          key={tarefa.id}
          tarefa={tarefa}
          onConcluir={onConcluir}
        />
      ))}
    </div>
  );
}
