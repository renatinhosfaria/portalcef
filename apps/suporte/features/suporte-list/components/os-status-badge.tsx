"use client";

import type {
  OrdemServicoStatus,
  OrdemServicoCategoria,
} from "@essencia/shared/types";
import { Badge } from "@essencia/ui/components/badge";
import { cn } from "@essencia/ui/lib/utils";
import { STATUS_LABELS, CATEGORIA_LABELS } from "@essencia/shared/types";

// ============================================
// Status Badge
// ============================================

interface OsStatusBadgeProps {
  status: OrdemServicoStatus;
}

const statusClasses: Record<OrdemServicoStatus, string> = {
  ABERTA: "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100",
  EM_ANDAMENTO:
    "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100",
  RESOLVIDA:
    "bg-green-100 text-green-800 border-green-200 hover:bg-green-100",
  FECHADA: "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-100",
};

export function OsStatusBadge({ status }: OsStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(statusClasses[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

// ============================================
// Categoria Badge
// ============================================

interface OsCategoriaBadgeProps {
  categoria: OrdemServicoCategoria;
}

const categoriaClasses: Record<OrdemServicoCategoria, string> = {
  ERRO_SISTEMA: "bg-red-100 text-red-800 border-red-200 hover:bg-red-100",
  DUVIDA_USO: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100",
  SUGESTAO_MELHORIA:
    "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100",
  PROBLEMA_ACESSO:
    "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100",
};

export function OsCategoriaBadge({ categoria }: OsCategoriaBadgeProps) {
  return (
    <Badge variant="outline" className={cn(categoriaClasses[categoria])}>
      {CATEGORIA_LABELS[categoria]}
    </Badge>
  );
}
