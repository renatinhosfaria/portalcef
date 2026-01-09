"use client";

import { CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";

export function ConclusaoStepForm({ defaultValues, onSubmit }: any) {
  const form = useForm({
    defaultValues: defaultValues,
  });

  return (
    <form
      id="wizard-step-form"
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
    >
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-6 rounded-full bg-green-100 p-4">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>
        <h2 className="mb-2 text-2xl font-bold tracking-tight">
          Plano de Aula de {defaultValues.materia || "Matéria"} Concluído!
        </h2>
        <p className="text-muted-foreground max-w-[500px]">
          Seu plano de aula foi salvo com sucesso e adicionado à sua lista de
          planejamentos desta quinzena.
        </p>
      </div>
    </form>
  );
}
