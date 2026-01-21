import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@essencia/ui/lib/utils";
import {
  calcularDiasRestantes,
  isAtrasada,
  getPrazoVariant,
} from "@/lib/prazo-utils";

interface PrazoIndicatorProps {
  prazo: string; // ISO 8601 datetime
  compact?: boolean;
}

const variantColors: Record<
  "default" | "warning" | "destructive",
  string
> = {
  default: "text-muted-foreground",
  warning: "text-orange-600",
  destructive: "text-red-600",
};

export function PrazoIndicator({ prazo, compact = false }: PrazoIndicatorProps) {
  const atrasada = isAtrasada(prazo);
  const diasRestantes = calcularDiasRestantes(prazo);
  const variant = getPrazoVariant(prazo);
  const colorClass = variantColors[variant];

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1 text-xs", colorClass)}>
        {atrasada ? (
          <AlertTriangle className="h-3 w-3" />
        ) : (
          <Clock className="h-3 w-3" />
        )}
        <span>
          {atrasada
            ? `Atrasada ${Math.abs(diasRestantes)}d`
            : `${diasRestantes}d restantes`}
        </span>
      </div>
    );
  }

  const prazoDate = new Date(prazo);
  const prazoFormatado = format(prazoDate, "dd/MM/yyyy HH:mm", {
    locale: ptBR,
  });

  return (
    <div className={cn("flex items-center gap-2", colorClass)}>
      {atrasada ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <Clock className="h-4 w-4" />
      )}
      <div className="flex flex-col">
        <span className="text-xs font-medium">
          {atrasada ? "Atrasada" : "Prazo"}
        </span>
        <span className="text-sm">
          {prazoFormatado}
          {!atrasada && ` (${diasRestantes} dias)`}
        </span>
      </div>
    </div>
  );
}
