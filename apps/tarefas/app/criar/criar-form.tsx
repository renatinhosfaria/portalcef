"use client";

import { Button } from "@essencia/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@essencia/ui/components/card";
import { Input } from "@essencia/ui/components/input";
import { Label } from "@essencia/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@essencia/ui/components/select";
import { Textarea } from "@essencia/ui/components/textarea";
import { useState } from "react";

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

  const handleChange = (
    field: string,
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleContextChange = (
    field: string,
    value: string,
  ) => {
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
          <div>
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => handleChange("titulo", e.target.value)}
              placeholder="Ex: Revisar plano da Turma Infantil II"
              required
            />
          </div>

          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => handleChange("descricao", e.target.value)}
              placeholder="Detalhes adicionais sobre a tarefa"
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="prioridade">Prioridade *</Label>
            <Select
              value={formData.prioridade}
              onValueChange={(value) => handleChange("prioridade", value)}
            >
              <SelectTrigger id="prioridade">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALTA">Alta</SelectItem>
                <SelectItem value="MEDIA">Média</SelectItem>
                <SelectItem value="BAIXA">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="prazo">Prazo *</Label>
            <Input
              id="prazo"
              type="datetime-local"
              value={formData.prazo}
              onChange={(e) => handleChange("prazo", e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="responsavel">Responsável (UUID) *</Label>
            <Input
              id="responsavel"
              value={formData.responsavel}
              onChange={(e) => handleChange("responsavel", e.target.value)}
              placeholder="UUID do responsável"
              required
            />
            <p className="text-sm text-muted-foreground mt-1">
              TODO: Substituir por seletor de usuário
            </p>
          </div>

          <div>
            <Label htmlFor="quinzenaId">ID da Quinzena</Label>
            <Input
              id="quinzenaId"
              value={formData.contextos.quinzenaId}
              onChange={(e) => handleContextChange("quinzenaId", e.target.value)}
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
