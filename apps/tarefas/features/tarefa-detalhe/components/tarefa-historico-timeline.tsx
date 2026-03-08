"use client";

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCheck, Edit, Plus, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { Skeleton } from "@essencia/ui/components/skeleton";
import { cn } from "@essencia/ui/lib/utils";
import {
  useHistoricoTarefa,
  type HistoricoTarefaEntry,
} from "../hooks/use-historico-tarefa";

const CAMPO_LABELS: Record<string, string> = {
  titulo: "Título",
  descricao: "Descrição",
  prioridade: "Prioridade",
  prazo: "Prazo",
  responsavel: "Responsável",
};

const ROLE_LABELS: Record<string, string> = {
  professora: "Professora",
  analista_pedagogico: "Analista Pedagógica",
  coordenadora_geral: "Coord. Geral",
  gerente_unidade: "Gerente de Unidade",
  diretora_geral: "Diretora Geral",
  master: "Master",
  sistema: "Sistema",
  usuario: "Usuário",
};

function getAcaoIcon(acao: HistoricoTarefaEntry["acao"]) {
  switch (acao) {
    case "CRIADA":
      return <Plus className="h-4 w-4" />;
    case "EDITADA":
      return <Edit className="h-4 w-4" />;
    case "CONCLUIDA":
      return <CheckCheck className="h-4 w-4" />;
    case "CANCELADA":
      return <X className="h-4 w-4" />;
  }
}

function getAcaoColor(acao: HistoricoTarefaEntry["acao"]): string {
  switch (acao) {
    case "CRIADA":
      return "bg-blue-100 text-blue-600";
    case "EDITADA":
      return "bg-yellow-100 text-yellow-600";
    case "CONCLUIDA":
      return "bg-green-100 text-green-600";
    case "CANCELADA":
      return "bg-red-100 text-red-600";
  }
}

function getAcaoLabel(entry: HistoricoTarefaEntry): string {
  if (entry.acao === "EDITADA" && entry.campoAlterado) {
    return `${CAMPO_LABELS[entry.campoAlterado] ?? entry.campoAlterado} alterado`;
  }
  const labels: Record<string, string> = {
    CRIADA: "Tarefa criada",
    CONCLUIDA: "Tarefa concluída",
    CANCELADA: "Tarefa cancelada",
  };
  return labels[entry.acao] ?? entry.acao;
}

function TimelineItem({ entry }: { entry: HistoricoTarefaEntry }) {
  return (
    <div className="relative flex gap-4">
      <div
        className={cn(
          "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          getAcaoColor(entry.acao),
        )}
      >
        {getAcaoIcon(entry.acao)}
      </div>
      <div className="flex-1 space-y-1 pb-6">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{getAcaoLabel(entry)}</p>
          <time className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(entry.createdAt), {
              addSuffix: true,
              locale: ptBR,
            })}
          </time>
        </div>
        <p className="text-sm text-muted-foreground">
          Por <span className="font-medium">{entry.userName}</span> (
          {ROLE_LABELS[entry.userRole] ?? entry.userRole})
        </p>
        {entry.acao === "EDITADA" &&
          entry.valorAnterior != null &&
          entry.valorNovo != null && (
            <p className="text-xs text-muted-foreground">
              <span className="line-through">{entry.valorAnterior}</span>
              {" → "}
              <span className="font-medium">{entry.valorNovo}</span>
            </p>
          )}
      </div>
    </div>
  );
}

export function TarefaHistoricoTimeline({
  tarefaId,
}: {
  tarefaId: string;
}) {
  const { historico, isLoading } = useHistoricoTarefa(tarefaId);

  if (isLoading) return <Skeleton className="h-48" />;

  if (historico.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">
            Nenhuma ação registrada
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
          {historico.map((entry) => (
            <TimelineItem key={entry.id} entry={entry} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
