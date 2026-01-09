/**
 * KpiMetricCard Component
 * Card de KPI reutilizável com suporte a variants
 * Epic 5 - Story 5.2
 */

"use client";

import { Card, CardContent } from "@essencia/ui/components/card";
import { cn } from "@essencia/ui/lib/utils";
import type { LucideIcon } from "lucide-react";

interface KpiMetricCardProps {
  title: string;
  value: number | string;
  subtext?: string;
  variant?: "default" | "success" | "warning" | "destructive";
  icon: LucideIcon;
}

const variantStyles = {
  default: {
    card: "border-border",
    icon: "bg-muted text-muted-foreground",
    value: "text-foreground",
  },
  success: {
    card: "border-green-500/50 bg-green-50/50 dark:bg-green-950/20",
    icon: "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400",
    value: "text-green-600 dark:text-green-400",
  },
  warning: {
    card: "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20",
    icon: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400",
    value: "text-yellow-600 dark:text-yellow-400",
  },
  destructive: {
    card: "border-red-500/50 bg-red-50/50 dark:bg-red-950/20",
    icon: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400",
    value: "text-red-600 dark:text-red-400",
  },
};

export function KpiMetricCard({
  title,
  value,
  subtext,
  variant = "default",
  icon: Icon,
}: KpiMetricCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card className={cn("transition-all hover:shadow-md", styles.card)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-1">
              {title}
            </p>
            <p className={cn("text-2xl font-bold", styles.value)}>{value}</p>
            {subtext && (
              <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
            )}
          </div>
          <div className={cn("p-2 rounded-lg", styles.icon)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
