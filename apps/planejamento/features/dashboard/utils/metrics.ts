/**
 * Dashboard Feature - Metrics Utilities
 * Funções para cálculo de métricas e status semafórico
 * Epic 5 - Story 5.1, 5.2
 */

import type {
  DashboardMetrics,
  DashboardTeacher,
  TrafficLightColor,
} from "./types";

/**
 * Determina a cor do semáforo para um professor/planejamento
 * Story 5.1 - Lógica do Traffic Light
 */
export function getTrafficLightStatus(
  teacher: DashboardTeacher,
  deadline: Date,
): TrafficLightColor {
  const now = new Date();
  const isLate = now > deadline;

  // Sem planejamento
  if (!teacher.planningId || !teacher.planningStatus) {
    return isLate ? "red" : "gray";
  }

  // Aprovado = Verde
  if (teacher.planningStatus === "APROVADO") {
    return "green";
  }

  // Pendente ou Em Ajuste
  if (
    teacher.planningStatus === "PENDENTE" ||
    teacher.planningStatus === "EM_AJUSTE"
  ) {
    // Se passou do prazo = Vermelho (atrasado)
    if (isLate) {
      return "red";
    }
    // Dentro do prazo = Amarelo
    return "yellow";
  }

  // Rascunho
  if (teacher.planningStatus === "RASCUNHO") {
    return isLate ? "red" : "gray";
  }

  return "gray";
}

/**
 * Calcula urgency score para ordenação
 * Red = 3, Yellow = 2, Green = 1, Gray = 0
 */
export function getUrgencyScore(color: TrafficLightColor): number {
  switch (color) {
    case "red":
      return 3;
    case "yellow":
      return 2;
    case "green":
      return 1;
    default:
      return 0;
  }
}

/**
 * Ordena professores por urgência (vermelho primeiro, depois amarelo, depois verde)
 */
export function sortByUrgency(
  teachers: DashboardTeacher[],
  deadline: Date,
): DashboardTeacher[] {
  return [...teachers].sort((a, b) => {
    const scoreA = getUrgencyScore(getTrafficLightStatus(a, deadline));
    const scoreB = getUrgencyScore(getTrafficLightStatus(b, deadline));
    return scoreB - scoreA; // Descendente (mais urgente primeiro)
  });
}

/**
 * Calcula métricas consolidadas do dashboard
 * Story 5.2 - Garantir consistência com a lista
 */
export function calculateDashboardMetrics(
  teachers: DashboardTeacher[],
  deadline: Date,
): DashboardMetrics {
  const total = teachers.length;

  let approved = 0;
  let pending = 0;
  let late = 0;

  const now = new Date();
  const isLate = now > deadline;

  teachers.forEach((teacher) => {
    if (teacher.planningStatus === "APROVADO") {
      approved++;
    } else if (
      teacher.planningStatus === "PENDENTE" ||
      teacher.planningStatus === "EM_AJUSTE"
    ) {
      if (isLate) {
        late++;
      } else {
        pending++;
      }
    } else {
      // Sem planejamento ou RASCUNHO
      if (isLate) {
        late++;
      }
    }
  });

  // Evitar divisão por zero
  const approvedPct = total > 0 ? Math.round((approved / total) * 100) : 0;

  return {
    total,
    approved,
    approvedPct,
    pending,
    late,
  };
}
