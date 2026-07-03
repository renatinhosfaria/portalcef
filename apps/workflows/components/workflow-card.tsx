import type { WorkflowModeloResumo } from "@essencia/shared/types/workflows";
import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { Play } from "lucide-react";

interface WorkflowCardProps {
  modelo: WorkflowModeloResumo;
  onIniciar: (modelo: WorkflowModeloResumo) => void;
}

export function WorkflowCard({ modelo, onIniciar }: WorkflowCardProps) {
  return (
    <Card className="flex h-full flex-col rounded-lg">
      <CardHeader className="space-y-2 pb-3">
        <div className="text-xs font-medium uppercase tracking-normal text-slate-500">
          {modelo.categoria.nome}
        </div>
        <CardTitle className="text-base leading-snug text-slate-950">
          {modelo.nome}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        <p className="line-clamp-3 text-sm text-slate-600">
          {modelo.descricaoCurta}
        </p>
      </CardContent>
      <CardFooter>
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => onIniciar(modelo)}
        >
          <Play className="h-4 w-4" />
          Iniciar
        </Button>
      </CardFooter>
    </Card>
  );
}
