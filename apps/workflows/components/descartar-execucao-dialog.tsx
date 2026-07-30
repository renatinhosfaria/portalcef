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
import { useEffect, useState } from "react";

interface DescartarExecucaoDialogProps {
  open: boolean;
  carregando?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmar: () => void | Promise<void>;
}

export function DescartarExecucaoDialog({
  open,
  carregando = false,
  onOpenChange,
  onConfirmar,
}: DescartarExecucaoDialogProps) {
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const bloqueado = carregando || confirmando;

  useEffect(() => {
    if (!open) {
      setErro(null);
      setConfirmando(false);
    }
  }, [open]);

  async function confirmar() {
    try {
      setErro(null);
      setConfirmando(true);
      await onConfirmar();
      onOpenChange(false);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível descartar a execução de teste.",
      );
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(proximoOpen) => {
        if (!bloqueado) onOpenChange(proximoOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Descartar execução de teste</DialogTitle>
          <DialogDescription>
            Esta ação remove definitivamente a execução de teste, seu checklist
            e seus anexos. O modelo não será alterado.
          </DialogDescription>
        </DialogHeader>

        {erro ? (
          <p className="text-sm text-red-600" role="alert">
            {erro}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={bloqueado}
            onClick={() => onOpenChange(false)}
          >
            Voltar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={bloqueado}
            onClick={() => void confirmar()}
          >
            {bloqueado ? "Descartando..." : "Confirmar descarte"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

