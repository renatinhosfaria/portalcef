"use client";

import type { WorkflowCategoria } from "@essencia/shared/types/workflows";
import { Button } from "@essencia/ui/components/button";
import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  WorkflowEditor,
  type WorkflowEditorPayload,
} from "@/components/workflow-editor";
import { criarModelo, listarCategorias } from "@/lib/api";

export default function NovoModeloPage() {
  const router = useRouter();
  const [categorias, setCategorias] = useState<WorkflowCategoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    async function carregarCategorias() {
      try {
        setCarregando(true);
        setErro(null);
        const resultado = await listarCategorias();
        if (ativo) setCategorias(resultado);
      } catch (error) {
        if (ativo) {
          setErro(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar as categorias.",
          );
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregarCategorias();

    return () => {
      ativo = false;
    };
  }, []);

  async function salvarModelo(payload: WorkflowEditorPayload) {
    const modelo = await criarModelo(payload);
    router.push(`/modelos/${modelo.id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo workflow</h1>
          <p className="text-sm text-slate-600">
            Monte um modelo reutilizável para a unidade.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </div>

      {carregando ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Carregando categorias...
        </div>
      ) : erro ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span>{erro}</span>
        </div>
      ) : (
        <WorkflowEditor categorias={categorias} onSalvar={salvarModelo} />
      )}
    </div>
  );
}
