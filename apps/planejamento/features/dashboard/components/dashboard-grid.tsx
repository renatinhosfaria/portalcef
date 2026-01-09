/**
 * DashboardGrid Component
 * Grid responsivo para lista de professores ordenado por urgência
 * Epic 5 - Story 5.1
 */

"use client";

import { getTrafficLightStatus, sortByUrgency } from "../utils/metrics";
import type { DashboardTeacher } from "../utils/types";
import { EmptyState } from "./empty-state";
import { TeacherStatusCard } from "./teacher-status-card";

interface DashboardGridProps {
  teachers: DashboardTeacher[];
  deadline: Date;
}

export function DashboardGrid({ teachers, deadline }: DashboardGridProps) {
  // Ordenar por urgência (vermelho primeiro)
  const sortedTeachers = sortByUrgency(teachers, deadline);

  // Se não houver professores, mostrar empty state
  if (sortedTeachers.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {sortedTeachers.map((teacher) => (
        <TeacherStatusCard
          key={teacher.id}
          teacher={teacher}
          trafficLightColor={getTrafficLightStatus(teacher, deadline)}
        />
      ))}
    </div>
  );
}
