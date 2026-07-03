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
import { Textarea } from "@essencia/ui/components/textarea";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

interface CancelarExecucaoDialogProps {
  open: boolean;
  titulo: string;
  descricao: string;
  rotuloConfirmacao: string;
  carregando?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmar: (motivo: string) => void | Promise<void>;
}

export function CancelarExecucaoDialog({
  open,
  titulo,
  descricao,
  rotuloConfirmacao,
  carregando = false,
  onOpenChange,
  onConfirmar,
}: CancelarExecucaoDialogProps) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setMotivo("");
      setErro(null);
    }
  }, [open]);

  function handleOpenChange(proximoOpen: boolean) {
    if (carregando && !proximoOpen) return;
    onOpenChange(proximoOpen);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const motivoNormalizado = motivo.trim();
    if (motivoNormalizado.length < 5) {
      setErro("Informe um motivo com pelo menos 5 caracteres.");
      return;
    }

    setErro(null);
    try {
      await onConfirmar(motivoNormalizado);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a ação.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label
              htmlFor="motivo-execucao"
              className="text-sm font-medium text-slate-700"
            >
              Motivo
            </label>
            <Textarea
              id="motivo-execucao"
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              placeholder="Descreva o motivo da ação."
              disabled={carregando}
            />
          </div>

          {erro ? <p className="text-sm text-red-600">{erro}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={carregando}
              onClick={() => handleOpenChange(false)}
            >
              Voltar
            </Button>
            <Button type="submit" variant="destructive" disabled={carregando}>
              {carregando ? "Enviando..." : rotuloConfirmacao}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
