/**
 * TeacherStatusCard Component
 * Card para exibir professor com indicador semafórico
 * Epic 5 - Story 5.1
 */

"use client";

import { Card, CardContent } from "@essencia/ui/components/card";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, GraduationCap, Users } from "lucide-react";

import {
  educationStageLabels,
  type EducationStageCode,
} from "@essencia/shared/types";
import type { DashboardTeacher, TrafficLightColor } from "../utils/types";
import { TrafficLightBadge } from "./traffic-light-badge";

interface TeacherStatusCardProps {
  teacher: DashboardTeacher;
  trafficLightColor: TrafficLightColor;
}

export function TeacherStatusCard({
  teacher,
  trafficLightColor,
}: TeacherStatusCardProps) {
  const formattedDate = teacher.updatedAt
    ? formatDistanceToNow(new Date(teacher.updatedAt), {
        addSuffix: true,
        locale: ptBR,
      })
    : "—";
  const stageLabel =
    teacher.segment === "SEM_ETAPA"
      ? "Sem etapa"
      : (educationStageLabels[teacher.segment as EducationStageCode] ??
        teacher.segment);

  return (
    <Card className="transition-all hover:shadow-md hover:border-primary/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Informações principais */}
          <div className="flex-1 min-w-0">
            {/* Header: Nome e Status */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <div className="flex items-center gap-1.5 min-w-0">
                <GraduationCap className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium truncate">{teacher.name}</span>
              </div>
              <TrafficLightBadge color={trafficLightColor} />
            </div>

            {/* Detalhes: Turma e Segmento */}
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
              <Users className="h-3 w-3" />
              <span className="font-medium">{teacher.turma}</span>
              <span className="mx-2">•</span>
              <span className="text-xs bg-muted px-2 py-0.5 rounded">
                {stageLabel}
              </span>
            </div>

            {/* Data de Atualização */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Atualizado {formattedDate}</span>
            </div>
          </div>

          {/* Indicador visual de status */}
          <div
            className={`h-12 w-1.5 rounded-full flex-shrink-0 ${
              trafficLightColor === "green"
                ? "bg-green-500"
                : trafficLightColor === "yellow"
                  ? "bg-yellow-500"
                  : trafficLightColor === "red"
                    ? "bg-red-500"
                    : "bg-gray-300"
            }`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
