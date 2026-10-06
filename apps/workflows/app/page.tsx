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
import { AlertCircle, FolderCog, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ExecucaoCard } from "@/components/execucao-card";
import { IniciarExecucaoDialog } from "@/components/iniciar-execucao-dialog";
import { WorkflowCard } from "@/components/workflow-card";
import {
  listarExecucoes,
  listarModelos,
  type ResultadoPaginado,
} from "@/lib/api";
import { isGestaoWorkflow } from "@/lib/permissoes";

type Aba = "biblioteca" | "andamento" | "concluidos" | "canceladas";

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

function Paginacao({
  resultado,
  onPagina,
}: {
  resultado: ResultadoPaginado<unknown>;
  onPagina: (pagina: number) => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
      <span>Página {resultado.pagina}</span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={resultado.pagina <= 1}
          onClick={() => onPagina(resultado.pagina - 1)}
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!resultado.temMais}
          onClick={() => onPagina(resultado.pagina + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}

export default function WorkflowsPage() {
  const { role, isLoaded } = useTenant();
  const [aba, setAba] = useState<Aba>("biblioteca");
  const [modelos, setModelos] =
    useState<ResultadoPaginado<WorkflowModeloResumo> | null>(null);
  const [execucoes, setExecucoes] =
    useState<ResultadoPaginado<WorkflowExecucaoResumo> | null>(null);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modeloSelecionado, setModeloSelecionado] =
    useState<WorkflowModeloResumo | null>(null);
  const requisicaoRef = useRef(0);
  const podeCriarModelo = isGestaoWorkflow(role ?? "");

  const carregarDados = useCallback(async () => {
    if (!isLoaded) return;
    const requisicao = ++requisicaoRef.current;
    try {
      setCarregando(true);
      setErro(null);
      if (aba === "biblioteca") {
        const resultado = await listarModelos({
          status: "PUBLICADO",
          pagina,
          limite: 20,
        });
        if (requisicao === requisicaoRef.current) setModelos(resultado);
      } else {
        const status =
          aba === "andamento"
            ? "EM_ANDAMENTO"
            : aba === "concluidos"
              ? "CONCLUIDA"
              : "CANCELADA";
        const resultado = await listarExecucoes({ status, pagina, limite: 20 });
        if (requisicao === requisicaoRef.current) setExecucoes(resultado);
      }
    } catch (error) {
      if (requisicao === requisicaoRef.current)
        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os workflows.",
        );
    } finally {
      if (requisicao === requisicaoRef.current) setCarregando(false);
    }
  }, [aba, isLoaded, pagina]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);
  const trocarAba = (valor: string) => {
    setAba(valor as Aba);
    setPagina(1);
  };

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
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="gap-2">
                <Link href="/modelos">
                  <FolderCog className="h-4 w-4" />
                  Gerenciar modelos
                </Link>
              </Button>
              <Button asChild className="gap-2">
                <Link href="/modelos/novo">
                  <Plus className="h-4 w-4" />
                  Novo workflow
                </Link>
              </Button>
            </div>
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
        <Tabs
          defaultValue="biblioteca"
          value={aba}
          onValueChange={trocarAba}
          className="w-full"
        >
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="biblioteca">Workflows</TabsTrigger>
            <TabsTrigger value="andamento">Em andamento</TabsTrigger>
            <TabsTrigger value="concluidos">Concluídos</TabsTrigger>
            <TabsTrigger value="canceladas">Canceladas</TabsTrigger>
          </TabsList>
          <TabsContent value={aba} className="pt-4">
            {carregando ? (
              <GridCarregando />
            ) : aba === "biblioteca" ? (
              modelos?.itens.length ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {modelos.itens.map((modelo) => (
                      <WorkflowCard
                        key={modelo.id}
                        modelo={modelo}
                        onIniciar={setModeloSelecionado}
                      />
                    ))}
                  </div>
                  <Paginacao resultado={modelos} onPagina={setPagina} />
                </>
              ) : (
                <EstadoVazio mensagem="Nenhum workflow publicado encontrado." />
              )
            ) : execucoes?.itens.length ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {execucoes.itens.map((execucao) => (
                    <ExecucaoCard key={execucao.id} execucao={execucao} />
                  ))}
                </div>
                <Paginacao resultado={execucoes} onPagina={setPagina} />
              </>
            ) : (
              <EstadoVazio
                mensagem={`Nenhuma execução ${aba === "andamento" ? "em andamento" : aba === "concluidos" ? "concluída" : "cancelada"}.`}
              />
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
