/**
 * PlanningList Component
 * Container da lista de planejamentos com loading e empty states
 * Epic 4 - Story 4.1: Lista de Planejamentos por Segmento
 */

"use client";

import { Card, CardContent } from "@essencia/ui/components/card";
import { Skeleton } from "@essencia/ui/components/skeleton";
import { FileX2 } from "lucide-react";

import type { PlanningStatusType } from "../../../components/status-badge";
import { PlanningCard } from "./planning-card";

export interface PlanningListItem {
  id: string;
  professorName: string;
  turma: string;
  quinzena: string;
  status: PlanningStatusType;
  submittedAt: Date | null;
}

interface PlanningListProps {
  plannings: PlanningListItem[];
  isLoading?: boolean;
}

export function PlanningList({ plannings, isLoading }: PlanningListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (plannings.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-12 text-center">
          <div className="mx-auto w-fit p-4 rounded-full bg-muted mb-4">
            <FileX2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            Nenhum planejamento encontrado
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Não há planejamentos pendentes de revisão no seu segmento. Quando
            professoras enviarem novos planejamentos, eles aparecerão aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {plannings.map((planning) => (
        <PlanningCard
          key={planning.id}
          id={planning.id}
          professorName={planning.professorName}
          turma={planning.turma}
          quinzena={planning.quinzena}
          status={planning.status}
          submittedAt={planning.submittedAt}
        />
      ))}
    </div>
  );
}
