"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@essencia/ui/components/form";
import { Textarea } from "@essencia/ui/components/textarea";
import { objetivosStepSchema, type ObjetivosStepData } from "../../schemas";

export interface ObjetivosStepFormProps {
  defaultValues?: Partial<ObjetivosStepData>;
  onSubmit: (data: ObjetivosStepData) => void;
}

/**
 * Formulário Passo 2: Objetivos de Aprendizagem
 * Textarea com placeholder pedagógico orientativo
 *
 * AC2: Exibe Textarea com label, placeholder pedagógico, validação min 20 chars
 */
export function ObjetivosStepForm({
  defaultValues,
  onSubmit,
}: ObjetivosStepFormProps) {
  const form = useForm<ObjetivosStepData>({
    resolver: zodResolver(objetivosStepSchema),
    mode: "onBlur", // Validação apenas ao sair do campo
    defaultValues: defaultValues || {
      objetivos: "",
    },
  });

  return (
    // @ts-expect-error - react-hook-form version conflict between packages
    <Form {...form}>
      <form id="wizard-step-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField<ObjetivosStepData>
          control={form.control as any}
          name="objetivos"
          render={({ field }: { field: any }) => (
            <FormItem>
              <FormLabel>Objetivos da Quinzena</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Descreva os objetivos de aprendizagem. Use verbos de ação (Ex: Compreender, Identificar, Desenvolver...)"
                  className="min-h-[120px]"
                  autoResize
                  aria-describedby="objetivos-error"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
