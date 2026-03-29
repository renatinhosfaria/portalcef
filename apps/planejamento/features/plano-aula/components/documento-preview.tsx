"use client";

import type { PlanoDocumento } from "../types";

interface DocumentoPreviewProps {
  documento: PlanoDocumento;
}

/**
 * Componente de preview para documentos
 * Mostra PDF em iframe ou imagem diretamente
 */
export function DocumentoPreview({ documento }: DocumentoPreviewProps) {
  // PDF nativo
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
