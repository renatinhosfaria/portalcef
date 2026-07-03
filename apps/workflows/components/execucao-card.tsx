import type {
  WorkflowExecucaoResumo,
  WorkflowExecucaoStatus,
} from "@essencia/shared/types/workflows";
import { Badge } from "@essencia/ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { Progress } from "@essencia/ui/components/progress";

const STATUS_LABEL: Record<WorkflowExecucaoStatus, string> = {
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

interface ExecucaoCardProps {
  execucao: WorkflowExecucaoResumo;
}

export function ExecucaoCard({ execucao }: ExecucaoCardProps) {
  const progresso = Math.max(0, Math.min(100, execucao.progressoPercentual));

  return (
    <Card className="rounded-lg">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base leading-snug text-slate-950">
            {execucao.titulo}
          </CardTitle>
          <Badge variant={execucao.status === "CANCELADA" ? "outline" : "secondary"}>
            {STATUS_LABEL[execucao.status]}
          </Badge>
        </div>
        <p className="text-sm text-slate-600">{execucao.modelo.nome}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-slate-500">Fase atual</span>
          <span className="truncate font-medium text-slate-800">
            {execucao.faseAtual ?? "Sem fase ativa"}
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Progresso</span>
            <span>{progresso}%</span>
          </div>
          <Progress value={progresso} />
        </div>
      </CardContent>
    </Card>
  );
}
