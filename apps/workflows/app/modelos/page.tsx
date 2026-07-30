"use client";

import { useTenant } from "@essencia/shared/providers/tenant";
import type {
  WorkflowCategoria,
  WorkflowModeloResumo,
  WorkflowModeloStatus,
} from "@essencia/shared/types/workflows";
import { Button } from "@essencia/ui/components/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@essencia/ui/components/tabs";
import {
  AlertCircle,
  ArrowLeft,
  FolderCog,
  Plus,
  RefreshCw,
  Tags,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { GerenciarCategoriasDialog } from "@/components/gerenciar-categorias-dialog";
import { IniciarExecucaoDialog } from "@/components/iniciar-execucao-dialog";
import { ModeloGestaoCard } from "@/components/modelo-gestao-card";
import { listarCategorias, listarModelos } from "@/lib/api";
import { isGestaoWorkflow } from "@/lib/permissoes";

type FiltroModelo = WorkflowModeloStatus | "todos";

function EstadoVazio() {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-600">
      Nenhum modelo encontrado para este filtro.
    </div>
  );
}

export default function ModelosPage() {
  const router = useRouter();
  const { role, isLoaded } = useTenant();
  const podeGerenciar = isGestaoWorkflow(role ?? "");
  const [modelos, setModelos] = useState<WorkflowModeloResumo[]>([]);
  const [categorias, setCategorias] = useState<WorkflowCategoria[]>([]);
  const [filtro, setFiltro] = useState<FiltroModelo>("todos");
  const [modeloTeste, setModeloTeste] =
    useState<WorkflowModeloResumo | null>(null);
  const [categoriasAbertas, setCategoriasAbertas] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregarDados = useCallback(async () => {
    if (!podeGerenciar) return;

    try {
      setCarregando(true);
      setErro(null);
      const [modelosResultado, categoriasResultado] = await Promise.all([
        listarModelos("status=todos"),
        listarCategorias(),
      ]);
      setModelos(modelosResultado);
      setCategorias(categoriasResultado);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os modelos.",
      );
    } finally {
      setCarregando(false);
    }
  }, [podeGerenciar]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!podeGerenciar) {
      setCarregando(false);
      return;
    }

    void carregarDados();
  }, [carregarDados, isLoaded, podeGerenciar]);

  const modelosFiltrados = useMemo(
    () =>
      filtro === "todos"
        ? modelos
        : modelos.filter((modelo) => modelo.status === filtro),
    [filtro, modelos],
  );

  if (!isLoaded || carregando) {
    return (
      <div className="mx-auto w-full max-w-7xl rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Carregando modelos...
      </div>
    );
  }

  if (!podeGerenciar) {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-xl font-semibold text-amber-900">Acesso restrito</h1>
        <p className="mt-2 text-sm text-amber-800">
          Somente a gestão pode administrar modelos de workflows.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/">Voltar para workflows</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Link>
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                <FolderCog className="h-6 w-6" />
                Gerenciar modelos
              </h1>
              <p className="text-sm text-slate-600">
                Acesse rascunhos, publicados e modelos inativos da unidade.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => setCategoriasAbertas(true)}
            >
              <Tags className="h-4 w-4" />
              Gerenciar categorias
            </Button>
            <Button asChild className="gap-2">
              <Link href="/modelos/novo">
                <Plus className="h-4 w-4" />
                Novo workflow
              </Link>
            </Button>
          </div>
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
              onClick={() => void carregarDados()}
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        ) : null}

        <Tabs
          defaultValue="todos"
          value={filtro}
          onValueChange={(value) => setFiltro(value as FiltroModelo)}
        >
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="RASCUNHO">Rascunhos</TabsTrigger>
            <TabsTrigger value="PUBLICADO">Publicados</TabsTrigger>
            <TabsTrigger value="INATIVO">Inativos</TabsTrigger>
          </TabsList>
        </Tabs>

        {modelosFiltrados.length === 0 ? (
          <EstadoVazio />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modelosFiltrados.map((modelo) => (
              <ModeloGestaoCard
                key={modelo.id}
                modelo={modelo}
                onIniciarTeste={setModeloTeste}
              />
            ))}
          </div>
        )}
      </div>

      <GerenciarCategoriasDialog
        open={categoriasAbertas}
        categorias={categorias}
        onOpenChange={setCategoriasAbertas}
        onCategoriasChange={setCategorias}
      />

      <IniciarExecucaoDialog
        modeloId={modeloTeste?.id ?? null}
        modeloNome={modeloTeste?.nome}
        teste
        open={modeloTeste !== null}
        onOpenChange={(open) => {
          if (!open) setModeloTeste(null);
        }}
        onSucesso={(execucao) => {
          router.push(`/execucoes/${execucao.id}`);
        }}
      />
    </>
  );
}
