"use client";

import { Button } from "@essencia/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@essencia/ui/components/dialog";
import { Input } from "@essencia/ui/components/input";
import { Play } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { iniciarExecucao } from "@/lib/api";

interface IniciarExecucaoDialogProps {
  modeloId: string | null;
  modeloNome?: string;
  teste?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSucesso: (
    execucao: Awaited<ReturnType<typeof iniciarExecucao>>,
  ) => void | Promise<void>;
}

export function IniciarExecucaoDialog({
  modeloId,
  modeloNome,
  teste = false,
  open,
  onOpenChange,
  onSucesso,
}: IniciarExecucaoDialogProps) {
  const [titulo, setTitulo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setTitulo("");
    setErro(null);
  }, [modeloId, open]);

  function handleOpenChange(proximoOpen: boolean) {
    if (salvando && !proximoOpen) {
      return;
    }

    onOpenChange(proximoOpen);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!modeloId) return;

    const tituloNormalizado = titulo.trim();
    if (!tituloNormalizado) {
      setErro("Informe um título para iniciar a execução.");
      return;
    }

    try {
      setSalvando(true);
      setErro(null);
      const execucao = await iniciarExecucao(modeloId, {
        titulo: tituloNormalizado,
        ...(teste ? { teste: true } : {}),
      });
      setTitulo("");
      await onSucesso(execucao);
      onOpenChange(false);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar a execução.",
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {teste ? "Iniciar teste" : "Iniciar execução"}
          </DialogTitle>
          <DialogDescription>
            {teste && modeloNome
              ? `Defina um título para testar ${modeloNome}.`
              : modeloNome
              ? `Defina um título para ${modeloNome}.`
              : "Defina um título para a execução."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label
              htmlFor="titulo-execucao"
              className="text-sm font-medium text-slate-700"
            >
              Título
            </label>
            <Input
              id="titulo-execucao"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              placeholder="Ex.: Mostra cultural 2026"
              disabled={salvando}
            />
          </div>

          {erro ? <p className="text-sm text-red-600">{erro}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={salvando}
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando} className="gap-2">
              <Play className="h-4 w-4" />
              {salvando
                ? teste
                  ? "Iniciando teste..."
                  : "Iniciando..."
                : teste
                  ? "Iniciar teste"
                  : "Iniciar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
