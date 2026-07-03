"use client";

/**
 * HistoricoTimeline Component
 * Timeline visual do histórico de ações do plano de aula
 * Task 21: Frontend - Histórico Timeline
 */

import { formatarDataHora } from "@essencia/shared/formatar-data";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  ArrowRightLeft,
  Check,
  CheckCheck,
  MessageSquare,
  Plus,
  Printer,
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

import {
  PROVA_STATUS_COLORS,
  PROVA_STATUS_LABELS,
  type ProvaStatus,
} from "../../prova/types";
import {
  STATUS_COLORS as RELATORIO_STATUS_COLORS,
  STATUS_LABELS as RELATORIO_STATUS_LABELS,
  type RelatorioStatus,
} from "../../relatorio/types";
import { useHistorico } from "../hooks/use-historico";
import {
  STATUS_COLORS as PLANO_STATUS_COLORS,
  STATUS_LABELS as PLANO_STATUS_LABELS,
  type PlanoAulaStatus,
} from "../types";

type HistoricoModulo = "plano-aula" | "prova" | "relatorio";

interface HistoricoTimelineProps {
  planoId: string;
  modulo?: HistoricoModulo;
}

function isPlanoAulaStatus(status: string): status is PlanoAulaStatus {
  return status in PLANO_STATUS_LABELS;
}

function isProvaStatus(status: string): status is ProvaStatus {
  return status in PROVA_STATUS_LABELS;
}

function isRelatorioStatus(status: string): status is RelatorioStatus {
  return status in RELATORIO_STATUS_LABELS;
}

function formatarStatusDesconhecido(status: string): string {
  return status
    .split("_")
    .map((parte) => parte.charAt(0) + parte.slice(1).toLowerCase())
    .join(" ");
}

