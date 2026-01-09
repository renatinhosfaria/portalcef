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
import { useSpellCheck } from "../../hooks";
import { objetivosStepSchema } from "../../schemas";

export function ObjetivosStepForm({ defaultValues, onSubmit }: any) {
  const { correctText } = useSpellCheck();

  const form = useForm({
    resolver: zodResolver(objetivosStepSchema),
    defaultValues: defaultValues || { objetivos: "" },
  });

  const handleBlur = (fieldName: string) => {
    const currentValue = form.getValues(fieldName as "objetivos");
    if (currentValue) {
      const correctedValue = correctText(currentValue);
      if (correctedValue !== currentValue) {
        form.setValue(fieldName as "objetivos", correctedValue);
      }
    }
  };

  return (
    <Form {...form}>
      <form
        id="wizard-step-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="objetivos"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Qual o Objetivo de aprendizagem?</FormLabel>
              <FormControl>
                <Textarea
                  className="min-h-[150px]"
                  placeholder="Descreva os objetivos..."
                  {...field}
                  onBlur={(e) => {
                    field.onBlur();
                    handleBlur("objetivos");
                  }}
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
