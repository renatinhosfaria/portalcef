/**
 * PlanoAulaCard Component
 * Card de exibição de Plano de Aula para professoras
 * Baseado no design do QuinzenaCard
 */

"use client";

import { cn } from "@essencia/ui/lib/utils";
import { differenceInDays, format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Clock, FileText, Lock } from "lucide-react";
import Link from "next/link";

interface PlanoAulaCardProps {
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
  isLocked?: boolean;
}

type DeadlineStatus = "on-time" | "near" | "late";

function getDeadlineStatus(dataMaximaEntrega: string): DeadlineStatus {
  const dataMaxima = new Date(dataMaximaEntrega);
  const hoje = new Date();

  if (isPast(dataMaxima)) {
    return "late";
  }

  const diasRestantes = differenceInDays(dataMaxima, hoje);
  if (diasRestantes <= 3) {
    return "near";
  }

  return "on-time";
}

function getCardColorClass(
  deadlineStatus: DeadlineStatus,
  isCompleted: boolean,
  isLocked: boolean,
): string {
  if (isLocked) {
    return "border-slate-200 bg-slate-100/50";
  }

  if (isCompleted) {
    return "border-green-200 bg-green-50/50 hover:bg-green-50";
  }

  switch (deadlineStatus) {
    case "late":
      return "border-red-200 bg-red-50/50 hover:bg-red-50";
    case "near":
      return "border-yellow-200 bg-yellow-50/50 hover:bg-yellow-50";
    default:
      return "border-slate-200 bg-white hover:bg-slate-50";
  }
}

export function PlanoAulaCard({
  periodo,
  planoExistente,
  isLocked = false,
}: PlanoAulaCardProps) {
  const deadlineStatus = getDeadlineStatus(periodo.dataMaximaEntrega);
  const isCompleted = planoExistente?.status === "APROVADO";
  const colorClass = getCardColorClass(deadlineStatus, isCompleted, isLocked);

  const cardContent = (
    <div
      className={cn(
        "relative flex h-full flex-col justify-between rounded-xl border p-5 transition-all",
        colorClass,
        isLocked
          ? "cursor-not-allowed opacity-70"
          : "cursor-pointer hover:scale-[1.02] hover:shadow-md",
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <h3
              className={cn(
                "text-lg font-bold",
                isLocked && "text-muted-foreground",
              )}
            >
              {periodo.numero}º Plano de Aula
            </h3>
            <span
              className={cn(
                "text-sm font-medium",
                isLocked ? "text-muted-foreground" : "opacity-70",
              )}
            >
              ({format(new Date(periodo.dataInicio), "dd/MM", { locale: ptBR })}{" "}
              - {format(new Date(periodo.dataFim), "dd/MM", { locale: ptBR })})
            </span>
          </div>
          {periodo.descricao && (
            <p
              className={cn(
                "mt-1 text-sm line-clamp-1",
                isLocked ? "text-muted-foreground/70" : "text-muted-foreground",
              )}
            >
              {periodo.descricao}
            </p>
          )}
        </div>
        <div>
          {isLocked ? (
            <Lock className="h-5 w-5 text-muted-foreground" />
          ) : isCompleted ? (
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        {isLocked ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-3 w-3" />
              <span>Bloqueado</span>
            </div>
            <p className="text-xs text-muted-foreground/80">
              Aprove o plano anterior para liberar
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-3 w-3" />
              <span>
                Entrega:{" "}
                {format(new Date(periodo.dataMaximaEntrega), "dd/MM", {
                  locale: ptBR,
                })}
              </span>
            </div>
            {planoExistente && (
              <div className="mt-1 text-xs text-muted-foreground">
                Status: {planoExistente.status}
              </div>
            )}
          </>
        )}
      </div>

      {!isLocked && deadlineStatus === "late" && !isCompleted && (
        <div className="absolute -right-2 -top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
          Atrasado
        </div>
      )}

      {!isLocked && deadlineStatus === "near" && !isCompleted && (
        <div className="absolute -right-2 -top-2 rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
          Prazo próximo
        </div>
      )}
    </div>
  );

  if (isLocked) {
    return <div>{cardContent}</div>;
  }

  return <Link href={`/plano-aula/${periodo.id}`}>{cardContent}</Link>;
}
