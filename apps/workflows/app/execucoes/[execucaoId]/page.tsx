"use client";

import { useTenant } from "@essencia/shared/providers/tenant";
import type { WorkflowExecucaoDetalhe } from "@essencia/shared/types/workflows";
import { Button } from "@essencia/ui/components/button";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ExecucaoDetalhe } from "@/components/execucao-detalhe";
import {
  atualizarEtapa,
  buscarExecucao,
  cancelarExecucao,
  concluirExecucao,
  enviarAnexoExecucao,
  reabrirExecucao,
  removerAnexoExecucao,
} from "@/lib/api";
import { isGestaoWorkflow } from "@/lib/permissoes";

function obterExecucaoId(params: ReturnType<typeof useParams>) {
  const valor = params.execucaoId;
  return Array.isArray(valor) ? valor[0] : valor;
}

export default function ExecucaoPage() {
  const params = useParams();
  const { role, isLoaded } = useTenant();
  const execucaoId = useMemo(() => obterExecucaoId(params), [params]);
  const [execucao, setExecucao] = useState<WorkflowExecucaoDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const mutacaoEmAndamentoRef = useRef(false);

  const carregarExecucao = useCallback(async () => {
    if (!execucaoId) {
      setErro("Execução não informada.");
      setCarregando(false);
      return;
    }

    try {
      setCarregando(true);
      setErro(null);
      const resultado = await buscarExecucao(execucaoId);
      setExecucao(resultado);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar a execução.",
      );
    } finally {
      setCarregando(false);
    }
  }, [execucaoId]);

  useEffect(() => {
    if (!isLoaded) return;

    void carregarExecucao();
  }, [carregarExecucao, isLoaded]);

  async function executarComRecarregamento(acao: () => Promise<unknown>) {
    if (mutacaoEmAndamentoRef.current) {
      throw new Error("Aguarde a alteração em andamento terminar.");
    }

    mutacaoEmAndamentoRef.current = true;
    try {
      setSalvando(true);
      setErro(null);
      await acao();
      await carregarExecucao();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a alteração.",
      );
      throw error;
    } finally {
      mutacaoEmAndamentoRef.current = false;
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>

        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={carregando || salvando}
          onClick={() => void carregarExecucao()}
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {erro ? (
        <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{erro}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => void carregarExecucao()}
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      ) : null}

      {carregando ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Carregando execução...
        </div>
      ) : execucao ? (
        <ExecucaoDetalhe
          execucao={execucao}
          isGestao={isGestaoWorkflow(role ?? "")}
          carregando={salvando}
          onAtualizarEtapa={(id, etapaId, body) =>
            executarComRecarregamento(() => atualizarEtapa(id, etapaId, body))
          }
          onConcluir={(id) =>
            executarComRecarregamento(() => concluirExecucao(id))
          }
          onCancelar={(id, motivo) =>
            executarComRecarregamento(() => cancelarExecucao(id, motivo))
          }
          onReabrir={(id, motivo) =>
            executarComRecarregamento(() => reabrirExecucao(id, motivo))
          }
          onEnviarAnexo={(formData) =>
            executarComRecarregamento(() =>
              enviarAnexoExecucao(execucao.id, formData),
            )
          }
          onRemoverAnexo={(anexoId) =>
            executarComRecarregamento(() =>
              removerAnexoExecucao(execucao.id, anexoId),
            )
          }
        />
      ) : null}
    </div>
  );
}
