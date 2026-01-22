"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@essencia/ui/components/card";
import { Button } from "@essencia/ui/components/button";
import { Badge } from "@essencia/ui/components/badge";
import { useTarefas } from "../tarefas-list/hooks/use-tarefas";
import { PrioridadeBadge } from "../../components/prioridade-badge";
import { PrazoIndicator } from "../../components/prazo-indicator";
import { calcularDiasRestantes, isAtrasada } from "../../lib/prazo-utils";

export interface TarefasPendentesWidgetProps {
  modulo?: string;
  quinzenaId?: string;
}

export function TarefasPendentesWidget({
  modulo,
  quinzenaId,
}: TarefasPendentesWidgetProps) {
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
          <Badge variant="destructive">{tarefasUrgentes.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tarefasUrgentes.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            Nenhuma tarefa urgente
          </div>
        ) : (
          <div className="space-y-2">
            {tarefasUrgentes.map((tarefa) => (
              <div
                key={tarefa.id}
                className="flex items-start justify-between p-2 rounded border hover:bg-accent cursor-pointer"
                onClick={() => router.push(`/tarefas/${tarefa.id}`)}
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

        <Button
          variant="link"
          className="w-full mt-4"
          onClick={() => router.push("/tarefas")}
        >
          Ver todas as tarefas →
        </Button>
      </CardContent>
    </Card>
  );
}
