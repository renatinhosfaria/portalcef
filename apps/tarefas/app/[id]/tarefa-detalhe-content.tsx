"use client";

import type { TarefaEnriquecida } from "@essencia/shared/types";
import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  Flag,
  Loader2,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCancelarTarefa } from "@/features/tarefa-detalhe/hooks/use-cancelar-tarefa";
import { useTarefa } from "@/features/tarefa-detalhe/hooks/use-tarefa";
import { apiPatch } from "@/lib/api";

const PRIORIDADE_LABELS: Record<TarefaEnriquecida["prioridade"], string> = {
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
};

const PRIORIDADE_CORES: Record<TarefaEnriquecida["prioridade"], string> = {
  ALTA: "text-red-600 bg-red-50 border-red-200",
  MEDIA: "text-yellow-600 bg-yellow-50 border-yellow-200",
  BAIXA: "text-green-600 bg-green-50 border-green-200",
};

const STATUS_LABELS: Record<TarefaEnriquecida["status"], string> = {
  PENDENTE: "Pendente",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

function formatarData(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  id: string;
}

export function TarefaDetalheContent({ id }: Props) {
  const router = useRouter();
  const { tarefa, isLoading, error, refetch } = useTarefa(id);
  const { cancelar, isLoading: cancelando } = useCancelarTarefa(id);
  const [concluindo, setConcluindo] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleConcluir = async () => {
    setConcluindo(true);
    setActionError(null);
    try {
      await apiPatch(`tarefas/${id}/concluir`);
      await refetch();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Erro ao concluir tarefa",
      );
    } finally {
      setConcluindo(false);
    }
  };

  const handleCancelar = async () => {
    setActionError(null);
    try {
      await cancelar();
      await refetch();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Erro ao cancelar tarefa",
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !tarefa) {
    return (
      <div className="space-y-4">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Link>
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error?.message ?? "Tarefa não encontrada"}</span>
        </div>
      </div>
    );
  }

  const isPendente = tarefa.status === "PENDENTE";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-xl">{tarefa.titulo}</CardTitle>
            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${PRIORIDADE_CORES[tarefa.prioridade]}`}
            >
              <Flag className="mr-1 inline h-3 w-3" />
              {PRIORIDADE_LABELS[tarefa.prioridade]}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Status: <strong>{STATUS_LABELS[tarefa.status]}</strong>
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {tarefa.descricao && (
            <p className="text-sm text-slate-700">{tarefa.descricao}</p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Prazo: {formatarData(tarefa.prazo)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Responsável: {tarefa.responsavelNome}</span>
            </div>
          </div>

          {tarefa.concluidaEm && (
            <p className="text-sm text-green-600">
              Concluída em: {formatarData(tarefa.concluidaEm)}
            </p>
          )}

          {actionError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {actionError}
            </div>
          )}

          {isPendente && (
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleConcluir}
                disabled={concluindo || cancelando}
                className="bg-[#A3D154] hover:bg-[#8ec33e] text-slate-900 font-bold gap-2"
              >
                {concluindo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Concluir
              </Button>
              <Button
                variant="outline"
                onClick={handleCancelar}
                disabled={concluindo || cancelando}
                className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
              >
                {cancelando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                Cancelar Tarefa
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
