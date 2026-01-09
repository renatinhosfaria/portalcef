/**
 * ApprovalControls Component
 * Controles de aprovação/ajustes para coordenação
 * Epic 4 - Story 4.3: Ação de Aprovar Planejamento
 * Epic 4 - Story 4.4: Ação de Solicitar Ajustes com Comentário
 */

"use client";

import { Button } from "@essencia/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@essencia/ui/components/dialog";
import { Textarea } from "@essencia/ui/components/textarea";
import { toast } from "@essencia/ui/components/toaster";
import { Check, Loader2, MessageSquareX } from "lucide-react";
import { useState, useTransition } from "react";

import type { PlanningStatusType } from "../../../components/status-badge";
import { approvePlanning, requestChanges } from "../actions";

interface ApprovalControlsProps {
  planningId: string;
  status: PlanningStatusType;
  onStatusChange?: () => void;
}

export function ApprovalControls({
  planningId,
  status,
  onStatusChange,
}: ApprovalControlsProps) {
  const [isPending, startTransition] = useTransition();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState("");

  // Só mostrar controles para planejamentos pendentes
  if (status !== "PENDENTE") {
    return null;
  }

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approvePlanning(planningId);

      if (result.success) {
        toast.success("Planejamento aprovado com sucesso!");
        onStatusChange?.();
      } else {
        toast.error(result.error || "Erro ao aprovar planejamento");
      }
    });
  };

  const handleRequestChanges = () => {
    // Validar comentário
    if (comment.trim().length < 10) {
      setCommentError("O comentário deve ter pelo menos 10 caracteres");
      return;
    }

    setCommentError("");

    startTransition(async () => {
      const result = await requestChanges(planningId, comment.trim());

      if (result.success) {
        toast.success("Solicitação de ajustes enviada com sucesso!");
        setIsDialogOpen(false);
        setComment("");
        onStatusChange?.();
      } else {
        toast.error(result.error || "Erro ao solicitar ajustes");
      }
    });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 p-4 bg-muted/50 rounded-lg mb-4">
      <p className="text-sm text-muted-foreground sm:flex-1">
        Revise o planejamento abaixo e tome uma decisão:
      </p>

      <div className="flex gap-2">
        {/* Botão Aprovar */}
        <Button
          variant="secondary"
          size="sm"
          onClick={handleApprove}
          disabled={isPending}
          className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Aprovar
        </Button>

        {/* Botão Solicitar Ajustes com Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              className="border-red-500 text-red-600 hover:bg-red-50 gap-1.5"
            >
              <MessageSquareX className="h-4 w-4" />
              Solicitar Ajustes
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Solicitar Ajustes</DialogTitle>
              <DialogDescription>
                Descreva o que precisa ser corrigido. Seu feedback será enviado
                para a professora.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Textarea
                placeholder="Descreva os ajustes necessários..."
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  if (e.target.value.length >= 10) {
                    setCommentError("");
                  }
                }}
                rows={5}
                className={commentError ? "border-red-500" : ""}
              />
              {commentError && (
                <p className="text-sm text-red-500">{commentError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Mínimo de 10 caracteres ({comment.length}/10)
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleRequestChanges}
                disabled={isPending || comment.trim().length < 10}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Enviar Correção
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
