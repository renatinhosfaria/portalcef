/**
 * StatusBadge Component
 * Badge reutilizável para exibir status de planejamento com cores semânticas
 * Epic 4 - Story 4.1: Lista de Planejamentos por Segmento
 */

"use client";

import { Badge } from "@essencia/ui/components/badge";
import { cn } from "@essencia/ui/lib/utils";

export type PlanningStatusType =
  | "RASCUNHO"
  | "PENDENTE"
  | "APROVADO"
  | "EM_AJUSTE";

interface StatusBadgeProps {
  status: PlanningStatusType;
  className?: string;
}

const statusConfig: Record<
  PlanningStatusType,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className: string;
  }
> = {
  RASCUNHO: {
    label: "Rascunho",
    variant: "outline",
    className: "border-muted-foreground/50 text-muted-foreground",
  },
  PENDENTE: {
    label: "Pendente",
    variant: "default",
    className:
      "bg-yellow-500 hover:bg-yellow-500/90 text-white border-yellow-500",
  },
  APROVADO: {
    label: "Aprovado",
    variant: "secondary",
    className: "bg-green-600 hover:bg-green-600/90 text-white border-green-600",
  },
  EM_AJUSTE: {
    label: "Em Ajuste",
    variant: "destructive",
    className: "bg-red-600 hover:bg-red-600/90 text-white border-red-600",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
