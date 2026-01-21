import { Badge } from "@essencia/ui/components/badge";
import { cn } from "@essencia/ui/lib/utils";
import type { TarefaStatus } from "@essencia/shared/types";

interface StatusBadgeProps {
  status: TarefaStatus;
}

const statusConfig: Record<
  TarefaStatus,
  {
    variant: "default" | "secondary" | "destructive";
    label: string;
    customClass?: string;
  }
> = {
  PENDENTE: {
    variant: "default",
    label: "Pendente",
  },
  CONCLUIDA: {
    variant: "secondary",
    label: "Concluída",
    customClass: "bg-green-500 text-white border-transparent hover:bg-green-600",
  },
  CANCELADA: {
    variant: "secondary",
    label: "Cancelada",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge
      variant={config.variant}
      className={cn(config.customClass)}
    >
      {config.label}
    </Badge>
  );
}
