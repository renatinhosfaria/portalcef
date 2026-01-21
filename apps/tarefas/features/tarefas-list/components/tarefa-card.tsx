"use client";

import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { cn } from "@essencia/ui/lib/utils";
import type { TarefaEnriquecida } from "@essencia/shared/types";
import { PrioridadeBadge } from "@/components/prioridade-badge";
import { StatusBadge } from "@/components/status-badge";
import { PrazoIndicator } from "@/components/prazo-indicator";
import { isAtrasada } from "@/lib/prazo-utils";

interface TarefaCardProps {
  tarefa: TarefaEnriquecida;
  onConcluir: (id: string) => Promise<void>;
}

export function TarefaCard({ tarefa, onConcluir }: TarefaCardProps) {
  const atrasada = isAtrasada(tarefa.prazo);

  const handleConcluir = async () => {
    await onConcluir(tarefa.id);
  };

  return (
    <Card
      className={cn(atrasada && "border-destructive")}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <CardTitle className="text-lg">{tarefa.titulo}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <PrioridadeBadge prioridade={tarefa.prioridade} size="sm" />
              <StatusBadge status={tarefa.status} />
            </div>
          </div>
          {tarefa.status === "PENDENTE" && (
            <Button
              size="sm"
              onClick={handleConcluir}
              variant="default"
            >
              Concluir
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {tarefa.descricao && (
          <p className="text-sm text-muted-foreground">
            {tarefa.descricao}
          </p>
        )}

        <PrazoIndicator prazo={tarefa.prazo} />

        <div className="border-t pt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Por:</span>
            <span className="font-medium">{tarefa.criadoPorNome}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Para:</span>
            <span className="font-medium">{tarefa.responsavelNome}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
