"use client";

import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { Input } from "@essencia/ui/components/input";
import { Label } from "@essencia/ui/components/label";
import { useState } from "react";

import { TarefaFormFields } from "@/features/criar-tarefa/components/tarefa-form-fields";
import { useCriarTarefa } from "@/features/criar-tarefa/hooks/use-criar-tarefa";

export function CriarTarefaForm() {
  const { criar, isLoading, error } = useCriarTarefa();

  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    prioridade: "MEDIA" as const,
    prazo: "",
    responsavel: "",
    contextos: {
      modulo: "planejamento",
      quinzenaId: "",
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await criar({
        ...formData,
        prioridade: formData.prioridade,
      });
    } catch (err) {
      // Error is already handled by the hook
      console.error("Erro ao criar tarefa:", err);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleContextChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      contextos: {
        ...prev.contextos,
        [field]: value,
      },
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova Tarefa</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <TarefaFormFields
            titulo={formData.titulo}
            descricao={formData.descricao}
            prioridade={formData.prioridade}
            prazo={formData.prazo}
            responsavel={formData.responsavel}
            onChange={handleChange}
          />

          <div>
            <Label htmlFor="quinzenaId">ID da Quinzena</Label>
            <Input
              id="quinzenaId"
              value={formData.contextos.quinzenaId}
              onChange={(e) =>
                handleContextChange("quinzenaId", e.target.value)
              }
              placeholder="UUID da quinzena (opcional)"
            />
          </div>

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
