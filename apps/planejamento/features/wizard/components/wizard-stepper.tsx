"use client";

import { cn } from "@essencia/ui/lib/utils";
import { Check } from "lucide-react";

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

export function WizardStepper({ steps, className }: WizardStepperProps) {
  return (
    <nav
      aria-label="Progresso do formulário"
      className={cn("w-full", className)}
    >
      {/* Desktop: Horizontal layout */}
      <ol className="hidden sm:flex items-center justify-center gap-2">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className="flex items-center"
            aria-current={step.status === "current" ? "step" : undefined}
          >
            <StepIndicator step={step} stepNumber={index + 1} />
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-12 lg:w-16 h-0.5 mx-2 transition-colors duration-300",
                  step.status === "completed"
                    ? "bg-secondary"
                    : "bg-muted-foreground/30"
                )}
                aria-hidden="true"
              />
            )}
          </li>
        ))}
      </ol>

      {/* Mobile: Vertical layout */}
      <ol className="flex sm:hidden flex-col gap-3">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className="flex items-center gap-3"
            aria-current={step.status === "current" ? "step" : undefined}
          >
            <StepIndicator step={step} stepNumber={index + 1} />
            <span
              className={cn(
                "text-sm font-medium transition-colors duration-300",
                step.status === "current"
                  ? "text-primary"
                  : step.status === "completed"
                    ? "text-secondary"
                    : "text-muted-foreground"
              )}
            >
              {step.title}
            </span>
          </li>
        ))}
      </ol>
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
            "border-muted-foreground/50 bg-background text-muted-foreground"
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
              : "text-muted-foreground"
        )}
      >
        {title}
      </span>
    </div>
  );
}
