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
import { reforcoStepSchema } from "../../schemas";

export function ReforcoStepForm({ defaultValues, onSubmit }: any) {
  const form = useForm({
    resolver: zodResolver(reforcoStepSchema),
    defaultValues: defaultValues || { reforco: "" },
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
          name="reforco"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Quais as estratégias de reforço do conteudo?
              </FormLabel>
              <FormControl>
                <Textarea
                  className="min-h-[150px]"
                  placeholder="Descreva as estratégias de reforço..."
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
