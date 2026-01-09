"use client";

import { Button } from "@essencia/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { submitPlanningComplete } from "../actions";
import { WIZARD_STEP_IDS, WIZARD_STEPS, type WizardStepId } from "../constants";
import { useAutoSave, useServerAutoSave } from "../hooks";
import type { PlanningFormData } from "../schemas";
import { DraftRecoveryDialog } from "./draft-recovery-dialog";
import {
  AnexosStepForm,
  AvaliacaoStepForm,
  ConclusaoStepForm,
  ConteudosStepForm,
  HabilidadesStepForm,
  MateriaStepForm,
  MetodologiaStepForm,
  ObjetivosStepForm,
  RecursosStepForm,
  ReforcoStepForm,
  ReviewStepForm,
  TemaStepForm,
} from "./step-forms";
import { WizardStepper, type WizardStep } from "./wizard-stepper";

interface WizardContainerProps {
  quinzenaId?: string;
}

export function WizardContainer({ quinzenaId }: WizardContainerProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Partial<PlanningFormData>>({});

  const [recoveryState, setRecoveryState] = useState<{
    isOpen: boolean;
    savedAt: Date;
    data: { formData: Partial<PlanningFormData>; currentStep: number };
  } | null>(null);

  const { clearDraft, loadDraft, saveNow } = useAutoSave({
    data: { formData, currentStep },
  });

  const { saveToServer, isSaving } = useServerAutoSave(formData);

  useEffect(() => {
    const draft = loadDraft();
    if (draft && draft.data) {
      setRecoveryState({
        isOpen: true,
        savedAt: draft.savedAt,
        data: draft.data,
      });
    }
  }, [loadDraft]);

  const handleRecover = useCallback(() => {
    if (recoveryState) {
      const { formData: savedFormData, currentStep: savedStep } =
        recoveryState.data;
      if (savedFormData) setFormData(savedFormData);
      if (typeof savedStep === "number") setCurrentStep(savedStep);
      setRecoveryState(null);
    }
  }, [recoveryState]);

  const handleDiscard = useCallback(() => {
    clearDraft();
    setRecoveryState(null);
  }, [clearDraft]);

  const handleStepSubmit = useCallback(
    async (data: Partial<PlanningFormData>) => {
      const updatedFormData = { ...formData, ...data };
      setFormData(updatedFormData);

      const isLastStep = currentStep === WIZARD_STEPS.length - 1;

      if (!isLastStep) {
        setCurrentStep((prev) => prev + 1);
        window.scrollTo(0, 0); // Scroll to top on step change
      } else {
        // Submit planning to server
        try {
          const result = await submitPlanningComplete(updatedFormData);
          if (result.success) {
            clearDraft(); // Clear local draft after successful submission
            setCurrentStep((prev) => prev + 1); // Move to conclusion step
            window.scrollTo(0, 0);
          } else {
            alert(result.error || "Erro ao enviar planejamento");
          }
        } catch (error) {
          console.error("Error submitting planning:", error);
          alert("Erro ao enviar planejamento. Tente novamente.");
        }
      }
    },
    [currentStep, formData, clearDraft],
  );

  const goPrev = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    window.scrollTo(0, 0);
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

  // Specific handling for the Conclusion step (usually doesn't need prev/next buttons in the same way)
  const isConclusionStep = currentStepData.id === WIZARD_STEP_IDS.CONCLUSAO;

  return (
    <div className="min-h-[calc(100vh-4rem)] pb-20 md:pb-8">
      <div className="mx-auto max-w-4xl p-6">
        {/* Header with Stepper */}
        {!isConclusionStep && (
          <header className="mb-8 overflow-x-auto pb-2">
            <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
              Novo Planejamento
            </h1>
            <WizardStepper steps={steps} />
          </header>
        )}

        {/* Content Area */}
        <main className="min-h-[400px] rounded-lg border bg-card p-6 shadow-sm">
          <StepContent
            stepId={currentStepData.id}
            formData={formData}
            onSubmit={handleStepSubmit}
            onBlur={saveNow}
          />
        </main>

        {/* Navigation Buttons */}
        {!isConclusionStep && (
          <footer className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={goPrev}
              disabled={isFirstStep}
              className="min-h-[44px] min-w-[120px]"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Anterior
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => saveToServer()}
                disabled={isSaving}
                className="min-h-[44px]"
              >
                {isSaving ? "Salvando..." : "Salvar Rascunho"}
              </Button>

              <span className="hidden text-sm text-muted-foreground sm:inline-block">
                Passo {currentStep + 1} de {WIZARD_STEPS.length}
              </span>

              <Button
                type="submit"
                form="wizard-step-form"
                className="min-h-[44px] min-w-[120px]"
              >
                {currentStepData.id === WIZARD_STEP_IDS.REVIEW
                  ? "Concluir"
                  : "Próximo"}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </footer>
        )}

        {isConclusionStep && (
          <div className="mt-6 flex justify-center">
            <Button onClick={() => router.back()} className="min-w-[200px]">
              Voltar para Planejamentos
            </Button>
          </div>
        )}
      </div>

      {recoveryState && (
        <DraftRecoveryDialog
          isOpen={recoveryState.isOpen}
          savedAt={recoveryState.savedAt}
          onRecover={handleRecover}
          onDiscard={handleDiscard}
        />
      )}
    </div>
  );
}

