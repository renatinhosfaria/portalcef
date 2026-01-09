"use client";

import { cn } from "@essencia/ui/lib/utils";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";

export type WizardStepStatus = "pending" | "current" | "completed";

export interface WizardStep {
  id: string;
  title: string;
  status: WizardStepStatus;
}

interface WizardStepperProps {
  steps: WizardStep[];
  className?: string;
}

const VISIBLE_STEPS = 6; // Número de etapas visíveis na janela

export function WizardStepper({ steps, className }: WizardStepperProps) {
  // Encontrar o índice do passo atual
  const currentIndex = steps.findIndex((s) => s.status === "current");

  // Fallback step para casos edge (nunca deveria acontecer, mas TypeScript requer)
  const fallbackStep: WizardStep = {
    id: "fallback",
    title: "Etapa",
    status: "current",
  };

  const currentStep = steps[currentIndex] ?? steps[0] ?? fallbackStep;

  // Calcular janela de etapas visíveis centrada no passo atual
  const { visibleSteps, startIndex, hasMore, hasLess } = useMemo(() => {
    if (steps.length <= VISIBLE_STEPS) {
      return {
        visibleSteps: steps,
        startIndex: 0,
        hasMore: false,
        hasLess: false,
      };
    }

    // Centralizar no passo atual
    let start = Math.max(0, currentIndex - Math.floor(VISIBLE_STEPS / 2));
    const end = Math.min(steps.length, start + VISIBLE_STEPS);

    // Ajustar se estiver no final
    if (end === steps.length) {
      start = Math.max(0, end - VISIBLE_STEPS);
    }

    return {
      visibleSteps: steps.slice(start, end),
      startIndex: start,
      hasMore: end < steps.length,
      hasLess: start > 0,
    };
  }, [steps, currentIndex]);

  return (
    <nav
      aria-label="Progresso do formulário"
      className={cn("w-full", className)}
    >
      {/* Desktop: Horizontal layout com janela deslizante */}
      <ol className="hidden sm:flex items-center justify-center gap-2">
        {/* Indicador de etapas anteriores */}
        {hasLess && (
          <li className="flex items-center text-muted-foreground mr-1">
            <ChevronLeft className="h-5 w-5" />
          </li>
        )}

        {visibleSteps.map((step, index) => {
          const actualStepNumber = startIndex + index + 1;
          return (
            <li
              key={step.id}
              className="flex items-center"
              aria-current={step.status === "current" ? "step" : undefined}
            >
              <StepIndicator step={step} stepNumber={actualStepNumber} />
              {index < visibleSteps.length - 1 && (
                <div
                  className={cn(
                    "w-8 lg:w-12 h-0.5 mx-1 transition-colors duration-300",
                    step.status === "completed"
                      ? "bg-secondary"
                      : "bg-muted-foreground/30",
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}

        {/* Indicador de etapas posteriores */}
        {hasMore && (
          <li className="flex items-center text-muted-foreground ml-1">
            <ChevronRight className="h-5 w-5" />
          </li>
        )}
      </ol>

      {/* Mobile: Apenas etapa atual com contador */}
      <div className="flex sm:hidden flex-col items-center gap-2">
        <StepIndicator step={currentStep} stepNumber={currentIndex + 1} />
        <span className="text-sm text-muted-foreground">
          {currentStep.title}
        </span>
      </div>
    </nav>
  );
}

interface StepIndicatorProps {
  step: WizardStep;
  stepNumber: number;
}

function StepIndicator({ step, stepNumber }: StepIndicatorProps) {
  const { status, title } = step;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors duration-300",
          status === "current" &&
            "border-primary bg-primary text-primary-foreground",
          status === "completed" &&
            "border-secondary bg-secondary text-secondary-foreground",
          status === "pending" &&
            "border-muted-foreground/50 bg-background text-muted-foreground",
        )}
      >
        {status === "completed" ? (
          <Check className="h-5 w-5" aria-hidden="true" />
        ) : (
          <span className="text-sm font-semibold">{stepNumber}</span>
        )}
      </div>
      {/* Title visible only on desktop */}
      <span
        className={cn(
          "hidden sm:block text-xs font-medium text-center max-w-[80px] transition-colors duration-300",
          status === "current"
            ? "text-primary"
            : status === "completed"
              ? "text-secondary"
              : "text-muted-foreground",
        )}
      >
        {title}
      </span>
    </div>
  );
}
