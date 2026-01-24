"use client";

/**
 * DocumentoList Component
 * Lista de documentos anexados ao plano de aula
 * Task 3.2: Criar componentes de upload e lista de documentos
 */

import { useState } from "react";

import { Button } from "@essencia/ui/components/button";
import { cn } from "@essencia/ui/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Image,
  Trash2,
  Youtube,
} from "lucide-react";

import type { PlanoDocumento } from "../types";
import { DocumentoComentarios } from "./documento-comentarios";
import { DocumentoPreview } from "./documento-preview";

interface DocumentoListProps {
  documentos: PlanoDocumento[];
  onDelete?: (docId: string) => void;
  showComments?: boolean;
  canDelete?: boolean;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "";

  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

function getFileIcon(documento: PlanoDocumento) {
  // Link do YouTube
  if (documento.tipo === "LINK_YOUTUBE") {
    return Youtube;
  }

  const mimeType = documento.mimeType;
  if (!mimeType) return FileText;

  // Imagem
  if (mimeType.startsWith("image/")) {
    return Image;
  }

  // Planilha
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("csv") ||
    mimeType.includes("ms-excel")
  ) {
    return FileSpreadsheet;
  }

  // Documento (PDF, Word, etc)
  return FileText;
}

function getFileTypeLabel(documento: PlanoDocumento): string {
  if (documento.tipo === "LINK_YOUTUBE") {
    return "YouTube";
  }

  const mimeType = documento.mimeType;
  if (!mimeType) return "Documento";

  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("word") || mimeType.includes("msword")) return "Word";
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("ms-excel")
  )
    return "Excel";
  if (mimeType.startsWith("image/png")) return "PNG";
  if (mimeType.startsWith("image/jpeg")) return "JPG";

  return "Documento";
}

function getDocumentUrl(documento: PlanoDocumento): string | undefined {
  if (documento.tipo === "LINK_YOUTUBE") {
    return documento.url;
  }
  // Para arquivos, a URL seria construida a partir do storageKey
  return documento.url;
}

function getDocumentName(documento: PlanoDocumento): string {
  if (documento.tipo === "LINK_YOUTUBE" && documento.url) {
    // Extrair ID do video do YouTube para exibicao
    const match = documento.url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/,
    );
    return match ? `Video YouTube: ${match[1]}` : "Video do YouTube";
  }
  return documento.fileName || "Documento sem nome";
}

export function DocumentoList({
  documentos,
  onDelete,
  showComments = false,
  canDelete = false,
}: DocumentoListProps) {
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());

  const togglePreview = (docId: string) => {
    setExpandedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  if (documentos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground font-medium">
          Nenhum documento anexado
        </p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Use os botoes acima para anexar arquivos ou links do YouTube
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documentos.map((documento) => {
        const Icon = getFileIcon(documento);
        const url = getDocumentUrl(documento);
        const name = getDocumentName(documento);
        const hasUnresolvedComments = documento.comentarios?.some(
          (c) => !c.resolved,
        );

        return (
          <div
            key={documento.id}
            className={cn(
              "rounded-lg border bg-card transition-colors",
              hasUnresolvedComments && "border-yellow-400 bg-yellow-50/50",
            )}
          >
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4 min-w-0">
                {/* Icon */}
                <div
                  className={cn(
                    "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg",
                    documento.tipo === "LINK_YOUTUBE"
                      ? "bg-red-100"
                      : "bg-primary/10",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      documento.tipo === "LINK_YOUTUBE"
                        ? "text-red-600"
                        : "text-primary",
                    )}
                  />
                </div>

                {/* File Info */}
                <div className="min-w-0 flex-1">
                  {/* File Name - Clickable */}
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium truncate hover:underline hover:text-primary flex items-center gap-1"
                      title={name}
                    >
                      <span className="truncate">{name}</span>
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  ) : (
                    <p className="font-medium truncate" title={name}>
                      {name}
                    </p>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="px-1.5 py-0.5 rounded bg-muted">
                      {getFileTypeLabel(documento)}
                    </span>
                    {documento.fileSize && (
                      <>
                        <span>*</span>
                        <span>{formatFileSize(documento.fileSize)}</span>
                      </>
                    )}
                    {hasUnresolvedComments && (
                      <>
                        <span>*</span>
                        <span className="text-yellow-600 font-medium">
                          Comentarios pendentes
                        </span>
                      </>
                    )}
                    {documento.previewStatus === "PENDENTE" && (
                      <>
                        <span>*</span>
                        <span className="text-blue-600 font-medium">
                          Convertendo...
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Preview Toggle Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => togglePreview(documento.id)}
                >
                  {expandedDocs.has(documento.id) ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Ocultar
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Ver Documento
                    </>
                  )}
                </Button>

                {/* Delete Button */}
                {canDelete && onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(documento.id)}
                  title="Excluir documento"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              </div>
            </div>

            {/* Preview Section */}
            {expandedDocs.has(documento.id) && (
              <div className="border-t px-4 py-3 bg-muted/20">
                <p className="text-xs text-muted-foreground mb-2 font-medium">
                  Visualização do Documento
                </p>
                <DocumentoPreview documento={documento} />
              </div>
            )}

            {/* Comments Section */}
            {showComments && documento.comentarios.length > 0 && (
              <div className="border-t px-4 py-3 bg-muted/30">
                <DocumentoComentarios comentarios={documento.comentarios} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
