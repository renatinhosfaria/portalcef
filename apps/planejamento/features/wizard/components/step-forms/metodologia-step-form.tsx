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
import { metodologiaStepSchema, type MetodologiaStepData } from "../../schemas";

export interface MetodologiaStepFormProps {
  defaultValues?: Partial<MetodologiaStepData>;
  onSubmit: (data: MetodologiaStepData) => void;
}

/**
 * Formulário Passo 3: Metodologia
 * Textarea com placeholder pedagógico orientativo
 *
 * AC3: Exibe Textarea com label, placeholder pedagógico, validação min 30 chars
 */
export function MetodologiaStepForm({
  defaultValues,
  onSubmit,
}: MetodologiaStepFormProps) {
  const form = useForm<MetodologiaStepData>({
    resolver: zodResolver(metodologiaStepSchema),
    mode: "onBlur", // Validação apenas ao sair do campo
    defaultValues: defaultValues || {
      metodologia: "",
    },
  });

  return (
    // @ts-expect-error - react-hook-form version conflict between packages
    <Form {...form}>
      <form id="wizard-step-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField<MetodologiaStepData>
          control={form.control as any}
          name="metodologia"
          render={({ field }: { field: any }) => (
            <FormItem>
              <FormLabel>Metodologia</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Descreva estratégias e atividades (Ex: Rodas de conversa, jogos lúdicos, experimentos...)"
                  className="min-h-[120px]"
                  autoResize
                  aria-describedby="metodologia-error"
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
