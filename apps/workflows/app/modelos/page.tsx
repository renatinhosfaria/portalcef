"use client";

import { useTenant } from "@essencia/shared/providers/tenant";
import type {
  WorkflowCategoria,
  WorkflowModeloResumo,
  WorkflowModeloStatus,
} from "@essencia/shared/types/workflows";
import { Button } from "@essencia/ui/components/button";
import { Tabs, TabsList, TabsTrigger } from "@essencia/ui/components/tabs";
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
import { useCallback, useEffect, useRef, useState } from "react";

import { GerenciarCategoriasDialog } from "@/components/gerenciar-categorias-dialog";
import { IniciarExecucaoDialog } from "@/components/iniciar-execucao-dialog";
import { ModeloGestaoCard } from "@/components/modelo-gestao-card";
import {
  listarCategorias,
  listarModelos,
  type ResultadoPaginado,
} from "@/lib/api";
import { isGestaoWorkflow } from "@/lib/permissoes";

type FiltroModelo = WorkflowModeloStatus | "todos";

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

export default function ModelosPage() {
  const router = useRouter();
  const { role, isLoaded } = useTenant();
  const podeGerenciar = isGestaoWorkflow(role ?? "");
  const [resultado, setResultado] =
    useState<ResultadoPaginado<WorkflowModeloResumo> | null>(null);
  const [categorias, setCategorias] = useState<WorkflowCategoria[]>([]);
  const [filtro, setFiltro] = useState<FiltroModelo>("todos");
  const [busca, setBusca] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [pagina, setPagina] = useState(1);
  const [modeloTeste, setModeloTeste] = useState<WorkflowModeloResumo | null>(
    null,
  );
  const [categoriasAbertas, setCategoriasAbertas] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const requisicaoRef = useRef(0);

  const carregarDados = useCallback(async () => {
    if (!podeGerenciar) return;
    const requisicao = ++requisicaoRef.current;
    try {
      setCarregando(true);
      setErro(null);
      const status = filtro === "todos" ? "todos" : filtro;
      const modelosResultado = await listarModelos({
        status,
        pagina,
        limite: 20,
        busca: busca.trim() || undefined,
        categoriaId: categoriaId || undefined,
      });
      if (requisicao === requisicaoRef.current) setResultado(modelosResultado);
    } catch (error) {
      if (requisicao === requisicaoRef.current)
        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os modelos.",
        );
    } finally {
      if (requisicao === requisicaoRef.current) setCarregando(false);
    }
  }, [busca, categoriaId, filtro, pagina, podeGerenciar]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!podeGerenciar) {
      setCarregando(false);
      return;
    }
    void listarCategorias()
      .then(setCategorias)
      .catch(() => undefined);
  }, [isLoaded, podeGerenciar]);
  useEffect(() => {
    if (isLoaded) void carregarDados();
  }, [carregarDados, isLoaded]);

  const alterarFiltro = (valor: string) => {
    setFiltro(valor as FiltroModelo);
    setPagina(1);
  };
  const alterarBusca = (valor: string) => {
    setBusca(valor);
    setPagina(1);
  };
  const alterarCategoria = (valor: string) => {
    setCategoriaId(valor);
    setPagina(1);
  };

  if (!isLoaded || (carregando && !resultado))
    return (
      <div className="mx-auto w-full max-w-7xl rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Carregando modelos...
      </div>
    );
  if (!podeGerenciar)
    return (
      <div className="mx-auto w-full max-w-3xl rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-xl font-semibold text-amber-900">
          Acesso restrito
        </h1>
        <p className="mt-2 text-sm text-amber-800">
          Somente a gestão pode administrar modelos de workflows.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/">Voltar para workflows</Link>
        </Button>
      </div>
    );

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
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            aria-label="Buscar modelos"
            value={busca}
            onChange={(event) => alterarBusca(event.target.value)}
            placeholder="Buscar modelos..."
            className="h-10 rounded-md border border-slate-300 px-3 text-sm sm:max-w-sm"
          />
          <select
            aria-label="Filtrar por categoria"
            value={categoriaId}
            onChange={(event) => alterarCategoria(event.target.value)}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm"
          >
            <option value="">Todas as categorias</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </select>
        </div>
        <Tabs defaultValue="todos" value={filtro} onValueChange={alterarFiltro}>
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="RASCUNHO">Rascunhos</TabsTrigger>
            <TabsTrigger value="PUBLICADO">Publicados</TabsTrigger>
            <TabsTrigger value="INATIVO">Inativos</TabsTrigger>
          </TabsList>
        </Tabs>
        {carregando ? (
          <div className="py-10 text-center text-sm text-slate-500">
            Carregando modelos...
          </div>
        ) : resultado?.itens.length ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {resultado.itens.map((modelo) => (
                <ModeloGestaoCard
                  key={modelo.id}
                  modelo={modelo}
                  onIniciarTeste={setModeloTeste}
                />
              ))}
            </div>
            <Paginacao resultado={resultado} onPagina={setPagina} />
          </>
        ) : (
          <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-600">
            Nenhum modelo encontrado para este filtro.
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
