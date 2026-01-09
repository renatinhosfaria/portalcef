"use client";

import { Skeleton } from "@essencia/ui/components/skeleton";
import { useTenant } from "@essencia/shared/providers/tenant";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { getDashboardData, type DashboardDataResult } from "../server/queries";
import { calculateDashboardMetrics } from "../utils/metrics";
import type { DashboardMetrics, DashboardTeacher } from "../utils/types";
import { DashboardGrid } from "./dashboard-grid";
import { KpiSection } from "./kpi-section";
import { SegmentFilter } from "./segment-filter";

/**
 * GestaoPanel - Management Dashboard for directors and managers
 * Shows KPIs, traffic light status, and teacher list
 */
export function GestaoPanel() {
  const { role } = useTenant();
  const searchParams = useSearchParams();
  const stageFilter = searchParams.get("segment") || undefined;

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<{
    teachers: DashboardTeacher[];
    deadline: Date;
    currentQuinzena: string;
    metrics: DashboardMetrics;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if user can filter by stage (only directors and master)
  const canFilterSegments = role === "diretora_geral" || role === "master";

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const result: DashboardDataResult = await getDashboardData(stageFilter);

        if (!result.success || !result.data) {
          setError("Erro ao carregar dados do dashboard.");
          return;
        }

        const { teachers, deadline, currentQuinzena } = result.data;
        const metrics = calculateDashboardMetrics(teachers, new Date(deadline));

        setData({
          teachers,
          deadline: new Date(deadline),
          currentQuinzena,
          metrics,
        });
      } catch (err) {
        console.error("GestaoPanel error:", err);
        setError("Erro de conexao ao carregar dados.");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [stageFilter]);

  if (isLoading) {
    return <GestaoLoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Nenhum dado disponivel.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Painel de Gestao
          </h1>
          <p className="text-muted-foreground">
            Quinzena: {data.currentQuinzena} - Acompanhe o status dos
            planejamentos
          </p>
        </div>

        {/* Segment Filter (only for directors) */}
        {canFilterSegments && (
          <Suspense fallback={<Skeleton className="h-10 w-64" />}>
            <SegmentFilter />
          </Suspense>
        )}
      </div>

      {/* KPIs */}
      <KpiSection metrics={data.metrics} />

      {/* Teacher List */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Status por Professor</h2>
        <DashboardGrid teachers={data.teachers} deadline={data.deadline} />
      </div>
    </div>
  );
}

function GestaoLoadingSkeleton() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-64" />
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>

      {/* Teacher List */}
      <div>
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    </div>
  );
}
