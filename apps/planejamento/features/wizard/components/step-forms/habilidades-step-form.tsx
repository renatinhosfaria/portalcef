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
import { habilidadesStepSchema } from "../../schemas";

export function HabilidadesStepForm({ defaultValues, onSubmit }: any) {
  const form = useForm({
    resolver: zodResolver(habilidadesStepSchema),
    defaultValues: defaultValues || { habilidades: "" },
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
          name="habilidades"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Quais as Habilidades/competências (currículo/BNCC)?
              </FormLabel>
              <FormControl>
                <Textarea
                  className="min-h-[150px]"
                  placeholder="Liste as habilidades..."
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
