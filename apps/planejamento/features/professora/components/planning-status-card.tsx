"use client";

import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import {
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  FileText,
  XCircle,
} from "lucide-react";
import Link from "next/link";

type PlanningStatus = "RASCUNHO" | "PENDENTE" | "EM_AJUSTE" | "APROVADO";

interface PlanningStatusCardProps {
  status: PlanningStatus;
  turma: string;
  quinzena: string;
  updatedAt: Date;
  hasDraft?: boolean;
}

const STATUS_CONFIG: Record<
  PlanningStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  RASCUNHO: {
    label: "Rascunho",
    color: "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800",
    icon: <FileText className="h-4 w-4" />,
  },
  PENDENTE: {
    label: "Pendente",
    color:
      "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30",
    icon: <Clock className="h-4 w-4" />,
  },
  EM_AJUSTE: {
    label: "Em Ajuste",
    color:
      "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30",
    icon: <XCircle className="h-4 w-4" />,
  },
  APROVADO: {
    label: "Aprovado",
    color:
      "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
};

/**
 * PlanningStatusCard - Shows the current planning status with actions
 */
export function PlanningStatusCard({
  status,
  turma,
  quinzena,
  updatedAt,
  hasDraft = false,
}: PlanningStatusCardProps) {
  const config = STATUS_CONFIG[status];
  const timeAgo = getTimeAgo(updatedAt);

  const canEdit = status === "RASCUNHO" || status === "EM_AJUSTE";
  const canPreview = status !== "RASCUNHO" || hasDraft;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Seu Planejamento
          </CardTitle>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${config.color}`}
          >
            {config.icon}
            {config.label}
          </span>
        </div>
        <CardDescription>
          Turma: {turma} | Quinzena: {quinzena}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Ultima atualizacao: {timeAgo}
        </p>

        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button asChild>
              <Link href="/planejamentos/novo">
                <Edit3 className="h-4 w-4 mr-2" />
                {status === "EM_AJUSTE" ? "Corrigir" : "Continuar Editando"}
              </Link>
            </Button>
          )}
          {canPreview && (
            <Button variant="outline" asChild>
              <Link href="/planejamentos/preview">
                <Eye className="h-4 w-4 mr-2" />
                Ver Preview
              </Link>
            </Button>
          )}
          {status === "APROVADO" && (
            <Button variant="outline" disabled>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Planejamento Aprovado
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "agora mesmo";
  if (diffMins < 60) return `ha ${diffMins} minuto${diffMins > 1 ? "s" : ""}`;
  if (diffHours < 24) return `ha ${diffHours} hora${diffHours > 1 ? "s" : ""}`;
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `ha ${diffDays} dias`;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
