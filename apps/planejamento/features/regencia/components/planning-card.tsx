/**
 * PlanningCard Component
 * Card mobile-first para exibir informações do planejamento na lista
 * Epic 4 - Story 4.1: Lista de Planejamentos por Segmento
 */

"use client";

import { Card, CardContent } from "@essencia/ui/components/card";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronRight, Clock, User } from "lucide-react";
import Link from "next/link";

import {
  StatusBadge,
  type PlanningStatusType,
} from "../../../components/status-badge";

interface PlanningCardProps {
  id: string;
  professorName: string;
  turma: string;
  quinzena: string;
  status: PlanningStatusType;
  submittedAt: Date | null;
}

export function PlanningCard({
  id,
  professorName,
  turma,
  quinzena,
  status,
  submittedAt,
}: PlanningCardProps) {
  const formattedDate = submittedAt
    ? formatDistanceToNow(new Date(submittedAt), {
        addSuffix: true,
        locale: ptBR,
      })
    : "—";

  return (
    <Link href={`/regencia/${id}`}>
      <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            {/* Informações principais */}
            <div className="flex-1 min-w-0">
              {/* Header: Nome e Status */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium truncate">{professorName}</span>
                </div>
                <StatusBadge status={status} />
              </div>

              {/* Detalhes: Turma e Quinzena */}
              <div className="text-sm text-muted-foreground mb-1">
                <span className="font-medium">{turma}</span>
                <span className="mx-2">•</span>
                <span>{quinzena}</span>
              </div>

              {/* Data de Envio */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Enviado {formattedDate}</span>
              </div>
            </div>

            {/* Chevron indicator */}
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
