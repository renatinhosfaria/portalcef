"use client";

import { useForm } from "react-hook-form";

export function ReviewStepForm({ defaultValues, onSubmit }: any) {
  const form = useForm({
    defaultValues: defaultValues,
  });

  // Helper to render a field value
  const FieldReview = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-lg border p-4">
      <h4 className="mb-2 text-sm font-semibold text-muted-foreground">
        {label}
      </h4>
      <p className="whitespace-pre-wrap text-sm">{value || "Não informado"}</p>
    </div>
  );

  return (
    <form
      id="wizard-step-form"
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
    >
      <div className="grid gap-4">
        <h3 className="text-lg font-medium">Revisão do Planejamento</h3>

        <div className="grid gap-4 md:grid-cols-2">
          <FieldReview label="Matéria" value={defaultValues.materia} />
          <FieldReview label="Tema" value={defaultValues.tema} />
        </div>

        <FieldReview label="Objetivos" value={defaultValues.objetivos} />
        <FieldReview
          label="Habilidades (BNCC)"
          value={defaultValues.habilidades}
        />
        <FieldReview label="Conteúdos" value={defaultValues.conteudos} />
        <FieldReview label="Metodologia" value={defaultValues.metodologia} />
        <FieldReview label="Recursos" value={defaultValues.recursos} />
        <FieldReview label="Avaliação" value={defaultValues.avaliacao} />
        <FieldReview label="Reforço" value={defaultValues.reforco} />
      </div>
    </form>
  );
}
