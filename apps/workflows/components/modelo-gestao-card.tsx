import type {
  WorkflowModeloResumo,
  WorkflowModeloStatus,
} from "@essencia/shared/types/workflows";
import { Badge } from "@essencia/ui/components/badge";
import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { Pencil, Play } from "lucide-react";
import Link from "next/link";

const STATUS_LABEL: Record<WorkflowModeloStatus, string> = {
  RASCUNHO: "Rascunho",
  PUBLICADO: "Publicado",
  INATIVO: "Inativo",
};

interface ModeloGestaoCardProps {
  modelo: WorkflowModeloResumo;
  onIniciarTeste: (modelo: WorkflowModeloResumo) => void;
}

export function ModeloGestaoCard({
  modelo,
  onIniciarTeste,
}: ModeloGestaoCardProps) {
  return (
    <Card className="flex h-full flex-col rounded-lg">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="text-xs font-medium uppercase tracking-normal text-slate-500">
            {modelo.categoria.nome}
          </div>
          <Badge variant={modelo.status === "INATIVO" ? "outline" : "secondary"}>
            {STATUS_LABEL[modelo.status]}
          </Badge>
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
      <CardFooter className="flex flex-wrap gap-2">
        <Button asChild variant="outline" className="flex-1 gap-2">
          <Link
            href={`/modelos/${modelo.id}`}
            aria-label={`Editar ${modelo.nome}`}
          >
            <Pencil className="h-4 w-4" />
            Editar
          </Link>
        </Button>
        {modelo.status === "RASCUNHO" ? (
          <Button
            type="button"
            className="flex-1 gap-2"
            aria-label={`Iniciar teste de ${modelo.nome}`}
            onClick={() => onIniciarTeste(modelo)}
          >
            <Play className="h-4 w-4" />
            Iniciar teste
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}

