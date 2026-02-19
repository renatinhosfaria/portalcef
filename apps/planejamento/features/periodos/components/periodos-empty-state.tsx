import { CalendarX } from "lucide-react";
import { Card, CardContent } from "@essencia/ui/components/card";

interface PeriodosEmptyStateProps {
  etapa: string;
}

export function PeriodosEmptyState({ etapa }: PeriodosEmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <CalendarX className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold mb-2">
          Nenhum Plano de Aula disponível ainda
        </h3>
        <p className="text-muted-foreground mb-4 max-w-md">
          A coordenação ainda não configurou os períodos de planejamento para
          sua turma ({etapa}).
        </p>
        <p className="text-sm text-muted-foreground">
          Aguarde a coordenação criar os Planos de Aula. Você será notificada
          quando estiverem disponíveis.
        </p>
      </CardContent>
    </Card>
  );
}
