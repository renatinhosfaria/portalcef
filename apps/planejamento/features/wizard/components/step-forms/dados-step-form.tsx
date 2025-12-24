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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@essencia/ui/components/select";
import { dadosStepSchema, type DadosStepData } from "../../schemas";

/**
 * Dados mock de turmas (hardcoded provisoriamente)
 * Em stories futuras (Epic 1), virão do banco de dados
 */
const TURMAS = [
  "Infantil 3A",
  "Infantil 3B",
  "Infantil 4A",
  "Infantil 4B",
  "Fundamental 1A",
  "Fundamental 1B",
  "Fundamental 2A",
] as const;

/**
 * Dados mock de quinzenas (hardcoded provisoriamente)
 * Em stories futuras, virão do banco de dados com datas dinâmicas
 */
const QUINZENAS = [
  "1ª Quinzena - 03/02 a 14/02",
  "2ª Quinzena - 17/02 a 28/02",
  "3ª Quinzena - 03/03 a 14/03",
  "4ª Quinzena - 17/03 a 28/03",
  "5ª Quinzena - 01/04 a 12/04",
  "6ª Quinzena - 15/04 a 26/04",
  "7ª Quinzena - 29/04 a 10/05",
  "8ª Quinzena - 13/05 a 24/05",
] as const;

export interface DadosStepFormProps {
  defaultValues?: Partial<DadosStepData>;
  onSubmit: (data: DadosStepData) => void;
}

/**
 * Formulário Passo 1: Dados do Planejamento
 * Permite seleção de turma e quinzena
 *
 * AC1: Exibe campos obrigatórios de Turma e Quinzena com Select componentes
 */
export function DadosStepForm({ defaultValues, onSubmit }: DadosStepFormProps) {
  const form = useForm<DadosStepData>({
    resolver: zodResolver(dadosStepSchema),
    mode: "onBlur", // Validação apenas ao sair do campo (menos agressivo)
    defaultValues: defaultValues || {
      turma: "",
      quinzena: "",
    },
  });

  return (
    // @ts-expect-error - react-hook-form version conflict between packages
    <Form {...form}>
      <form id="wizard-step-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          {/* Campo Turma */}
          <FormField<DadosStepData>
            control={form.control as any}
            name="turma"
            render={({ field }: { field: any }) => (
              <FormItem>
                <FormLabel>Turma</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a turma" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TURMAS.map((turma) => (
                      <SelectItem key={turma} value={turma}>
                        {turma}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Campo Quinzena */}
          <FormField<DadosStepData>
            control={form.control as any}
            name="quinzena"
            render={({ field }: { field: any }) => (
              <FormItem>
                <FormLabel>Quinzena</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a quinzena" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {QUINZENAS.map((quinzena) => (
                      <SelectItem key={quinzena} value={quinzena}>
                        {quinzena}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}
