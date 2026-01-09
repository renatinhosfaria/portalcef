"use client";

import { AlertTriangle } from "lucide-react";

interface FeedbackAlertProps {
  comment: string;
  reviewerName: string;
  reviewedAt: Date;
}

/**
 * FeedbackAlert - Displays feedback from the coordinator when a planning is returned
 */
export function FeedbackAlert({
  comment,
  reviewerName,
  reviewedAt,
}: FeedbackAlertProps) {
  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(reviewedAt);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            Feedback da Coordenacao
          </p>
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300 whitespace-pre-wrap">
            &quot;{comment}&quot;
          </p>
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            - {reviewerName}, {formattedDate}
          </p>
        </div>
      </div>
    </div>
  );
}
