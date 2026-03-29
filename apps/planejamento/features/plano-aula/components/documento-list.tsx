"use client";

/**
 * DocumentoList Component
 * Lista de documentos anexados ao plano de aula
 * Task 3.2: Criar componentes de upload e lista de documentos
 */

import { useState } from "react";

import { formatarDataHora, formatarDataHoraCurta } from "@essencia/shared/formatar-data";
import { toast } from "@essencia/ui/toaster";
import { Badge } from "@essencia/ui/components/badge";
import { Button } from "@essencia/ui/components/button";
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
import { cn } from "@essencia/ui/lib/utils";
import {
  CheckCircle,
  Eye,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Image,
  MessageSquare,
  Pencil,
  Printer,
  Trash2,
  Undo2,
  Youtube,
} from "lucide-react";

import type { PlanoDocumento } from "../types";
import { DocumentoEditorModal } from "./documento-editor";

interface DocumentoListProps {
  documentos: PlanoDocumento[];
  onDelete?: (docId: string) => void;
  onAprovar?: (docId: string) => Promise<void>;
  onDesaprovar?: (docId: string) => Promise<void>;
  onImprimir?: (docId: string) => Promise<void>;
  canDelete?: boolean;
  canAprovar?: boolean;
  canComentar?: boolean;
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

function isWordDocument(documento: PlanoDocumento): boolean {
  return (
    documento.mimeType?.includes("word") === true ||
    documento.mimeType?.includes("msword") === true
  );
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
  onAprovar,
  onDesaprovar,
  onImprimir,
  canDelete = false,
  canAprovar = false,
  canComentar = false,
}: DocumentoListProps) {
  const [editorDocId, setEditorDocId] = useState<string | null>(null);
  const [aprovandoId, setAprovandoId] = useState<string | null>(null);
  const [imprimindoId, setImprimindoId] = useState<string | null>(null);
  const [desaprovandoId, setDesaprovandoId] = useState<string | null>(null);
  const [showConfirmarImpressao, setShowConfirmarImpressao] = useState(false);
  const [documentoParaImprimir, setDocumentoParaImprimir] = useState<string | null>(null);

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

  const handleImprimir = (documento: PlanoDocumento) => {
    if (!onImprimir || !documento.url) return;

    imprimirPdf(documento.url);
    setDocumentoParaImprimir(documento.id);
    setShowConfirmarImpressao(true);
  };

  const handleConfirmarImpressao = async () => {
    if (!onImprimir || !documentoParaImprimir) return;

    try {
      setImprimindoId(documentoParaImprimir);
      await onImprimir(documentoParaImprimir);
    } catch (error) {
      console.error("Erro ao registrar impressao do documento:", error);
    } finally {
      setImprimindoId(null);
      setDocumentoParaImprimir(null);
      setShowConfirmarImpressao(false);
    }
  };

  const handleCancelarImpressao = () => {
    setDocumentoParaImprimir(null);
    setShowConfirmarImpressao(false);
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
        const podeVisualizar = isWordDocument(documento) || !!url;
        const podeEditar = isWordDocument(documento);
        const podeAprovar = canAprovar && !!onAprovar && !documento.approvedBy;
        const podeDesaprovar =
          canAprovar && !!onDesaprovar && !!documento.approvedBy;
        const podeImprimir =
          documento.mimeType === "application/pdf" &&
          !!documento.approvedAt &&
          !!documento.approvedBy &&
          !!onImprimir;
        const podeExcluir = canDelete && !!onDelete;
        const temAcoesVisiveis =
          podeVisualizar ||
          podeEditar ||
          podeAprovar ||
          podeDesaprovar ||
          podeImprimir ||
          podeExcluir;

        return (
          <div
            key={documento.id}
            className="rounded-lg border bg-card transition-colors"
          >
            <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
              {/* Icon + Info */}
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div
                  className={cn(
                    "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg mt-0.5",
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

                <div className="min-w-0 flex-1 space-y-1.5">
                  {/* Nome do arquivo */}
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-sm truncate hover:underline hover:text-primary flex items-center gap-1"
                      title={name}
                    >
                      <span className="truncate">{name}</span>
                      <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                    </a>
                  ) : (
                    <p className="font-medium text-sm truncate" title={name}>
                      {name}
                    </p>
                  )}

                  {/* Metadata: tipo, tamanho, data */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="px-1.5 py-0.5 rounded bg-muted font-medium">
                      {getFileTypeLabel(documento)}
                    </span>
                    {documento.fileSize && (
                      <>
                        <span className="text-muted-foreground/40">&middot;</span>
                        <span>{formatFileSize(documento.fileSize)}</span>
                      </>
                    )}
                    {documento.createdAt && (
                      <>
                        <span className="text-muted-foreground/40">&middot;</span>
                        <span title="Data de envio">
                          {formatarDataHora(documento.createdAt)}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Status badges */}
                  {(documento.approvedBy ||
                    documento.printedAt ||
                    documento.temComentarios) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {documento.approvedBy && documento.approvedAt && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-5 border-green-200 bg-green-50 text-green-700 font-medium"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Aprovado
                        </Badge>
                      )}
                      {documento.printedAt && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-5 border-indigo-200 bg-indigo-50 text-indigo-700 font-medium"
                        >
                          <Printer className="h-3 w-3 mr-1" />
                          Impresso{" "}
                          {formatarDataHoraCurta(documento.printedAt)}
                        </Badge>
                      )}
                      {documento.temComentarios && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-5 border-blue-200 bg-blue-50 text-blue-700 font-medium"
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Comentarios
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Acoes */}
              {temAcoesVisiveis && (
                <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
                  {isWordDocument(documento) ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditorDocId(documento.id)}
                      title="Visualizar documento"
                      aria-label="Visualizar documento"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  ) : url ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => window.open(url, "_blank")}
                      title="Visualizar documento"
                      aria-label="Visualizar documento"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  ) : null}

                  {podeEditar && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                      onClick={async () => {
                        try {
                          const res = await fetch(
                            `/api/plano-aula/${documento.planoId}/documentos/${documento.id}/editar-word`,
                            { credentials: "include" },
                          );
                          if (!res.ok) {
                            const err = await res.json();
                            toast.error(err.message || "Erro ao abrir no Word");
                            return;
                          }
                          const json = await res.json();
                          window.location.href = json.data.url;
                          toast.info(
                            "O documento foi aberto no Word. Edite e salve normalmente (Ctrl+S). As alterações serão sincronizadas automaticamente.",
                          );
                        } catch {
                          toast.error("Erro ao preparar edição no Word");
                        }
                      }}
                      title="Editar no Word"
                      aria-label="Editar no Word"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}

                  {podeAprovar && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-green-600 hover:bg-green-50 hover:text-green-700"
                      onClick={() => handleAprovar(documento.id)}
                      disabled={aprovandoId === documento.id}
                      title={
                        aprovandoId === documento.id
                          ? "Aprovando..."
                          : "Aprovar documento"
                      }
                      aria-label={
                        aprovandoId === documento.id
                          ? "Aprovando..."
                          : "Aprovar documento"
                      }
                    >
                      <CheckCircle
                        className={cn(
                          "h-4 w-4",
                          aprovandoId === documento.id && "animate-pulse",
                        )}
                      />
                    </Button>
                  )}

                  {podeDesaprovar && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                      onClick={() => handleDesaprovar(documento.id)}
                      disabled={desaprovandoId === documento.id}
                      title={
                        desaprovandoId === documento.id
                          ? "Desfazendo..."
                          : "Desfazer aprovacao"
                      }
                      aria-label={
                        desaprovandoId === documento.id
                          ? "Desfazendo..."
                          : "Desfazer aprovacao"
                      }
                    >
                      <Undo2
                        className={cn(
                          "h-4 w-4",
                          desaprovandoId === documento.id && "animate-pulse",
                        )}
                      />
                    </Button>
                  )}

                  {podeImprimir && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8",
                        imprimindoId === documento.id
                          ? "text-muted-foreground"
                          : "text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700",
                      )}
                      onClick={() => handleImprimir(documento)}
                      disabled={imprimindoId === documento.id}
                      title={
                        imprimindoId === documento.id
                          ? "Imprimindo..."
                          : "Imprimir documento"
                      }
                      aria-label={
                        imprimindoId === documento.id
                          ? "Imprimindo..."
                          : "Imprimir documento"
                      }
                    >
                      <Printer
                        className={cn(
                          "h-4 w-4",
                          imprimindoId === documento.id && "animate-pulse",
                        )}
                      />
                    </Button>
                  )}

                  {podeExcluir && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onDelete(documento.id)}
                      title="Excluir documento"
                      aria-label="Excluir documento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Modal de visualização do documento (Word) */}
            {isWordDocument(documento) && (
              <DocumentoEditorModal
                planoId={documento.planoId}
                documentoId={documento.id}
                open={editorDocId === documento.id}
                onOpenChange={(open) =>
                  setEditorDocId(open ? documento.id : null)
                }
              />
            )}
          </div>
        );
      })}

      {/* Dialog de confirmacao de impressao */}
      <AlertDialog
        open={showConfirmarImpressao}
        onOpenChange={(open) => {
          if (!open) handleCancelarImpressao();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Impressao</AlertDialogTitle>
            <AlertDialogDescription>
              O documento foi impresso com sucesso?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelarImpressao}>
              Nao, cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarImpressao}
              disabled={imprimindoId !== null}
            >
              {imprimindoId ? "Registrando..." : "Sim, foi impresso"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
