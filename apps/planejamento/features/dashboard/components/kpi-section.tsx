/**
 * KpiSection Component
 * Seção com 4 KPIs do dashboard
 * Epic 5 - Story 5.2
 */

"use client";

import { AlertCircle, CheckCircle2, Clock, Users } from "lucide-react";

import type { DashboardMetrics } from "../utils/types";
import { KpiMetricCard } from "./kpi-metric-card";

interface KpiSectionProps {
  metrics: DashboardMetrics;
}

export function KpiSection({ metrics }: KpiSectionProps) {
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
      {/* Total de Professores */}
      <KpiMetricCard
        title="Total"
        value={metrics.total}
        subtext="professores"
        variant="default"
        icon={Users}
      />

      {/* Aprovados */}
      <KpiMetricCard
        title="Aprovados"
        value={metrics.approved}
        subtext={`${metrics.approvedPct}% do total`}
        variant="success"
        icon={CheckCircle2}
      />

      {/* Pendentes / Em Ajuste */}
      <KpiMetricCard
        title="Pendentes"
        value={metrics.pending}
        subtext="aguardando análise"
        variant="warning"
        icon={Clock}
      />

      {/* Atrasados - destaque vermelho se > 0 */}
      <KpiMetricCard
        title="Atrasados"
        value={metrics.late}
        subtext="fora do prazo"
        variant={metrics.late > 0 ? "destructive" : "default"}
        icon={AlertCircle}
      />
    </div>
  );
}
