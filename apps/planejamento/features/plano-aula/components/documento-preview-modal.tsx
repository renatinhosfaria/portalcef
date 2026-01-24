"use client";

import { Button } from "@essencia/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@essencia/ui/components/dialog";
import { Download, FileText, X } from "lucide-react";

import type { PlanoDocumento } from "../types";

interface DocumentoPreviewModalProps {
  documento: PlanoDocumento;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentoPreviewModal({
  documento,
  open,
  onOpenChange,
}: DocumentoPreviewModalProps) {
  const isPronto = documento.previewStatus === "PRONTO";
  const isErro = documento.previewStatus === "ERRO";
  const previewUrl = documento.previewUrl;

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
                Baixar Original (.{documento.fileName?.split(".").pop() || "docx"})
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
                    Você ainda pode baixar o arquivo original usando o botão acima.
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
