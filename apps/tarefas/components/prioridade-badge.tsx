import { Badge } from "@essencia/ui/components/badge";
import { cn } from "@essencia/ui/lib/utils";
import type { TarefaPrioridade } from "@essencia/shared/types";

interface PrioridadeBadgeProps {
  prioridade: TarefaPrioridade;
  size?: "sm" | "md";
}

const prioridadeConfig: Record<
  TarefaPrioridade,
  {
    variant: "default" | "secondary" | "destructive";
    label: string;
    customClass?: string;
  }
> = {
  ALTA: {
    variant: "destructive",
    label: "Alta",
  },
  MEDIA: {
    variant: "default",
    label: "Média",
    customClass: "bg-orange-500 text-white border-transparent hover:bg-orange-600",
  },
  BAIXA: {
    variant: "secondary",
    label: "Baixa",
  },
};

export function PrioridadeBadge({
  prioridade,
  size = "md",
}: PrioridadeBadgeProps) {
  const config = prioridadeConfig[prioridade];

  return (
    <Badge
      variant={config.variant}
      className={cn(
        size === "sm" && "text-xs",
        config.customClass
      )}
    >
      {config.label}
    </Badge>
  );
}
