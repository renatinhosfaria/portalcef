/**
 * TrafficLightBadge Component
 * Badge semafórico para exibir status (verde/amarelo/vermelho)
 * Epic 5 - Story 5.1
 */

"use client";

import { Badge } from "@essencia/ui/components/badge";
import { cn } from "@essencia/ui/lib/utils";

import type { TrafficLightColor } from "../utils/types";

interface TrafficLightBadgeProps {
  color: TrafficLightColor;
  label?: string;
  className?: string;
}

const colorConfig: Record<
  TrafficLightColor,
  { label: string; className: string }
> = {
  green: {
    label: "Aprovado",
    className: "bg-green-600 hover:bg-green-600/90 text-white border-green-600",
  },
  yellow: {
    label: "Pendente",
    className:
      "bg-yellow-500 hover:bg-yellow-500/90 text-white border-yellow-500",
  },
  red: {
    label: "Atrasado",
    className: "bg-red-600 hover:bg-red-600/90 text-white border-red-600",
  },
  gray: {
    label: "Não Iniciado",
    className: "bg-gray-400 hover:bg-gray-400/90 text-white border-gray-400",
  },
};

export function TrafficLightBadge({
  color,
  label,
  className,
}: TrafficLightBadgeProps) {
  const config = colorConfig[color];

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {label || config.label}
    </Badge>
  );
}
