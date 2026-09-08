"use client";

/**
 * DocumentoList Component
 * Lista de documentos anexados ao plano de aula
 * Task 3.2: Criar componentes de upload e lista de documentos
 */

import {
  formatarDataHora,
  formatarDataHoraCurta,
} from "@essencia/shared/formatar-data";
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
import { Badge } from "@essencia/ui/components/badge";
import { Button } from "@essencia/ui/components/button";
import { cn } from "@essencia/ui/lib/utils";
import { toast } from "@essencia/ui/toaster";
import {
  AlertCircle,
  CheckCircle,
  Eye,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Image,
  MessageSquare,
  Pencil,
  Printer,
  RefreshCw,
  Trash2,
  Undo2,
  Youtube,
} from "lucide-react";
import { useState } from "react";

import {
  obterMensagemErro,
  obterMensagemErroDaRespostaHttp,
} from "../../../lib/mensagens-erro";
import {
  enviarEventosPendentes,
  registrarEventoObservabilidade,
} from "../../../lib/observabilidade";
import {
  isDocumentoLinkYoutube,
  isDocumentoUpload,
  type PlanoDocumento,
} from "../types";

import { ConfirmarExclusaoDocumentoDialog } from "./confirmar-exclusao-documento-dialog";
import { DocumentoEditorModal } from "./documento-editor";

interface DocumentoListProps {
  documentos: PlanoDocumento[];
  onDelete?: (docId: string, motivo: string) => Promise<void>;
  onAprovar?: (docId: string) => Promise<void>;
  onDesaprovar?: (docId: string) => Promise<void>;
  onImprimir?: (docId: string) => Promise<void>;
  onRegerarPdf?: (docId: string) => Promise<void>;
  canDelete?: boolean;
  canAprovar?: boolean;
  canEdit?: boolean;
  canComentar?: boolean;
  permitirImpressaoSemAprovacao?: boolean;
  modulo?: DocumentoModulo;
}

type DocumentoModulo = "plano-aula" | "prova";

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
  if (isDocumentoLinkYoutube(documento.tipo)) {
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
  if (isDocumentoLinkYoutube(documento.tipo)) {
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
  if (isDocumentoLinkYoutube(documento.tipo)) {
    return documento.url;
  }

  if (isDocumentoUpload(documento.tipo)) {
    // A API já entrega a URL assinada ou pública do arquivo enviado.
    return documento.url;
  }

  return undefined;
}

function getUrlParaImpressao(documento: PlanoDocumento): string | null {
  if (isDocumentoLinkYoutube(documento.tipo)) {
    return null;
  }

  if (isWordDocument(documento)) {
    return documento.pdfStatus === "PRONTO" && documento.pdfUrl
      ? documento.pdfUrl
      : null;
  }

  // pdfUrl é o PDF derivado gerado na aprovação (para DOCX) ou espelho
  // do próprio url quando o documento já é PDF.
  if (documento.pdfUrl) return documento.pdfUrl;
  if (!documento.url) return null;
  if (
    documento.mimeType === "application/pdf" ||
    documento.mimeType?.startsWith("image/")
  ) {
    return documento.url;
  }
  return null;
}

function imprimirDocumento(documento: PlanoDocumento): boolean {
  const url = getUrlParaImpressao(documento);
  if (!url) return false;

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

  return true;
}

function isWordDocument(documento: PlanoDocumento): boolean {
  return (
    documento.mimeType?.includes("word") === true ||
    documento.mimeType?.includes("msword") === true
  );
}

function getPdfStatusInfo(documento: PlanoDocumento): {
  label: string;
  className: string;
  icon: typeof RefreshCw;
  animate?: boolean;
} | null {
  if (
    !isDocumentoUpload(documento.tipo) ||
    !isWordDocument(documento) ||
    !documento.approvedBy
  )
    return null;

  switch (documento.pdfStatus) {
    case "PENDENTE":
      return {
        label: "PDF em preparação",
        className: "border-amber-200 bg-amber-50 text-amber-700",
        icon: RefreshCw,
      };
    case "GERANDO":
      return {
        label: "Preparando PDF",
        className: "border-blue-200 bg-blue-50 text-blue-700",
        icon: RefreshCw,
        animate: true,
      };
    case "PRONTO":
      return {
        label: "PDF pronto",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
        icon: CheckCircle,
      };
    case "ERRO":
      return {
        label: "Falha no PDF",
        className: "border-red-200 bg-red-50 text-red-700",
        icon: AlertCircle,
      };
    default:
      return null;
  }
}

function getDocumentName(documento: PlanoDocumento): string {
  if (isDocumentoLinkYoutube(documento.tipo) && documento.url) {
    // Extrair ID do video do YouTube para exibicao
    const match = documento.url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/,
    );
    return match ? `Video YouTube: ${match[1]}` : "Video do YouTube";
  }
  return documento.fileName || "Documento sem nome";
}

