"use client";

import { useEffect, useState } from "react";

import { Button } from "@essencia/ui/components/button";
import { Textarea } from "@essencia/ui/components/textarea";
import { cn } from "@essencia/ui/lib/utils";
import { Loader2, MessageSquare, X } from "lucide-react";

import type { DocumentoComentario } from "../types";
import { DocumentoComentarios } from "./documento-comentarios";

interface DocumentoComentariosPanelProps {
  documentoId: string;
  documentoNome: string;
  comentarios: DocumentoComentario[];
  isOpen: boolean;
  onClose: () => void;
  onAddComentario: (comentario: string) => Promise<void>;
  loading?: boolean;
}

export function DocumentoComentariosPanel({
  documentoNome,
  comentarios,
  isOpen,
  onClose,
  onAddComentario,
  loading = false,
}: DocumentoComentariosPanelProps) {
  const [novoComentario, setNovoComentario] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoComentario.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddComentario(novoComentario.trim());
      setNovoComentario("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisabled =
    novoComentario.trim().length === 0 || isSubmitting || loading;

  return (
    <>
      {/* Backdrop (mobile) */}
      <div
        data-testid="comentarios-backdrop"
        className="fixed inset-0 bg-black/50 z-30 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        role="complementary"
        aria-label="Painel de comentários do documento"
        className={cn(
          "fixed top-[65px] bottom-0 right-0 z-40",
          "w-full sm:w-[350px] md:w-[400px]",
          "bg-background border-l shadow-2xl",
          "flex flex-col",
        )}
      >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <span className="font-semibold">Comentários</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar painel</span>
        </Button>
      </div>

      {/* Histórico */}
      <div className="flex-1 overflow-y-auto p-4">
        {comentarios.length > 0 ? (
          <DocumentoComentarios comentarios={comentarios} />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum comentário ainda
          </p>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t bg-muted/30">
        <div className="space-y-3">
          <Textarea
            placeholder="Digite seu comentário..."
            value={novoComentario}
            onChange={(e) => setNovoComentario(e.target.value)}
            rows={3}
            maxLength={1000}
            disabled={isSubmitting || loading}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {novoComentario.length}/1000
            </span>
            <Button type="submit" disabled={isDisabled}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Adicionar Comentário
            </Button>
          </div>
        </div>
      </form>
    </aside>
    </>
  );
}
