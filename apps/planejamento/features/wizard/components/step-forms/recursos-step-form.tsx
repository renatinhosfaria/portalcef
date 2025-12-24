"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@essencia/ui/components/form";
import { Input } from "@essencia/ui/components/input";
import { Button } from "@essencia/ui/components/button";
import { recursosStepSchema, type RecursosStepData } from "../../schemas";
import { useState } from "react";

export interface RecursosStepFormProps {
  defaultValues?: Partial<RecursosStepData>;
  onSubmit: (data: RecursosStepData) => void;
}

/**
 * Formulário Passo 4: Recursos e Atividades
 * Lista dinâmica de itens com botão adicionar/remover
 *
 * AC4: Exibe Input + botão Adicionar, lista de itens com botão Remover
 * Validação: array min 1 item
 */
export function RecursosStepForm({
  defaultValues,
  onSubmit,
}: RecursosStepFormProps) {
  const [newItem, setNewItem] = useState("");

  const form = useForm<RecursosStepData>({
    resolver: zodResolver(recursosStepSchema),
    mode: "onBlur",
    defaultValues: defaultValues || {
      recursos: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control as any,
    name: "recursos",
  });

  /**
   * Adiciona um novo recurso à lista após validar que não está vazio.
   * Limpa o input após adicionar o item com sucesso.
   */
  const handleAddItem = () => {
    if (newItem.trim()) {
      append(newItem.trim());
      setNewItem("");
    }
  };

  /**
   * Permite adicionar recurso pressionando Enter no input.
   * Previne o comportamento padrão de submeter o formulário.
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem();
    }
  };

  return (
    // @ts-expect-error - react-hook-form version conflict between packages
    <Form {...form}>
      <form id="wizard-step-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormItem>
          <FormLabel>Recursos e Atividades</FormLabel>

          {/* Input + Botão Adicionar */}
          <div className="flex gap-2">
            <Input
              placeholder="Digite um recurso ou atividade"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={handleAddItem}
              disabled={!newItem.trim()}
              className="min-w-[100px]"
            >
              <Plus className="mr-1 h-4 w-4" />
              Adicionar
            </Button>
          </div>

          {/* Lista de Itens */}
          {fields.length > 0 && (
            <div className="mt-4 space-y-2">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex items-center gap-2 rounded-md border bg-card p-3"
                >
                  <span className="flex-1 text-sm">{form.watch(`recursos.${index}`)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                    aria-label={`Remover ${form.watch(`recursos.${index}`)}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Mensagem de erro se lista vazia */}
          {form.formState.errors.recursos && (
            <p className="text-sm font-medium text-destructive">
              {form.formState.errors.recursos.message}
            </p>
          )}
        </FormItem>
      </form>
    </Form>
  );
}
