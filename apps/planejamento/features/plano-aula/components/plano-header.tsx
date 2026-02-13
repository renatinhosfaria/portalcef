"use client";

/**
 * PlanoHeader - Cabecalho reutilizavel para visualizacao do Plano de Aula
 * Espelha o layout da tela da professora (page.tsx)
 */

import {
  Card,
  CardHeader,
} from "@essencia/ui/components/card";
import { Skeleton } from "@essencia/ui/components/skeleton";
import { Calendar, Clock, User } from "lucide-react";

import type { PlanoAulaStatus } from "../types";

import { PlanoStatusBadge } from "./status-badge";

interface PlanoHeaderProps {
  professorName: string;
  turmaName: string;
  turmaCode?: string;
  periodoNumero?: number;
  periodoDescricao?: string;
  periodoInicio?: string;
  periodoFim?: string;
  prazoEntrega?: string;
  etapaNome?: string;
  status: PlanoAulaStatus;
  submittedAt?: string;
  isLoadingPeriodo?: boolean;
}

/**
 * Formata uma data ISO para exibicao em pt-BR (dd/MM/yyyy)
 */
function formatarData(dataIso: string): string {
  return new Date(dataIso).toLocaleDateString("pt-BR");
}

/**
 * Formata o prazo de entrega em formato longo (ex: "20 de fevereiro de 2026")
 */
function formatarPrazo(dataIso: string): string {
  return new Date(dataIso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Formata a data de submissao
 */
function formatarDataSubmissao(data: string): string {
  return new Date(data).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PlanoHeader({
  professorName,
  turmaName,
  turmaCode,
  periodoNumero,
  periodoDescricao,
  periodoInicio,
  periodoFim,
  prazoEntrega,
  etapaNome,
  status,
  submittedAt,
  isLoadingPeriodo = false,
}: PlanoHeaderProps) {
  const titulo = periodoDescricao || (periodoNumero ? `${periodoNumero}º Plano de Aula` : null);
  const periodoDisplay =
    periodoInicio && periodoFim
      ? `${formatarData(periodoInicio)} - ${formatarData(periodoFim)}`
      : null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            {/* Titulo do Periodo */}
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                {isLoadingPeriodo ? (
                  <>
                    <Skeleton className="h-7 w-48 mb-1" />
                    <Skeleton className="h-4 w-36" />
                  </>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold tracking-tight">
                      {titulo || "Plano de Aula"}
                    </h1>
                    {periodoDisplay && (
                      <p className="text-sm text-muted-foreground">
                        {periodoDisplay}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Informacoes da Professora */}
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
                    <span className="text-muted-foreground ml-1">
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
                    {formatarDataSubmissao(submittedAt)}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Lado Direito: Prazo + Status */}
          <div className="flex flex-col gap-3 items-end">
            {/* Status Badge */}
            <PlanoStatusBadge status={status} className="text-sm" />

            {/* Prazo de Entrega */}
            {isLoadingPeriodo ? (
              <Skeleton className="h-14 w-40" />
            ) : (
              prazoEntrega && (
                <div className="rounded-md bg-muted px-4 py-2 text-sm">
                  <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Clock className="mr-1 inline h-3 w-3" />
                    Prazo de Entrega
                  </span>
                  <span className="font-medium text-foreground">
                    {formatarPrazo(prazoEntrega)}
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
