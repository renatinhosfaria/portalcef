"use client";

import { useTenant } from "@essencia/shared/providers/tenant";
import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { useState } from "react";

import { useCriarTarefa } from "@/features/criar-tarefa/hooks/use-criar-tarefa";
import {
  TarefaFormFields,
  type TarefaFormData,
} from "@/features/criar-tarefa/components/tarefa-form-fields";

export function CriarTarefaForm() {
  const session = useTenant();
  const { criar, isLoading, error } = useCriarTarefa();
  const bloqueadoProfessora = session.role === "professora";

  const [formData, setFormData] = useState<TarefaFormData>({
    titulo: "",
    descricao: "",
    prioridade: "MEDIA",
    prazo: "",
    responsavel: bloqueadoProfessora ? session.userId : "",
    responsavelNome: bloqueadoProfessora ? session.name || "Você" : "",
    quinzenaId: "",
  });

  const handleChange = (field: keyof TarefaFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await criar({
        titulo: formData.titulo,
        descricao: formData.descricao,
        prioridade: formData.prioridade,
        prazo: new Date(formData.prazo).toISOString(),
        responsavel: formData.responsavel,
        contextos: formData.quinzenaId
          ? [
              {
                modulo: "PLANEJAMENTO" as const,
                quinzenaId: formData.quinzenaId,
              },
            ]
          : [],
      });
    } catch (err) {
      console.error("Erro ao criar tarefa:", err);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova Tarefa</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <TarefaFormFields
            data={formData}
            onChange={handleChange}
            roleAtual={session.role}
            bloqueadoProfessora={bloqueadoProfessora}
          />
          {error && (
            <div className="text-sm text-destructive">
              Erro ao criar tarefa: {error.message}
            </div>
          )}
          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Criando..." : "Criar Tarefa"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.history.back()}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
