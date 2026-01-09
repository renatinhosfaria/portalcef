/**
 * Dashboard Feature - Types
 * Epic 5 - Story 5.1
 */

export type PlanningStatusType =
  | "RASCUNHO"
  | "PENDENTE"
  | "APROVADO"
  | "EM_AJUSTE";
export type TrafficLightColor = "green" | "yellow" | "red" | "gray";

export interface DashboardTeacher {
  id: string;
  name: string;
  turma: string;
  segment: string;
  planningId: string | null;
  planningStatus: PlanningStatusType | null;
  submittedAt: Date | null;
  updatedAt: Date | null;
}

export interface DashboardMetrics {
  total: number;
  approved: number;
  approvedPct: number;
  pending: number;
  late: number;
}
