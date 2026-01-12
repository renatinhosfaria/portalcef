"use client";

import { cn } from "@essencia/ui/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Clock, Lock } from "lucide-react";
import Link from "next/link";
import { getDeadlineColor } from "../utils";
import type { Quinzena } from "../types";

interface QuinzenaCardProps {
  quinzena: Quinzena;
}

export function QuinzenaCard({ quinzena }: QuinzenaCardProps) {
  const isLocked = quinzena.status === "locked";
  const colorClass = getDeadlineColor(quinzena.deadlineStatus, isLocked);

  const cardContent = (
    <div
      className={cn(
        "relative flex h-full flex-col justify-between rounded-xl border p-5 transition-all",
        colorClass,
        isLocked
          ? "cursor-not-allowed opacity-80"
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
              {quinzena.number}ª Quinzena
            </h3>
            <span
              className={cn(
                "text-sm font-medium",
                isLocked ? "text-muted-foreground" : "opacity-70",
              )}
            >
              ({format(quinzena.startDate, "dd/MM", { locale: ptBR })} -{" "}
              {format(quinzena.endDate, "dd/MM", { locale: ptBR })})
            </span>
          </div>
        </div>
        <div>
          {isLocked ? (
            <Lock className="h-5 w-5 text-muted-foreground" />
          ) : quinzena.status === "completed" ? (
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/50 backdrop-blur-sm">
              <span className="text-xs font-bold">{quinzena.number}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        {isLocked ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-3 w-3" />
            <span>Bloqueado</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-3 w-3" />
            <span>
              Entrega: {format(quinzena.deadline, "dd/MM", { locale: ptBR })}
            </span>
          </div>
        )}
      </div>

      {!isLocked && quinzena.deadlineStatus === "late" && (
        <div className="absolute -right-2 -top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
          Atrasado
        </div>
      )}
    </div>
  );

  if (isLocked) {
    return <div>{cardContent}</div>;
  }

  return <Link href={`/planejamentos/${quinzena.id}`}>{cardContent}</Link>;
}
