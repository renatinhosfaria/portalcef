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
  CheckCircle,
  Eye,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Image,
  Printer,
  Trash2,
  Undo2,
  Youtube,
} from "lucide-react";

import type { PlanoDocumento } from "../types";
import { DocumentoComentarios } from "./documento-comentarios";
import { DocumentoPreviewModal } from "./documento-preview-modal";

interface DocumentoListProps {
  documentos: PlanoDocumento[];
  onDelete?: (docId: string) => void;
  onAddComentario?: (documentoId: string, comentario: string) => Promise<void>;
  onEditComentario?: (comentarioId: string, novoTexto: string) => Promise<void>;
  onDeleteComentario?: (comentarioId: string) => Promise<void>;
  onAprovar?: (docId: string) => Promise<void>;
  onDesaprovar?: (docId: string) => Promise<void>;
  onImprimir?: (docId: string) => Promise<void>;
  showComments?: boolean;
  canDelete?: boolean;
  canAprovar?: boolean;
  currentUserId?: string;
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

function getDocumentPdfUrl(documento: PlanoDocumento): string | null {
  // PDF nativo
  if (documento.mimeType === "application/pdf" && documento.url) {
    return documento.url;
  }

  // Preview convertido para PDF
  if (documento.previewStatus === "PRONTO" && documento.previewUrl) {
    return documento.previewUrl;
  }

  return null;
}

function imprimirPdf(url: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = url;

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  document.body.appendChild(iframe);
  setTimeout(() => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }, 60_000);
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
  onAddComentario,
  onEditComentario,
  onDeleteComentario,
  onAprovar,
  onDesaprovar,
  onImprimir,
  showComments = false,
  canDelete = false,
  canAprovar = false,
  currentUserId,
}: DocumentoListProps) {
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const [aprovandoId, setAprovandoId] = useState<string | null>(null);
  const [imprimindoId, setImprimindoId] = useState<string | null>(null);
  const [desaprovandoId, setDesaprovandoId] = useState<string | null>(null);

  const handleAprovar = async (docId: string) => {
    if (!onAprovar) return;
    try {
      setAprovandoId(docId);
      await onAprovar(docId);
    } catch (error) {
      console.error("Erro ao aprovar documento:", error);
    } finally {
      setAprovandoId(null);
    }
  };

  const handleDesaprovar = async (docId: string) => {
    if (!onDesaprovar) return;
    try {
      setDesaprovandoId(docId);
      await onDesaprovar(docId);
    } catch (error) {
      console.error("Erro ao desfazer aprovação:", error);
    } finally {
      setDesaprovandoId(null);
    }
  };

  const handleImprimir = async (documento: PlanoDocumento) => {
    if (!onImprimir) return;

    const pdfUrl = getDocumentPdfUrl(documento);
    if (!pdfUrl) return;

    try {
      setImprimindoId(documento.id);
      imprimirPdf(pdfUrl);
      await onImprimir(documento.id);
    } catch (error) {
      console.error("Erro ao imprimir documento:", error);
    } finally {
      setImprimindoId(null);
    }
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
        const pdfUrl = getDocumentPdfUrl(documento);
        const name = getDocumentName(documento);
        const hasUnresolvedComments = documento.comentarios?.some(
          (c) => !c.resolved,
        );
        const podeImprimir =
          !!documento.approvedAt && !!documento.approvedBy && !!onImprimir;

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
                    {documento.createdAt && (
                      <>
                        <span>*</span>
                        <span title="Data de envio">
                          {new Date(documento.createdAt).toLocaleString(
                            "pt-BR",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
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
                    {documento.approvedBy && documento.approvedAt && (
                      <>
                        <span>*</span>
                        <span className="text-green-600 font-medium">
                          Aprovado
                        </span>
                      </>
                    )}
                    {documento.printedAt && (
                      <>
                        <span>*</span>
                        <span className="text-indigo-600 font-medium">
                          Impresso em{" "}
                          {new Date(documento.printedAt).toLocaleString(
                            "pt-BR",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Preview Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setOpenDocId(documento.id)}
                  disabled={documento.previewStatus === "PENDENTE"}
                >
                  <Eye className="h-4 w-4" />
                  Ver Documento
                </Button>

                {/* Imprimir - somente para documento aprovado */}
                {podeImprimir && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                    onClick={() => handleImprimir(documento)}
                    disabled={imprimindoId === documento.id || !pdfUrl}
                    title="Imprimir documento em PDF"
                  >
                    <Printer className="h-4 w-4" />
                    {imprimindoId === documento.id ? "Imprimindo..." : "Imprimir"}
                  </Button>
                )}

                {/* Aprovar Button - apenas para analista_pedagogico */}
                {canAprovar && onAprovar && !documento.approvedBy && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => handleAprovar(documento.id)}
                    disabled={
                      aprovandoId === documento.id ||
                      documento.previewStatus === "PENDENTE"
                    }
                    title="Aprovar documento"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {aprovandoId === documento.id ? "Aprovando..." : "Aprovar"}
                  </Button>
                )}

                {/* Desfazer Aprovação - apenas para analista quando documento está aprovado */}
                {canAprovar && onDesaprovar && !!documento.approvedBy && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                    onClick={() => handleDesaprovar(documento.id)}
                    disabled={desaprovandoId === documento.id}
                    title="Desfazer aprovação do documento"
                  >
                    <Undo2 className="h-4 w-4" />
                    {desaprovandoId === documento.id
                      ? "Desfazendo..."
                      : "Desfazer"}
                  </Button>
                )}

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

            {/* Modal de Preview */}
            <DocumentoPreviewModal
              documento={documento}
              open={openDocId === documento.id}
              onOpenChange={(open) => setOpenDocId(open ? documento.id : null)}
              onAddComentario={onAddComentario}
              onEditComentario={onEditComentario}
              onDeleteComentario={onDeleteComentario}
              currentUserId={currentUserId}
            />

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
