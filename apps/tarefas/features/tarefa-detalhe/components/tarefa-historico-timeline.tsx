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

interface TarefaHistoricoTimelineProps {
  tarefaId: string;
}

type TarefaAcao = HistoricoTarefaEntry["acao"];

function getAcaoIcon(acao: TarefaAcao) {
  switch (acao) {
    case "CRIADA":
      return <Plus className="h-4 w-4" />;
    case "EDITADA":
      return <Edit className="h-4 w-4" />;
    case "CONCLUIDA":
      return <CheckCheck className="h-4 w-4" />;
    case "CANCELADA":
      return <X className="h-4 w-4" />;
    default:
      return <Plus className="h-4 w-4" />;
  }
}

function getAcaoColor(acao: TarefaAcao): string {
  switch (acao) {
    case "CRIADA":
      return "bg-blue-100 text-blue-600";
    case "EDITADA":
      return "bg-yellow-100 text-yellow-600";
    case "CONCLUIDA":
      return "bg-green-100 text-green-600";
    case "CANCELADA":
      return "bg-red-100 text-red-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function getAcaoLabel(acao: TarefaAcao): string {
  switch (acao) {
    case "CRIADA":
      return "Tarefa criada";
    case "EDITADA":
      return "Tarefa editada";
    case "CONCLUIDA":
      return "Tarefa concluída";
    case "CANCELADA":
      return "Tarefa cancelada";
    default:
      return acao;
  }
}

function getRoleLabel(role: string): string {
  const roleLabels: Record<string, string> = {
    professora: "Professora",
    analista_pedagogico: "Analista Pedagógica",
    coordenadora_bercario: "Coordenadora Berçário",
    coordenadora_infantil: "Coordenadora Infantil",
    coordenadora_fundamental_i: "Coordenadora Fundamental I",
    coordenadora_fundamental_ii: "Coordenadora Fundamental II",
    coordenadora_medio: "Coordenadora Médio",
    coordenadora_geral: "Coordenadora Geral",
    diretora_geral: "Diretora Geral",
    gerente_unidade: "Gerente de Unidade",
    master: "Master",
  };
  return roleLabels[role] || role;
}

function getCampoLabel(campo: string): string {
  const campoLabels: Record<string, string> = {
    titulo: "Título",
    descricao: "Descrição",
    prioridade: "Prioridade",
    prazo: "Prazo",
    responsavel: "Responsável",
  };
  return campoLabels[campo] || campo;
}

function TimelineItem({ entry }: { entry: HistoricoTarefaEntry }) {
  return (
    <div className="relative flex gap-4">
      <div
        className={cn(
          "relative z-10 flex h-8 w-8 items-center justify-center rounded-full",
          getAcaoColor(entry.acao),
        )}
      >
        {getAcaoIcon(entry.acao)}
      </div>

      <div className="flex-1 space-y-1 pb-6">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{getAcaoLabel(entry.acao)}</p>
          <time className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(entry.createdAt), {
              addSuffix: true,
              locale: ptBR,
            })}
          </time>
        </div>

        <div className="text-sm text-muted-foreground">
          Por <span className="font-medium">{entry.userName}</span> ({getRoleLabel(entry.userRole)})
        </div>

        {entry.acao === "EDITADA" && entry.campoAlterado && (
          <div className="mt-2 rounded border bg-muted/50 px-3 py-2 text-xs">
            <span className="font-medium">{getCampoLabel(entry.campoAlterado)}</span>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-muted-foreground line-through">
                {entry.valorAnterior || "(vazio)"}
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium">{entry.valorNovo || "(vazio)"}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function TarefaHistoricoTimeline({ tarefaId }: TarefaHistoricoTimelineProps) {
  const { historico, isLoading } = useHistoricoTarefa(tarefaId);

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

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
        <CardTitle>Histórico de Ações</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-6">
          {/* Vertical line connecting entries */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          {historico.map((entry) => (
            <TimelineItem key={entry.id} entry={entry} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
