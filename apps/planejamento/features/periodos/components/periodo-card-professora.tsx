/**
 * PeriodoCardProfessora Component
 * Card de exibição de período para professoras
 * Mostra informações do período, prazo de entrega e status do plano
 */

"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { formatarData } from "@essencia/shared/formatar-data";
import { Button } from "@essencia/ui/components/button";
import { Badge } from "@essencia/ui/components/badge";
import { isPast, differenceInDays } from "date-fns";
import { useRouter } from "next/navigation";
import { cn } from "@essencia/ui/lib/utils";

interface PeriodoCardProfessoraProps {
  periodo: {
    id: string;
    numero: number;
    descricao?: string;
    dataInicio: string;
    dataFim: string;
    dataMaximaEntrega: string;
  };
  planoExistente?: {
    id: string;
    status: string;
  };
}

export function PeriodoCardProfessora({
  periodo,
  planoExistente,
}: PeriodoCardProfessoraProps) {
  const router = useRouter();
  const dataMaxima = new Date(periodo.dataMaximaEntrega);
  const prazoExpirado = isPast(dataMaxima);
  const diasRestantes = differenceInDays(dataMaxima, new Date());
  const prazoProximo = diasRestantes <= 3 && diasRestantes > 0;

  const handleClick = () => {
    router.push(`/plano-aula/${periodo.id}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {periodo.numero}º Plano de Aula
          {planoExistente && (
            <Badge variant="secondary">{planoExistente.status}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {periodo.descricao && (
          <p className="text-sm text-muted-foreground">{periodo.descricao}</p>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Período:</span>
            <br />
            {formatarData(periodo.dataInicio)}{" "}
            até{" "}
            {formatarData(periodo.dataFim)}
          </div>
          <div>
            <span className="font-medium">Prazo de Entrega:</span>
            <br />
            <div className="flex items-center gap-2">
              {formatarData(dataMaxima)}
              {prazoProximo && (
                <Badge
                  variant="default"
                  className={cn(
                    "bg-yellow-500 hover:bg-yellow-500/90 text-white border-yellow-500",
                  )}
                >
                  Prazo próximo
                </Badge>
              )}
              {prazoExpirado && (
                <Badge variant="destructive">Prazo expirado</Badge>
              )}
            </div>
          </div>
        </div>

        {planoExistente && (
          <div className="text-sm">
            <span className="font-medium">Status:</span> {planoExistente.status}
          </div>
        )}

        <Button onClick={handleClick} className="w-full">
          {planoExistente ? "Continuar Plano" : "Iniciar Plano de Aula"}
        </Button>
      </CardContent>
    </Card>
  );
}
