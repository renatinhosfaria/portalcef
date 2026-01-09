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
import { conteudosStepSchema } from "../../schemas";

export function ConteudosStepForm({ defaultValues, onSubmit }: any) {
  const { correctText } = useSpellCheck();

  const form = useForm({
    resolver: zodResolver(conteudosStepSchema),
    defaultValues: defaultValues || { conteudos: "" },
  });

  const handleBlur = (fieldName: string) => {
    const currentValue = form.getValues(fieldName as "conteudos");
    if (currentValue) {
      const correctedValue = correctText(currentValue);
      if (correctedValue !== currentValue) {
        form.setValue(fieldName as "conteudos", correctedValue);
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
          name="conteudos"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quais os Conteúdos (o “assunto”)?</FormLabel>
              <FormControl>
                <Textarea
                  className="min-h-[150px]"
                  placeholder="Descreva os conteúdos..."
                  {...field}
                  onBlur={(e) => {
                    field.onBlur();
                    handleBlur("conteudos");
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
