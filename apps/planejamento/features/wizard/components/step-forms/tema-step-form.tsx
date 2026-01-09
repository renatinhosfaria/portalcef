"use client";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@essencia/ui/components/form";
import { Input } from "@essencia/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useSpellCheck } from "../../hooks";
import { temaStepSchema } from "../../schemas";

export function TemaStepForm({ defaultValues, onSubmit }: any) {
  const { correctText } = useSpellCheck();

  const form = useForm({
    resolver: zodResolver(temaStepSchema),
    defaultValues: defaultValues || { tema: "" },
  });

  const handleBlur = (fieldName: string) => {
    const currentValue = form.getValues(fieldName as "tema");
    if (currentValue) {
      const correctedValue = correctText(currentValue);
      if (correctedValue !== currentValue) {
        form.setValue(fieldName as "tema", correctedValue);
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
          name="tema"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Qual o tema?</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex: Operações Básicas..."
                  {...field}
                  onBlur={(e) => {
                    field.onBlur();
                    handleBlur("tema");
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
