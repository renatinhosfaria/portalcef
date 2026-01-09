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
import { recursosStepSchema } from "../../schemas";

export function RecursosStepForm({ defaultValues, onSubmit }: any) {
  const form = useForm({
    resolver: zodResolver(recursosStepSchema),
    defaultValues: defaultValues || { recursos: "" },
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
          name="recursos"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quais os Recursos e materiais?</FormLabel>
              <FormControl>
                <Textarea
                  className="min-h-[150px]"
                  placeholder="Liste os recursos..."
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
