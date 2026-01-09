"use client";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@essencia/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@essencia/ui/components/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { DISCIPLINAS } from "../../constants";
import { materiaStepSchema } from "../../schemas";

export function MateriaStepForm({ defaultValues, onSubmit }: any) {
  const form = useForm({
    resolver: zodResolver(materiaStepSchema),
    defaultValues: {
      materia: "",
      ...defaultValues,
    },
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
          name="materia"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Qual a matéria?</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a matéria" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {DISCIPLINAS.map((disciplina) => (
                    <SelectItem key={disciplina} value={disciplina}>
                      {disciplina}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
