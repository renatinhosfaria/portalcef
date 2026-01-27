"use client";

/**
 * HistoricoTimeline Component
 * Timeline visual do histórico de ações do plano de aula
 * Task 21: Frontend - Histórico Timeline
 */

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  Check,
  CheckCheck,
  MessageSquare,
  Plus,
  Send,
  Undo,
} from "lucide-react";

import { Alert, AlertDescription } from "@essencia/ui/components/alert";
import { Badge } from "@essencia/ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { Skeleton } from "@essencia/ui/components/skeleton";
import { cn } from "@essencia/ui/lib/utils";

import type { AcaoHistorico, HistoricoEntry } from "@essencia/shared/types";

import { useHistorico } from "../hooks/use-historico";
import type { PlanoAulaStatus } from "../types";
import { PlanoStatusBadge } from "./status-badge";

interface HistoricoTimelineProps {
  planoId: string;
}

/**
 * Retorna o ícone apropriado para cada ação
 */
function getAcaoIcon(acao: AcaoHistorico) {
  switch (acao) {
    case "CRIADO":
      return <Plus className="h-4 w-4" />;
    case "SUBMETIDO":
      return <Send className="h-4 w-4" />;
    case "APROVADO_ANALISTA":
      return <Check className="h-4 w-4" />;
    case "APROVADO_COORDENADORA":
      return <CheckCheck className="h-4 w-4" />;
    case "DEVOLVIDO_ANALISTA":
    case "DEVOLVIDO_COORDENADORA":
      return <Undo className="h-4 w-4" />;
    default:
      return <Check className="h-4 w-4" />;
  }
}

/**
 * Retorna as classes de cor para o círculo do ícone
 */
function getAcaoColor(acao: AcaoHistorico): string {
  switch (acao) {
    case "CRIADO":
      return "bg-blue-100 text-blue-600";
    case "SUBMETIDO":
      return "bg-yellow-100 text-yellow-600";
    case "APROVADO_ANALISTA":
    case "APROVADO_COORDENADORA":
      return "bg-green-100 text-green-600";
    case "DEVOLVIDO_ANALISTA":
    case "DEVOLVIDO_COORDENADORA":
      return "bg-red-100 text-red-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

/**
 * Retorna o label em português para cada ação
 */
function getAcaoLabel(acao: AcaoHistorico): string {
  switch (acao) {
    case "CRIADO":
      return "Plano criado";
    case "SUBMETIDO":
      return "Plano submetido para análise";
    case "APROVADO_ANALISTA":
      return "Aprovado pela analista";
    case "DEVOLVIDO_ANALISTA":
      return "Devolvido pela analista";
    case "APROVADO_COORDENADORA":
      return "Aprovado pela coordenadora";
    case "DEVOLVIDO_COORDENADORA":
      return "Devolvido pela coordenadora";
    default:
      return acao;
  }
}

/**
 * Retorna o label em português para cada role
 */
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

/**
 * User info component
 */
function UserInfo({
  userName,
  userRole,
}: {
  userName: string;
  userRole: string;
}) {
  return (
    <div className="text-sm text-muted-foreground">
      Por <span className="font-medium">{userName}</span> (
      {getRoleLabel(userRole)})
    </div>
  );
}

/**
 * Timeline Item Component
 */
function TimelineItem({ entry }: { entry: HistoricoEntry }) {
  const hasComentarios =
    entry.detalhes &&
    typeof entry.detalhes === "object" &&
    "comentarios" in entry.detalhes &&
    entry.detalhes.comentarios;

  return (
    <div key={entry.id} className="relative flex gap-4">
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

        <UserInfo userName={entry.userName} userRole={entry.userRole} />

        {entry.statusAnterior ? (
          <div className="flex items-center gap-2 text-xs pt-2">
            <PlanoStatusBadge
              status={entry.statusAnterior as PlanoAulaStatus}
            />
            <ArrowRight className="h-3 w-3" />
            <PlanoStatusBadge status={entry.statusNovo as PlanoAulaStatus} />
          </div>
        ) : null}

        {hasComentarios ? (
          <Alert className="mt-2">
            <MessageSquare className="h-4 w-4" />
            <AlertDescription>
              {String(entry.detalhes!.comentarios)}
            </AlertDescription>
          </Alert>
        ) : null}
      </div>
    </div>
  );
}

export function HistoricoTimeline({ planoId }: HistoricoTimelineProps) {
  const hookResult = useHistorico(planoId);
  const historico: HistoricoEntry[] = hookResult.historico;
  const isLoading: boolean = hookResult.isLoading;

  // Loading state
  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  // Empty state
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

  // Timeline UI
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
