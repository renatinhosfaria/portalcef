"use client";

import type {
  WorkflowCategoria,
  WorkflowModeloDetalhe,
} from "@essencia/shared/types/workflows";
import { Button } from "@essencia/ui/components/button";
import { AlertCircle, ArrowLeft, Info } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  WorkflowEditor,
  type WorkflowEditorPayload,
} from "@/components/workflow-editor";
import {
  atualizarModelo,
  buscarModelo,
  duplicarModelo,
  inativarModelo,
  listarCategorias,
  publicarModelo,
} from "@/lib/api";

const AVISO_MODELO_PUBLICADO =
  "Alteracoes em etapas publicadas podem reabrir etapas pendentes nas execucoes abertas.";

function obterModeloId(params: ReturnType<typeof useParams>) {
  const valor = params.modeloId;
  return Array.isArray(valor) ? valor[0] : valor;
}

export default function EditarModeloPage() {
  const params = useParams();
  const router = useRouter();
  const modeloId = useMemo(() => obterModeloId(params), [params]);
  const [categorias, setCategorias] = useState<WorkflowCategoria[]>([]);
  const [modelo, setModelo] = useState<WorkflowModeloDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    async function carregarDados() {
      if (!modeloId) {
        setErro("Modelo não informado.");
        setCarregando(false);
        return;
      }

      try {
        setCarregando(true);
        setErro(null);
        const [categoriasResultado, modeloResultado] = await Promise.all([
          listarCategorias(),
          buscarModelo(modeloId),
        ]);
        if (ativo) {
          setCategorias(categoriasResultado);
          setModelo(modeloResultado);
        }
      } catch (error) {
        if (ativo) {
          setErro(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar o modelo.",
          );
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregarDados();

    return () => {
      ativo = false;
    };
  }, [modeloId]);

  async function salvarModelo(payload: WorkflowEditorPayload) {
    if (!modeloId) return;

    const modeloAtualizado = await atualizarModelo(modeloId, payload);
    setModelo(modeloAtualizado);
  }

  async function publicar() {
    if (!modeloId) return;

    await publicarModelo(modeloId);
    const modeloPublicado = await buscarModelo(modeloId);
    setModelo(modeloPublicado);
  }

  async function inativar() {
    if (!modeloId) return;

    await inativarModelo(modeloId);
    const modeloInativo = await buscarModelo(modeloId);
    setModelo(modeloInativo);
  }

  async function duplicar() {
    if (!modeloId) return;

    const novoModelo = await duplicarModelo(modeloId);
    router.push(`/modelos/${novoModelo.id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {modelo ? modelo.nome : "Editar workflow"}
          </h1>
          <p className="text-sm text-slate-600">
            Edite orientações, fases e etapas do modelo.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </div>

      {modelo?.status === "PUBLICADO" ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <Info className="mt-0.5 h-4 w-4" />
          <span>{AVISO_MODELO_PUBLICADO}</span>
        </div>
      ) : null}

      {carregando ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Carregando modelo...
        </div>
      ) : erro ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span>{erro}</span>
        </div>
      ) : modelo ? (
        <WorkflowEditor
          categorias={categorias}
          modelo={modelo}
          onSalvar={salvarModelo}
          onPublicar={publicar}
          onInativar={inativar}
          onDuplicar={duplicar}
        />
      ) : null}
    </div>
  );
}
