"use client";

/**
 * PlanoStatusBadge Component
 * Badge para exibir status do plano de aula com cores semanticas
 * Task 3.2: Criar componentes de upload e lista de documentos
 */

import { Badge } from "@essencia/ui/components/badge";
import { cn } from "@essencia/ui/lib/utils";

import type { PlanoAulaStatus } from "../types";
import { STATUS_COLORS, STATUS_LABELS } from "../types";

interface PlanoStatusBadgeProps {
  status: PlanoAulaStatus;
  className?: string;
}

export function PlanoStatusBadge({ status, className }: PlanoStatusBadgeProps) {
  const colors = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];

  return (
    <Badge
      variant="outline"
      className={cn(colors.bg, colors.text, colors.border, "border", className)}
    >
      {label}
    </Badge>
  );
}
