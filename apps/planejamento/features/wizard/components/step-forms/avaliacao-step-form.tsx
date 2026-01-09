"use client";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@essencia/ui/components/form";
import { Textarea } from "@essencia/ui/components/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { avaliacaoStepSchema } from "../../schemas";

export function AvaliacaoStepForm({ defaultValues, onSubmit }: any) {
  const form = useForm({
    resolver: zodResolver(avaliacaoStepSchema),
    defaultValues: defaultValues || { avaliacao: "" },
  });

  return (
    <Form {...form}>
      <form
        id="wizard-step-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="avaliacao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Qual o Critério de Avaliação (como saber se aprenderam)?
              </FormLabel>
              <FormControl>
                <Textarea
                  className="min-h-[150px]"
                  placeholder="Descreva os critérios de avaliação..."
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
