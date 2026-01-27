"use client";

import { useState } from "react";

import { Button } from "@essencia/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@essencia/ui/components/dialog";
import { cn } from "@essencia/ui/lib/utils";
import { Download, FileText, MessageSquare, X } from "lucide-react";

import type { PlanoDocumento } from "../types";
import { DocumentoComentariosPanel } from "./documento-comentarios-panel";

interface DocumentoPreviewModalProps {
  documento: PlanoDocumento;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddComentario?: (documentoId: string, comentario: string) => Promise<void>;
  onEditComentario?: (comentarioId: string, novoTexto: string) => Promise<void>;
  onDeleteComentario?: (comentarioId: string) => Promise<void>;
  currentUserId?: string;
}

export function DocumentoPreviewModal({
  documento,
  open,
  onOpenChange,
  onAddComentario,
  onEditComentario,
  onDeleteComentario,
  currentUserId,
}: DocumentoPreviewModalProps) {
  const isPronto = documento.previewStatus === "PRONTO";
  const isErro = documento.previewStatus === "ERRO";
  const previewUrl = documento.previewUrl;

  const [comentarioPanelOpen, setComentarioPanelOpen] = useState(false);

  const unresolvedCount =
    documento.comentarios?.filter((c) => !c.resolved).length ?? 0;

  const handleAddComentario = async (comentario: string) => {
    if (onAddComentario) {
      await onAddComentario(documento.id, comentario);
    }
  };

  const handleDownloadPdf = () => {
    if (!previewUrl) return;

    const link = document.createElement("a");
    link.href = previewUrl;
    link.download =
      documento.fileName?.replace(/\.(docx?|odt)$/i, ".pdf") || "documento.pdf";
    link.click();
  };

  const handleDownloadOriginal = () => {
    if (!documento.url) return;

    const link = document.createElement("a");
    link.href = documento.url;
    link.download = documento.fileName || "documento";
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[100vw] w-screen h-screen max-h-screen p-0 gap-0"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">
          Preview do documento: {documento.fileName || "Documento"}
        </DialogTitle>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-background">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium truncate max-w-md">
                {documento.fileName || "Documento"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                disabled={!isPronto || !previewUrl}
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar PDF
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadOriginal}
                disabled={!documento.url}
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar Original (.
                {documento.fileName?.split(".").pop() || "docx"})
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4 mr-2" />
                Fechar
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden bg-muted/30">
            {isErro ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-8 max-w-md">
                  <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                    <FileText className="h-6 w-6 text-destructive" />
                  </div>
                  <p className="text-lg font-medium text-destructive">
                    Erro ao converter documento
                  </p>
                  {documento.previewError && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {documento.previewError}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-4">
                    Você ainda pode baixar o arquivo original usando o botão
                    acima.
                  </p>
                </div>
              </div>
            ) : isPronto && previewUrl ? (
              <iframe
                src={previewUrl}
                title="Preview do documento"
                className="w-full h-full border-0"
              />
            ) : documento.mimeType === "application/pdf" && documento.url ? (
              <iframe
                src={documento.url}
                title="Preview do documento"
                className="w-full h-full border-0"
              />
            ) : null}
          </div>

          {/* Botão Flutuante de Comentários */}
          <button
            type="button"
            aria-label={`Abrir comentários (${unresolvedCount} pendentes)`}
            aria-expanded={comentarioPanelOpen}
            aria-controls="comentarios-panel"
            onClick={() => setComentarioPanelOpen(true)}
            className={cn(
              "fixed bottom-4 right-4 md:bottom-6 md:right-6 z-30",
              "bg-primary text-primary-foreground",
              "rounded-full shadow-lg",
              "px-4 py-2 flex items-center gap-2",
              "transition-all hover:scale-110 hover:shadow-xl",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <MessageSquare className="h-5 w-5" />
            <span>Comentários</span>
            {unresolvedCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {unresolvedCount}
              </span>
            )}
          </button>

          {/* Painel de Comentários */}
          <DocumentoComentariosPanel
            documentoId={documento.id}
            documentoNome={documento.fileName || "Documento"}
            comentarios={documento.comentarios || []}
            isOpen={comentarioPanelOpen}
            onClose={() => setComentarioPanelOpen(false)}
            onAddComentario={handleAddComentario}
            onEditComentario={onEditComentario}
            onDeleteComentario={onDeleteComentario}
            currentUserId={currentUserId}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
