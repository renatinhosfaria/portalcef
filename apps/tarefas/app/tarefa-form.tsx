"use client";

import type { Tarefa } from "@essencia/shared/types";
import { Button } from "@essencia/ui/components/button";
import { Input } from "@essencia/ui/components/input";
import { Label } from "@essencia/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@essencia/ui/components/select";
import { Sheet } from "@essencia/ui/components/sheet";
import { Textarea } from "@essencia/ui/components/textarea";
import {
  AlertCircle,
  Calendar,
  Check,
  FileText,
  Flag,
  Loader2,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiGet, apiPost } from "@/lib/api";

interface Usuario {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface TarefaFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TarefaForm({ isOpen, onClose }: TarefaFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [isLoadingUsuarios, setIsLoadingUsuarios] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();

    async function fetchUsuarios() {
      if (!isOpen) return;

      setIsLoadingUsuarios(true);
      try {
        const response = await apiGet<{ success: boolean; data: Usuario[] }>(
          "users"
        );
        if (!abortController.signal.aborted) {
          setUsuarios(response.data);
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error("Erro ao carregar usuários:", err);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoadingUsuarios(false);
        }
      }
    }

    fetchUsuarios();

    return () => {
      abortController.abort();
    };
  }, [isOpen]);

  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    prioridade: "MEDIA" as "ALTA" | "MEDIA" | "BAIXA",
    prazo: "",
    responsavel: "",
    contextos: {
      modulo: "planejamento",
      quinzenaId: "",
    },
  });

  const resetForm = () => {
    setFormData({
      titulo: "",
      descricao: "",
      prioridade: "MEDIA",
      prazo: "",
      responsavel: "",
      contextos: {
        modulo: "planejamento",
        quinzenaId: "",
      },
    });
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await apiPost<Tarefa>("tarefas", formData);
      setSuccess(true);
      router.refresh();

      setTimeout(() => {
        setSuccess(false);
        onClose();
        resetForm();
      }, 1000);
    } catch (err) {
      console.error("Erro ao criar tarefa:", err);
      setError(
        err instanceof Error ? err.message : "Erro ao criar tarefa. Tente novamente."
      );
    } finally {
      setIsLoading(false);
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

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Sheet isOpen={isOpen} onClose={handleClose} title="Nova Tarefa">
      <form onSubmit={handleSubmit} className="space-y-6 mt-6">
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            Tarefa criada com sucesso!
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="titulo">Título *</Label>
          <div className="relative">
            <FileText className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <Input
              id="titulo"
              placeholder="Ex: Revisar plano da Turma Infantil II"
              required
              className="pl-10"
              value={formData.titulo}
              onChange={(e) => handleChange("titulo", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="descricao">Descrição</Label>
          <Textarea
            id="descricao"
            value={formData.descricao}
            onChange={(e) => handleChange("descricao", e.target.value)}
            placeholder="Detalhes adicionais sobre a tarefa"
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prioridade">Prioridade *</Label>
          <div className="relative">
            <Flag className="absolute left-3 top-3 h-5 w-5 text-slate-400 z-10 pointer-events-none" />
            <Select
              value={formData.prioridade}
              onValueChange={(value) => handleChange("prioridade", value)}
            >
              <SelectTrigger id="prioridade" className="pl-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALTA">Alta</SelectItem>
                <SelectItem value="MEDIA">Média</SelectItem>
                <SelectItem value="BAIXA">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prazo">Prazo *</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <Input
              id="prazo"
              type="datetime-local"
              required
              className="pl-10"
              value={formData.prazo}
              onChange={(e) => handleChange("prazo", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="responsavel">Quem vai Executar *</Label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-5 w-5 text-slate-400 z-10 pointer-events-none" />
            <Select
              value={formData.responsavel}
              onValueChange={(value) => handleChange("responsavel", value)}
              disabled={isLoadingUsuarios}
            >
              <SelectTrigger id="responsavel" className="pl-10">
                <SelectValue
                  placeholder={
                    isLoadingUsuarios
                      ? "Carregando usuários..."
                      : "Selecione um usuário"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {usuarios.map((usuario) => (
                  <SelectItem key={usuario.id} value={usuario.id}>
                    {usuario.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quinzenaId">ID da Quinzena</Label>
          <Input
            id="quinzenaId"
            value={formData.contextos.quinzenaId}
            onChange={(e) => handleContextChange("quinzenaId", e.target.value)}
            placeholder="UUID da quinzena (opcional)"
          />
          <p className="text-xs text-slate-500">
            Vincule esta tarefa a uma quinzena específica (opcional)
          </p>
        </div>

        <div className="pt-4 flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            className="bg-[#A3D154] hover:bg-[#8ec33e] text-slate-900 font-bold min-w-[140px]"
            disabled={isLoading || success}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : success ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Criada!
              </>
            ) : (
              "Criar Tarefa"
            )}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
