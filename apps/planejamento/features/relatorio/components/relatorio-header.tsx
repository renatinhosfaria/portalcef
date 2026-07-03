"use client";

/**
 * RelatorioHeader - Cabecalho reutilizavel para visualizacao do Relatorio
 * Segue o mesmo layout de capa usado em PlanoHeader.
 */

import {
  formatarData,
  formatarDataHoraLonga,
  formatarDataLonga,
} from "@essencia/shared/formatar-data";
import { Badge } from "@essencia/ui/components/badge";
import { Card, CardHeader } from "@essencia/ui/components/card";
import { Skeleton } from "@essencia/ui/components/skeleton";
import { cn } from "@essencia/ui/lib/utils";
import { Calendar, Clock, User } from "lucide-react";

import type { RelatorioStatus } from "../types";
import { STATUS_COLORS, STATUS_LABELS } from "../types";

interface RelatorioHeaderProps {
  professorName: string;
  turmaName: string;
  turmaCode?: string;
  semestreNumero?: number;
  semestreDescricao?: string | null;
  semestreInicio?: string;
  semestreFim?: string;
  prazoEntrega?: string | null;
  etapaNome?: string;
  status: RelatorioStatus;
  submittedAt?: string | null;
  isLoadingSemestre?: boolean;
}

function RelatorioStatusBadge({
  status,
  className,
}: {
  status: RelatorioStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(STATUS_COLORS[status], "border", className)}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function RelatorioHeader({
  professorName,
  turmaName,
  turmaCode,
  semestreNumero,
  semestreDescricao,
  semestreInicio,
  semestreFim,
  prazoEntrega,
  etapaNome,
  status,
  submittedAt,
  isLoadingSemestre = false,
}: RelatorioHeaderProps) {
  const titulo =
    semestreDescricao ||
    (semestreNumero ? `${semestreNumero}º Semestre` : null);
  const semestreDisplay =
    semestreInicio && semestreFim
      ? `${formatarData(semestreInicio)} - ${formatarData(semestreFim)}`
      : null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                {isLoadingSemestre ? (
                  <>
                    <Skeleton className="mb-1 h-7 w-48" />
                    <Skeleton className="h-4 w-36" />
                  </>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold tracking-tight">
                      {titulo || "Relatório"}
                    </h1>
                    {semestreDisplay && (
                      <p className="text-sm text-muted-foreground">
                        {semestreDisplay}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <p className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Professora:{" "}
                <span className="font-medium text-foreground">
                  {professorName}
                </span>
              </p>
              <p>
                Turma:{" "}
                <span className="font-medium text-foreground">
                  {turmaName}
                  {turmaCode && (
                    <span className="ml-1 text-muted-foreground">
                      ({turmaCode})
                    </span>
                  )}
                </span>
              </p>
              {etapaNome && (
                <p>
                  Etapa:{" "}
                  <span className="font-medium text-foreground">
                    {etapaNome}
                  </span>
                </p>
              )}
              {submittedAt && (
                <p className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Enviado em:{" "}
                  <span className="font-medium text-foreground">
                    {formatarDataHoraLonga(submittedAt)}
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            <RelatorioStatusBadge status={status} className="text-sm" />

            {isLoadingSemestre ? (
              <Skeleton className="h-14 w-40" />
            ) : (
              prazoEntrega && (
                <div className="rounded-md bg-muted px-4 py-2 text-sm">
                  <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Clock className="mr-1 inline h-3 w-3" />
                    Prazo de Entrega
                  </span>
                  <span className="font-medium text-foreground">
                    {formatarDataLonga(prazoEntrega)}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
