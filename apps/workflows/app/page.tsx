"use client";

import { useTenant } from "@essencia/shared/providers/tenant";
import type {
  WorkflowExecucaoResumo,
  WorkflowModeloResumo,
} from "@essencia/shared/types/workflows";
import { Button } from "@essencia/ui/components/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@essencia/ui/components/tabs";
import { AlertCircle, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ExecucaoCard } from "@/components/execucao-card";
import { IniciarExecucaoDialog } from "@/components/iniciar-execucao-dialog";
import { WorkflowCard } from "@/components/workflow-card";
import { listarExecucoes, listarModelos } from "@/lib/api";
import { isGestaoWorkflow } from "@/lib/permissoes";

function EstadoVazio({ mensagem }: { mensagem: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-600">
      {mensagem}
    </div>
  );
}

function GridCarregando() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="h-44 animate-pulse rounded-lg border border-slate-200 bg-slate-100"
        />
      ))}
    </div>
  );
}

export default function WorkflowsPage() {
  const { role, isLoaded } = useTenant();
  const [modelos, setModelos] = useState<WorkflowModeloResumo[]>([]);
  const [execucoesAndamento, setExecucoesAndamento] = useState<
    WorkflowExecucaoResumo[]
  >([]);
  const [execucoesConcluidas, setExecucoesConcluidas] = useState<
    WorkflowExecucaoResumo[]
  >([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modeloSelecionado, setModeloSelecionado] =
    useState<WorkflowModeloResumo | null>(null);

  const podeCriarModelo = isGestaoWorkflow(role ?? "");

  const carregarDados = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);

      const [modelosPublicados, execucoesEmAndamento, execucoesFinalizadas] =
        await Promise.all([
          listarModelos("status=PUBLICADO"),
          listarExecucoes("status=EM_ANDAMENTO"),
          listarExecucoes("status=CONCLUIDA"),
        ]);

      setModelos(modelosPublicados);
      setExecucoesAndamento(execucoesEmAndamento);
      setExecucoesConcluidas(execucoesFinalizadas);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os workflows.",
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    void carregarDados();
  }, [carregarDados, isLoaded]);

  return (
    <>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Workflows</h1>
          <p className="text-sm text-slate-600">
            Protocolos internos, execuções, checklist e histórico da unidade.
          </p>
        </div>
        {podeCriarModelo ? (
          <Button className="gap-2" disabled>
            <Plus className="h-4 w-4" />
            Novo workflow
          </Button>
        ) : null}
      </div>

      {erro ? (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{erro}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => void carregarDados()}
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      ) : null}

      <Tabs defaultValue="biblioteca" className="w-full">
        <TabsList>
          <TabsTrigger value="biblioteca">Workflows</TabsTrigger>
          <TabsTrigger value="andamento">Em andamento</TabsTrigger>
          <TabsTrigger value="concluidos">Concluídos</TabsTrigger>
        </TabsList>
        <TabsContent value="biblioteca" className="pt-4">
          {carregando ? (
            <GridCarregando />
          ) : modelos.length === 0 ? (
            <EstadoVazio mensagem="Nenhum workflow publicado encontrado." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {modelos.map((modelo) => (
                <WorkflowCard
                  key={modelo.id}
                  modelo={modelo}
                  onIniciar={setModeloSelecionado}
                />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="andamento" className="pt-4">
          {carregando ? (
            <GridCarregando />
          ) : execucoesAndamento.length === 0 ? (
            <EstadoVazio mensagem="Nenhuma execução em andamento." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {execucoesAndamento.map((execucao) => (
                <ExecucaoCard key={execucao.id} execucao={execucao} />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="concluidos" className="pt-4">
          {carregando ? (
            <GridCarregando />
          ) : execucoesConcluidas.length === 0 ? (
            <EstadoVazio mensagem="Nenhuma execução concluída." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {execucoesConcluidas.map((execucao) => (
                <ExecucaoCard key={execucao.id} execucao={execucao} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>

      <IniciarExecucaoDialog
        modeloId={modeloSelecionado?.id ?? null}
        modeloNome={modeloSelecionado?.nome}
        open={modeloSelecionado !== null}
        onOpenChange={(open) => {
          if (!open) setModeloSelecionado(null);
        }}
        onSucesso={carregarDados}
      />
    </>
  );
}
