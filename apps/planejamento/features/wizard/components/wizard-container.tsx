"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@essencia/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WizardStepper, type WizardStep } from "./wizard-stepper";
import { WIZARD_STEPS, type WizardStepId, WIZARD_STEP_IDS } from "../constants";
import {
  DadosStepForm,
  ObjetivosStepForm,
  MetodologiaStepForm,
  RecursosStepForm,
} from "./step-forms";
import type { PlanningFormData } from "../schemas";

export function WizardContainer() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Partial<PlanningFormData>>({});

  const handleStepSubmit = useCallback(
    (data: Partial<PlanningFormData>) => {
      // Merge new data with existing form data
      setFormData((prev) => ({ ...prev, ...data }));
      // Advance to next step if not already at last step
      if (currentStep < WIZARD_STEPS.length - 1) {
        setCurrentStep((prev) => prev + 1);
      }
    },
    [currentStep]
  );

  const goPrev = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const steps: WizardStep[] = WIZARD_STEPS.map((step, index) => ({
    ...step,
    status:
      index < currentStep
        ? "completed"
        : index === currentStep
          ? "current"
          : "pending",
  }));

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;
  const currentStepData = WIZARD_STEPS[currentStep] ?? WIZARD_STEPS[0];

  return (
    <div className="min-h-[calc(100vh-4rem)] pb-20 md:pb-8">
      {/* Tunnel Focus Container */}
      <div className="mx-auto max-w-3xl p-6">
        {/* Header with Stepper */}
        <header className="mb-8">
          <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
            Novo Planejamento
          </h1>
          <WizardStepper steps={steps} />
        </header>

        {/* Content Area */}
        <main className="min-h-[400px] rounded-lg border bg-card p-6 shadow-sm">
          <StepContent
            stepId={currentStepData.id}
            formData={formData}
            onSubmit={handleStepSubmit}
          />
        </main>

        {/* Navigation Buttons */}
        <footer className="mt-6 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={isFirstStep}
            className="min-h-[44px] min-w-[120px]"
            aria-label="Voltar para o passo anterior"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Anterior
          </Button>

          <span className="text-sm text-muted-foreground">
            Passo {currentStep + 1} de {WIZARD_STEPS.length}
          </span>

          <Button
            type="submit"
            form="wizard-step-form"
            disabled={isLastStep}
            className="min-h-[44px] min-w-[120px]"
            aria-label="Avançar para o próximo passo"
          >
            Próximo
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </footer>
      </div>
    </div>
  );
}

interface StepContentProps {
  stepId: WizardStepId;
  formData: Partial<PlanningFormData>;
  onSubmit: (data: Partial<PlanningFormData>) => void;
}

function StepContent({
  stepId,
  formData,
  onSubmit,
}: StepContentProps) {

  switch (stepId) {
    case WIZARD_STEP_IDS.DADOS:
      return (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">
            Dados do Planejamento
          </h2>
          <p className="text-muted-foreground">
            Preencha as informações básicas do seu planejamento pedagógico.
          </p>
          <DadosStepForm
            defaultValues={{
              turma: formData.turma,
              quinzena: formData.quinzena,
            }}
            onSubmit={(data) => {
              onSubmit(data);
            }}
          />
        </div>
      );

    case WIZARD_STEP_IDS.OBJETIVOS:
      return (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">
            Objetivos de Aprendizagem
          </h2>
          <p className="text-muted-foreground">
            Defina os objetivos de aprendizagem alinhados à BNCC.
          </p>
          <ObjetivosStepForm
            defaultValues={{
              objetivos: formData.objetivos,
            }}
            onSubmit={(data) => {
              onSubmit(data);
            }}
          />
        </div>
      );

    case WIZARD_STEP_IDS.METODOLOGIA:
      return (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">
            Metodologia
          </h2>
          <p className="text-muted-foreground">
            Descreva a metodologia e as estratégias de ensino.
          </p>
          <MetodologiaStepForm
            defaultValues={{
              metodologia: formData.metodologia,
            }}
            onSubmit={(data) => {
              onSubmit(data);
            }}
          />
        </div>
      );

    case WIZARD_STEP_IDS.RECURSOS:
      return (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">
            Recursos Didáticos
          </h2>
          <p className="text-muted-foreground">
            Liste os recursos necessários para as atividades.
          </p>
          <RecursosStepForm
            defaultValues={{
              recursos: formData.recursos,
            }}
            onSubmit={(data) => {
              onSubmit(data);
            }}
          />
        </div>
      );

    default:
      return (
        <div className="space-y-4">
          <p className="text-muted-foreground">Passo desconhecido</p>
        </div>
      );
  }
}