function HistoricoStatusBadge({
  status,
  modulo,
}: {
  status: string;
  modulo: HistoricoModulo;
}) {
  if (modulo === "prova" && isProvaStatus(status)) {
    return (
      <Badge
        variant="outline"
        className={cn(PROVA_STATUS_COLORS[status], "border")}
      >
        {PROVA_STATUS_LABELS[status]}
      </Badge>
    );
  }

  if (modulo === "relatorio" && isRelatorioStatus(status)) {
    return (
      <Badge
        variant="outline"
        className={cn(RELATORIO_STATUS_COLORS[status], "border")}
      >
        {RELATORIO_STATUS_LABELS[status]}
      </Badge>
    );
  }

  if (isPlanoAulaStatus(status)) {
    const colors = PLANO_STATUS_COLORS[status];
    return (
      <Badge
        variant="outline"
        className={cn(colors.bg, colors.text, colors.border, "border")}
      >
        {PLANO_STATUS_LABELS[status]}
      </Badge>
    );
  }

  if (isProvaStatus(status)) {
    return (
      <Badge
        variant="outline"
        className={cn(PROVA_STATUS_COLORS[status], "border")}
      >
        {PROVA_STATUS_LABELS[status]}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border border-gray-300 bg-gray-100 text-gray-700"
    >
      {formatarStatusDesconhecido(status)}
    </Badge>
  );
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
    case "DOCUMENTO_IMPRESSO":
      return <Printer className="h-4 w-4" />;
    case "RECUPERADO":
      return <Undo className="h-4 w-4" />;
    case "COMENTARIO_ADICIONADO":
      return <MessageSquare className="h-4 w-4" />;
    case "TRANSFERIDO":
      return <ArrowRightLeft className="h-4 w-4" />;
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
    case "SUBMETIDO_IMPRESSAO":
    case "SUBMETIDO_ANALISTA":
    case "RESUBMETIDO_ANALISTA":
    case "ENVIADO_RESPONDER":
      return "bg-yellow-100 text-yellow-600";
    case "APROVADO_ANALISTA":
    case "APROVADO_COORDENADORA":
      return "bg-green-100 text-green-600";
    case "DEVOLVIDO_ANALISTA":
    case "DEVOLVIDO_COORDENADORA":
      return "bg-red-100 text-red-600";
    case "DOCUMENTO_IMPRESSO":
      return "bg-indigo-100 text-indigo-600";
    case "RECUPERADO":
      return "bg-amber-100 text-amber-600";
    case "COMENTARIO_ADICIONADO":
      return "bg-blue-100 text-blue-600";
    case "TRANSFERIDO":
      return "bg-purple-100 text-purple-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

/**
 * Retorna o label em português para cada ação
 */
function getAcaoLabel(acao: AcaoHistorico, modulo: HistoricoModulo): string {
  switch (acao) {
    case "CRIADO":
      if (modulo === "relatorio") return "Relatório criado";
      if (modulo === "prova") return "Prova criada";
      return "Plano criado";
    case "SUBMETIDO":
      if (modulo === "relatorio") return "Relatório submetido para análise";
      if (modulo === "prova") return "Prova submetida para análise";
      return "Plano submetido para análise";
    case "SUBMETIDO_IMPRESSAO":
      return "Prova enviada para impressão";
    case "ENVIADO_RESPONDER":
      return "Prova enviada para resposta";
    case "SUBMETIDO_ANALISTA":
      return "Prova enviada para análise";
    case "RESUBMETIDO_ANALISTA":
      return "Prova reenviada para análise";
    case "APROVADO_ANALISTA":
      return "Aprovado pela analista";
    case "DEVOLVIDO_ANALISTA":
      return "Devolvido pela analista";
    case "APROVADO_COORDENADORA":
      return "Aprovado pela coordenadora";
    case "DEVOLVIDO_COORDENADORA":
      return "Devolvido pela coordenadora";
    case "DOCUMENTO_IMPRESSO":
      return "Documento impresso";
    case "RECUPERADO":
      if (modulo === "relatorio") {
        return "Relatório recuperado pela professora";
      }
      if (modulo === "prova") return "Prova recuperada pela professora";
      return "Plano recuperado pela professora";
    case "COMENTARIO_ADICIONADO":
      return "Comentário adicionado";
    case "TRANSFERIDO":
      if (modulo === "relatorio") {
        return "Relatório transferido entre professoras";
      }
      if (modulo === "prova") return "Prova transferida entre professoras";
      return "Plano transferido entre professoras";
    default:
      return acao;
  }
}

function getDetalhesMensagem(entry: HistoricoEntry): string | null {
  if (!entry.detalhes || typeof entry.detalhes !== "object") {
    return null;
  }

  if ("comentarios" in entry.detalhes && entry.detalhes.comentarios) {
    return String(entry.detalhes.comentarios);
  }

  if (entry.acao === "DOCUMENTO_IMPRESSO") {
    const documentoNome =
      typeof entry.detalhes.documentoNome === "string"
        ? entry.detalhes.documentoNome
        : "Documento";

    const impressoEm =
      typeof entry.detalhes.impressoEm === "string"
        ? formatarDataHora(entry.detalhes.impressoEm)
        : null;

    if (impressoEm) {
      return `${documentoNome} impresso em ${impressoEm}`;
    }

    return `${documentoNome} impresso`;
  }

  if (entry.acao === "COMENTARIO_ADICIONADO") {
    const documentoNome =
      typeof entry.detalhes?.documentoNome === "string"
        ? entry.detalhes.documentoNome
        : "Documento";
    return `Comentário adicionado ao documento "${documentoNome}"`;
  }

  if (entry.acao === "TRANSFERIDO") {
    const anteriorNome =
      typeof entry.detalhes?.professoraAnteriorNome === "string"
        ? entry.detalhes.professoraAnteriorNome
        : "professora anterior";
    const novaNome =
      typeof entry.detalhes?.novaProfessoraNome === "string"
        ? entry.detalhes.novaProfessoraNome
        : "nova professora";
    return `Plano transferido de ${anteriorNome} para ${novaNome}`;
  }

  return null;
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
function TimelineItem({
  entry,
  modulo,
}: {
  entry: HistoricoEntry;
  modulo: HistoricoModulo;
}) {
  const detalhesMensagem = getDetalhesMensagem(entry);

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
          <p className="text-sm font-medium">
            {getAcaoLabel(entry.acao, modulo)}
          </p>
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
            <HistoricoStatusBadge
              status={entry.statusAnterior}
              modulo={modulo}
            />
            <ArrowRight className="h-3 w-3" />
            <HistoricoStatusBadge status={entry.statusNovo} modulo={modulo} />
          </div>
        ) : null}

        {detalhesMensagem ? (
          <Alert className="mt-2">
            {entry.acao === "DOCUMENTO_IMPRESSO" ? (
              <Printer className="h-4 w-4" />
            ) : (
              <MessageSquare className="h-4 w-4" />
            )}
            <AlertDescription>{detalhesMensagem}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </div>
  );
}

export function HistoricoTimeline({
  planoId,
  modulo = "plano-aula",
}: HistoricoTimelineProps) {
  const hookResult = useHistorico(planoId, modulo);
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
            <TimelineItem key={entry.id} entry={entry} modulo={modulo} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
