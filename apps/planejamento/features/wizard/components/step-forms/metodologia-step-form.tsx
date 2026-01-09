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
import { metodologiaStepSchema } from "../../schemas";

export function MetodologiaStepForm({ defaultValues, onSubmit }: any) {
  const { correctText } = useSpellCheck();

  const form = useForm({
    resolver: zodResolver(metodologiaStepSchema),
    defaultValues: defaultValues || { metodologia: "" },
  });

  const handleBlur = (fieldName: string) => {
    const currentValue = form.getValues(fieldName as "metodologia");
    if (currentValue) {
      const correctedValue = correctText(currentValue);
      if (correctedValue !== currentValue) {
        form.setValue(fieldName as "metodologia", correctedValue);
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
          name="metodologia"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quais as Metodologia / estratégias?</FormLabel>
              <FormControl>
                <Textarea
                  className="min-h-[150px]"
                  placeholder="Descreva a metodologia..."
                  {...field}
                  onBlur={(e) => {
                    field.onBlur();
                    handleBlur("metodologia");
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