interface StepContentProps {
  stepId: WizardStepId;
  formData: Partial<PlanningFormData>;
  onSubmit: (data: Partial<PlanningFormData>) => void;
  onBlur?: () => void;
}

function StepContent({ stepId, formData, onSubmit, onBlur }: StepContentProps) {
  const commonProps = {
    onSubmit,
    onBlur,
  };

  // Helper to get default values for specific steps, fallback to empty string
  const dv = (key: keyof PlanningFormData) => formData[key];

  switch (stepId) {
    case WIZARD_STEP_IDS.MATERIA:
      return (
        <MateriaStepForm
          defaultValues={{ materia: dv("materia") }}
          {...commonProps}
        />
      );
    case WIZARD_STEP_IDS.TEMA:
      return (
        <TemaStepForm defaultValues={{ tema: dv("tema") }} {...commonProps} />
      );
    case WIZARD_STEP_IDS.OBJETIVOS:
      return (
        <ObjetivosStepForm
          defaultValues={{ objetivos: dv("objetivos") }}
          {...commonProps}
        />
      );
    case WIZARD_STEP_IDS.HABILIDADES:
      return (
        <HabilidadesStepForm
          defaultValues={{ habilidades: dv("habilidades") }}
          {...commonProps}
        />
      );
    case WIZARD_STEP_IDS.CONTEUDOS:
      return (
        <ConteudosStepForm
          defaultValues={{ conteudos: dv("conteudos") }}
          {...commonProps}
        />
      );
    case WIZARD_STEP_IDS.METODOLOGIA:
      return (
        <MetodologiaStepForm
          defaultValues={{ metodologia: dv("metodologia") }}
          {...commonProps}
        />
      );
    case WIZARD_STEP_IDS.RECURSOS:
      return (
        <RecursosStepForm
          defaultValues={{ recursos: dv("recursos") }}
          {...commonProps}
        />
      );
    case WIZARD_STEP_IDS.AVALIACAO:
      return (
        <AvaliacaoStepForm
          defaultValues={{ avaliacao: dv("avaliacao") }}
          {...commonProps}
        />
      );
    case WIZARD_STEP_IDS.REFORCO:
      return (
        <ReforcoStepForm
          defaultValues={{ reforco: dv("reforco") }}
          {...commonProps}
        />
      );
    case WIZARD_STEP_IDS.REVIEW:
      return <ReviewStepForm defaultValues={formData} {...commonProps} />;
    case WIZARD_STEP_IDS.ANEXOS:
      return <AnexosStepForm defaultValues={formData} {...commonProps} />;
    case WIZARD_STEP_IDS.CONCLUSAO:
      return <ConclusaoStepForm defaultValues={formData} {...commonProps} />;
    default:
      return <div>Passo desconhecido: {stepId}</div>;
  }
}
