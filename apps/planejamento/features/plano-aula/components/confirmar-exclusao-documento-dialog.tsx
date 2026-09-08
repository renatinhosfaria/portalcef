"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@essencia/ui/components/alert-dialog";
import { Textarea } from "@essencia/ui/components/textarea";
import { AlertCircle, Trash2 } from "lucide-react";
import { useEffect, useId, useState, type MouseEvent } from "react";

import { obterMensagemErroExclusao } from "../../../lib/mensagens-erro";

const MINIMO_MOTIVO_EXCLUSAO = 10;
const MENSAGEM_MOTIVO_INVALIDO =
  "Informe o motivo da exclusão com pelo menos 10 caracteres.";
const MENSAGEM_FALHA_EXCLUSAO =
  "Não foi possível excluir o arquivo agora. Tente novamente.";

interface ConfirmarExclusaoDocumentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentoId: string;
  nomeArquivo: string;
  onConfirmar: (documentoId: string, motivo: string) => Promise<void>;
}

export function ConfirmarExclusaoDocumentoDialog({
  open,
  onOpenChange,
  documentoId,
  nomeArquivo,
  onConfirmar,
}: ConfirmarExclusaoDocumentoDialogProps) {
  const id = useId().replace(/:/g, "");
  const motivoId = `motivo-exclusao-documento-${id}`;
  const ajudaId = `${motivoId}-ajuda`;
  const erroId = `${motivoId}-erro`;
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!open) {
      setMotivo("");
      setErro(null);
      setCarregando(false);
    }
  }, [open]);

  const handleConfirmar = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    const motivoNormalizado = motivo.trim();
    if (motivoNormalizado.length < MINIMO_MOTIVO_EXCLUSAO) {
      setErro(MENSAGEM_MOTIVO_INVALIDO);
      return;
    }

    setErro(null);
    setCarregando(true);

    try {
      await onConfirmar(documentoId, motivoNormalizado);
      onOpenChange(false);
    } catch (error) {
      setErro(obterMensagemErroExclusao(error, MENSAGEM_FALHA_EXCLUSAO));
    } finally {
      setCarregando(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(novoEstado) => {
        if (!carregando) onOpenChange(novoEstado);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar exclusão do arquivo</AlertDialogTitle>
          <AlertDialogDescription>
            Confirma a exclusão do arquivo <strong>{nomeArquivo}</strong>? Esta
            ação não poderá ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-2 py-2">
          <label htmlFor={motivoId} className="text-sm font-medium">
            Motivo da exclusão <span className="text-destructive">*</span>
          </label>
          <Textarea
            id={motivoId}
            value={motivo}
            onChange={(event) => {
              setMotivo(event.target.value);
              if (erro) setErro(null);
            }}
            placeholder="Ex.: arquivo enviado com conteúdo incorreto"
            disabled={carregando}
            minLength={MINIMO_MOTIVO_EXCLUSAO}
            rows={4}
            required
            aria-required="true"
            aria-invalid={!!erro}
            aria-describedby={erro ? erroId : ajudaId}
          />
          <p id={ajudaId} className="text-xs text-muted-foreground">
            Informe pelo menos 10 caracteres para registrar o motivo.
          </p>
          {erro && (
            <p
              id={erroId}
              role="alert"
              className="flex items-start gap-2 text-sm text-destructive"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{erro}</span>
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={carregando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleConfirmar}
            disabled={
              carregando || motivo.trim().length < MINIMO_MOTIVO_EXCLUSAO
            }
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {carregando ? "Excluindo arquivo..." : "Excluir arquivo"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