function criarMetadadosArquivo(
  documento: PlanoDocumento,
  modulo: DocumentoModulo,
) {
  return {
    planoId: modulo === "plano-aula" ? documento.planoId : undefined,
    provaId: modulo === "prova" ? documento.planoId : undefined,
    documentoId: documento.id,
    nome: documento.fileName || null,
    tipo: documento.mimeType || null,
    tamanhoBytes: documento.fileSize || null,
  };
}

function obterMensagemObservabilidade(error: unknown): string {
  return error instanceof Error ? error.message : "Erro desconhecido";
}

function enviarObservabilidadeBestEffort() {
  void enviarEventosPendentes().catch(() => undefined);
}

export function DocumentoList({
  documentos,
  onDelete,
  onAprovar,
  onDesaprovar,
  onImprimir,
  onRegerarPdf,
  canDelete = false,
  canAprovar = false,
  canEdit = false,
  canComentar: _canComentar = false,
  permitirImpressaoSemAprovacao = false,
  modulo = "plano-aula",
}: DocumentoListProps) {
  const [editorDocId, setEditorDocId] = useState<string | null>(null);
  const [aprovandoId, setAprovandoId] = useState<string | null>(null);
  const [imprimindoId, setImprimindoId] = useState<string | null>(null);
  const [desaprovandoId, setDesaprovandoId] = useState<string | null>(null);
  const [sincronizandoId, setSincronizandoId] = useState<string | null>(null);
  const [regerandoPdfId, setRegerandoPdfId] = useState<string | null>(null);
  const [showConfirmarImpressao, setShowConfirmarImpressao] = useState(false);
  const [documentoParaImprimir, setDocumentoParaImprimir] = useState<
    string | null
  >(null);
  const [documentoParaExcluir, setDocumentoParaExcluir] =
    useState<PlanoDocumento | null>(null);

  const registrarEventoDocumento = (
    documento: PlanoDocumento,
    evento: Parameters<typeof registrarEventoObservabilidade>[0],
  ) => {
    registrarEventoObservabilidade({
      ...evento,
      arquivo: criarMetadadosArquivo(documento, modulo),
      detalhes: {
        modulo,
        ...(evento.detalhes ?? {}),
      },
    });
    enviarObservabilidadeBestEffort();
  };

  const registrarVisualizacaoDocumento = (documento: PlanoDocumento) => {
    registrarEventoDocumento(documento, {
      evento: "arquivo_acao",
      nivel: "info",
      detalhes: {
        acao: "visualizar",
      },
    });
  };

  const prepararEdicaoWord = async (documento: PlanoDocumento) => {
    const res = await fetch(
      `/api/${modulo}/${documento.planoId}/documentos/${documento.id}/editar-word`,
      { credentials: "include" },
    );

    if (!res.ok) {
      const mensagem = await obterMensagemErroDaRespostaHttp(
        res,
        "Não foi possível abrir o documento no Word. Tente novamente.",
      );
      throw new Error(mensagem);
    }

    const json = await res.json();
    return json.data as { url: string };
  };

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

  const handleRegerarPdf = async (docId: string) => {
    if (!onRegerarPdf) return;
    try {
      setRegerandoPdfId(docId);
      await onRegerarPdf(docId);
    } catch (error) {
      console.error("Erro ao reprocessar PDF:", error);
      toast.error(
        obterMensagemErro(
          error,
          "Não foi possível tentar gerar o PDF novamente. Tente mais tarde.",
        ),
      );
    } finally {
      setRegerandoPdfId(null);
    }
  };

  const handleImprimir = (documento: PlanoDocumento) => {
    if (!onImprimir) return;

    const abriu = imprimirDocumento(documento);
    if (!abriu) {
      toast.error(
        "PDF de impressão ainda não disponível. Desaprove e aprove novamente para gerar.",
      );
      return;
    }
    setDocumentoParaImprimir(documento.id);
    setShowConfirmarImpressao(true);
  };

  const handleConfirmarImpressao = async () => {
    if (!onImprimir || !documentoParaImprimir) return;

    const documento = documentos.find(
      (doc) => doc.id === documentoParaImprimir,
    );

    try {
      setImprimindoId(documentoParaImprimir);
      await onImprimir(documentoParaImprimir);
      if (documento) {
        registrarEventoDocumento(documento, {
          evento: "arquivo_acao",
          nivel: "info",
          detalhes: {
            acao: "imprimir",
            status: "sucesso",
          },
        });
      }
    } catch (error) {
      console.error("Erro ao registrar impressao do documento:", error);
      if (documento) {
        registrarEventoDocumento(documento, {
          evento: "arquivo_acao",
          nivel: "error",
          erro: {
            mensagem: obterMensagemObservabilidade(error),
          },
          detalhes: {
            acao: "imprimir",
            status: "erro",
          },
        });
      }
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
        const urlParaImpressao = getUrlParaImpressao(documento);
        const documentoWord = isWordDocument(documento);
        const urlPdfProva =
          modulo === "prova" && documentoWord && urlParaImpressao
            ? urlParaImpressao
            : null;
        const urlLinkDocumento = urlPdfProva ?? url;
        const urlVisualizacaoAcao =
          urlPdfProva ?? (documentoWord ? undefined : url);
        const name = getDocumentName(documento);
        const podeVisualizar = documentoWord || !!urlVisualizacaoAcao;
        const ehUpload = isDocumentoUpload(documento.tipo);
        const ehLinkYoutube = isDocumentoLinkYoutube(documento.tipo);
        const podeEditar = canEdit && ehUpload && documentoWord;
        const podeAprovar = canAprovar && !!onAprovar && !documento.approvedBy;
        const podeDesaprovar =
          canAprovar && !!onDesaprovar && !!documento.approvedBy;
        const podeRegerarPdf =
          canAprovar &&
          !!onRegerarPdf &&
          !!documento.approvedBy &&
          ehUpload &&
          documentoWord &&
          documento.pdfStatus === "ERRO";
        const podeImprimir =
          !ehLinkYoutube &&
          !!urlParaImpressao &&
          (permitirImpressaoSemAprovacao ||
            (!!documento.approvedAt && !!documento.approvedBy)) &&
          !!onImprimir;
        const podeExcluir =
          canDelete &&
          !!onDelete &&
          ehUpload &&
          !documento.approvedBy &&
          !documento.approvedAt;
        const temAcoesVisiveis =
          podeVisualizar ||
          podeEditar ||
          podeAprovar ||
          podeDesaprovar ||
          podeRegerarPdf ||
          podeImprimir ||
          podeExcluir;
        const pdfStatusInfo = getPdfStatusInfo(documento);
        const PdfStatusIcon = pdfStatusInfo?.icon;

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
                    ehLinkYoutube ? "bg-red-100" : "bg-primary/10",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      ehLinkYoutube ? "text-red-600" : "text-primary",
                    )}
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  {/* Nome do arquivo */}
                  {urlLinkDocumento ? (
                    <a
                      href={urlLinkDocumento}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => registrarVisualizacaoDocumento(documento)}
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
                        <span className="text-muted-foreground/40">
                          &middot;
                        </span>
                        <span>{formatFileSize(documento.fileSize)}</span>
                      </>
                    )}
                    {(documento.updatedAt || documento.createdAt) && (
                      <>
                        <span className="text-muted-foreground/40">
                          &middot;
                        </span>
                        <span title="Última atualização">
                          {formatarDataHora(
                            documento.updatedAt || documento.createdAt,
                          )}
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
                      {pdfStatusInfo && PdfStatusIcon && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0 h-5 font-medium",
                            pdfStatusInfo.className,
                          )}
                        >
                          <PdfStatusIcon
                            className={cn(
                              "h-3 w-3 mr-1",
                              pdfStatusInfo.animate && "animate-spin",
                            )}
                          />
                          {pdfStatusInfo.label}
                        </Badge>
                      )}
                      {documento.printedAt && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-5 border-indigo-200 bg-indigo-50 text-indigo-700 font-medium"
                        >
                          <Printer className="h-3 w-3 mr-1" />
                          Impresso {formatarDataHoraCurta(documento.printedAt)}
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
                  {documentoWord && !urlVisualizacaoAcao ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        registrarVisualizacaoDocumento(documento);
                        setEditorDocId(documento.id);
                      }}
                      title="Visualizar documento"
                      aria-label="Visualizar documento"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  ) : urlVisualizacaoAcao ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        registrarVisualizacaoDocumento(documento);
                        window.open(urlVisualizacaoAcao, "_blank");
                      }}
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
                          registrarEventoDocumento(documento, {
                            evento: "sharepoint_word",
                            nivel: "info",
                            detalhes: {
                              acao: "editar",
                              status: "inicio",
                            },
                          });
                          const data = await prepararEdicaoWord(documento);
                          registrarEventoDocumento(documento, {
                            evento: "sharepoint_word",
                            nivel: "info",
                            detalhes: {
                              acao: "editar",
                              status: "sucesso",
                            },
                          });
                          window.location.href = data.url;
                          // Recarregar após breve delay para exibir o botão Sincronizar
                          // (o protocolo ms-word:// abre o Word sem navegar o browser)
                          setTimeout(() => window.location.reload(), 1500);
                          toast.info(
                            "O documento foi aberto no Word. Após editar e salvar, volte ao portal e clique em Sincronizar.",
                          );
                        } catch (error) {
                          registrarEventoDocumento(documento, {
                            evento: "sharepoint_word",
                            nivel: "error",
                            erro: {
                              mensagem: obterMensagemObservabilidade(error),
                            },
                            detalhes: {
                              acao: "editar",
                              status: "erro",
                            },
                          });
                          toast.error(
                            obterMensagemErro(
                              error,
                              "Não foi possível abrir o documento no Word. Tente novamente.",
                            ),
                          );
                        }
                      }}
                      title="Editar no Word"
                      aria-label="Editar no Word"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}

                  {podeEditar &&
                    documento.sharepointItemId &&
                    documento.sharepointEditUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-purple-600 hover:bg-purple-50 hover:text-purple-700"
                        onClick={async () => {
                          try {
                            setSincronizandoId(documento.id);
                            registrarEventoDocumento(documento, {
                              evento: "sharepoint_word",
                              nivel: "info",
                              detalhes: {
                                acao: "sincronizar",
                                status: "inicio",
                              },
                            });
                            const res = await fetch(
                              `/api/${modulo}/${documento.planoId}/documentos/${documento.id}/sincronizar-word`,
                              { method: "POST", credentials: "include" },
                            );
                            if (!res.ok) {
                              const mensagem =
                                await obterMensagemErroDaRespostaHttp(
                                  res,
                                  "Não foi possível sincronizar o documento. Salve o arquivo no Word e tente novamente.",
                                );
                              throw new Error(mensagem);
                            }
                            registrarEventoDocumento(documento, {
                              evento: "sharepoint_word",
                              nivel: "info",
                              detalhes: {
                                acao: "sincronizar",
                                status: "sucesso",
                              },
                            });
                            toast.success(
                              "Documento sincronizado com sucesso!",
                            );
                            window.location.reload();
                          } catch (error) {
                            registrarEventoDocumento(documento, {
                              evento: "sharepoint_word",
                              nivel: "error",
                              erro: {
                                mensagem: obterMensagemObservabilidade(error),
                              },
                              detalhes: {
                                acao: "sincronizar",
                                status: "erro",
                              },
                            });
                            toast.error(
                              obterMensagemErro(
                                error,
                                "Não foi possível sincronizar o documento. Salve o arquivo no Word e tente novamente.",
                              ),
                            );
                          } finally {
                            setSincronizandoId(null);
                          }
                        }}
                        disabled={sincronizandoId === documento.id}
                        title="Sincronizar alterações do Word"
                        aria-label="Sincronizar alterações do Word"
                      >
                        <RefreshCw
                          className={cn(
                            "h-4 w-4",
                            sincronizandoId === documento.id && "animate-spin",
                          )}
                        />
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

                  {podeRegerarPdf && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => handleRegerarPdf(documento.id)}
                      disabled={regerandoPdfId === documento.id}
                      title="Tentar gerar PDF novamente"
                      aria-label="Tentar gerar PDF novamente"
                    >
                      <RefreshCw
                        className={cn(
                          "h-4 w-4",
                          regerandoPdfId === documento.id && "animate-spin",
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
                      onClick={() => setDocumentoParaExcluir(documento)}
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
            {documentoWord && !urlPdfProva && (
              <DocumentoEditorModal
                planoId={documento.planoId}
                documentoId={documento.id}
                modulo={modulo}
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

      {documentoParaExcluir && onDelete && (
        <ConfirmarExclusaoDocumentoDialog
          open
          nomeArquivo={getDocumentName(documentoParaExcluir)}
          onOpenChange={(open) => {
            if (!open) setDocumentoParaExcluir(null);
          }}
          onConfirmar={(motivo) => onDelete(documentoParaExcluir.id, motivo)}
        />
      )}
    </div>
  );
}
