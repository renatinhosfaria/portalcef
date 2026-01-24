"use client";

import { Loader2 } from "lucide-react";

import type { PlanoDocumento } from "../types";

interface DocumentoPreviewProps {
  documento: PlanoDocumento;
}

/**
 * Componente de preview para documentos
 * Mostra PDF em iframe ou status de conversão
 */
export function DocumentoPreview({ documento }: DocumentoPreviewProps) {
  // Documento ainda está sendo convertido
  if (documento.previewStatus === "PENDENTE") {
    return (
      <div className="flex items-center justify-center p-8 bg-muted/50 rounded-lg">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm font-medium">Convertendo documento...</p>
          <p className="text-xs text-muted-foreground mt-1">
            Isso pode levar alguns segundos
          </p>
        </div>
      </div>
    );
  }

  // Erro na conversão
  if (documento.previewStatus === "ERRO") {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
        <p className="text-sm font-medium text-destructive">
          Erro ao converter documento
        </p>
        {documento.previewError && (
          <p className="text-xs text-destructive/80 mt-1">
            {documento.previewError}
          </p>
        )}
      </div>
    );
  }

  // Preview pronto
  if (documento.previewStatus === "PRONTO" && documento.previewUrl) {
    return (
      <div className="border rounded-lg overflow-hidden">
        <iframe
          src={documento.previewUrl}
          title="Preview do documento"
          className="w-full h-96"
        />
      </div>
    );
  }

  // PDF ou documento sem necessidade de conversão
  if (documento.mimeType === "application/pdf" && documento.url) {
    return (
      <div className="border rounded-lg overflow-hidden">
        <iframe
          src={documento.url}
          title="Preview do documento"
          className="w-full h-96"
        />
      </div>
    );
  }

  // Imagem
  if (documento.mimeType?.startsWith("image/") && documento.url) {
    return (
      <div className="border rounded-lg overflow-hidden bg-muted/50 p-4">
        <img
          src={documento.url}
          alt={documento.fileName || "Imagem"}
          className="max-w-full h-auto mx-auto"
        />
      </div>
    );
  }

  return null;
}
