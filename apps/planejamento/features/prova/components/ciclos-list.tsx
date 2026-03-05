import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { Badge } from "@essencia/ui/components/badge";
import { Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import type { ProvaCiclo } from "../types";

interface CiclosListProps {
  ciclos: ProvaCiclo[];
  etapa: string;
  onEdit: (ciclo: ProvaCiclo) => void;
  onDelete: (id: string) => void;
}

export function CiclosList({
  ciclos,
  etapa,
  onEdit,
  onDelete,
}: CiclosListProps) {
  const ciclosDaEtapa = ciclos.filter((c) => c.etapa === etapa);

  if (ciclosDaEtapa.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhuma Prova configurada para {etapa.replace("_", " ")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {ciclosDaEtapa.map((ciclo) => (
        <Card key={ciclo.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {ciclo.numero}a Prova
              {ciclo.provasVinculadas && ciclo.provasVinculadas > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {ciclo.provasVinculadas} professoras
                </Badge>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => onEdit(ciclo)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(ciclo.id)}
                disabled={
                  !!(ciclo.provasVinculadas && ciclo.provasVinculadas > 0)
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {ciclo.descricao && (
              <p className="text-sm text-muted-foreground mb-4">
                {ciclo.descricao}
              </p>
            )}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">Periodo:</span>
                <br />
                {format(new Date(ciclo.dataInicio), "dd/MM/yyyy", {
                  locale: ptBR,
                })}{" "}
                ate{" "}
                {format(new Date(ciclo.dataFim), "dd/MM/yyyy", {
                  locale: ptBR,
                })}
              </div>
              <div>
                <span className="font-medium">Prazo de Entrega:</span>
                <br />
                {format(new Date(ciclo.dataMaximaEntrega), "dd/MM/yyyy", {
                  locale: ptBR,
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
