"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@essencia/ui/components/alert";
import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ExternalLink,
  FileText,
  Loader2,
  Pencil,
  Printer,
  RotateCcw,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  ConfirmarExclusaoDocumentoDialog,
  HistoricoTimeline,
  isDocumentoExcluivel,
} from "../../../../features/plano-aula";
import {
  RelatorioHeader,
  type Relatorio,
  type RelatorioDocumento,
  useAnalistaRelatorio,
  useRelatorio,
  useSemestreRelatorio,
} from "../../../../features/relatorio";
import {
  MENSAGEM_ARQUIVO_EXCLUIDO_SEM_ATUALIZAR,
  obterMensagemErro,
} from "../../../../lib/mensagens-erro";

interface RevisaoRelatorioContentProps {
  relatorioId: string;
}

function isDocumentoWord(documento: RelatorioDocumento): boolean {
  return (
    documento.mimeType?.includes("word") === true ||
    documento.mimeType?.includes("msword") === true ||
    documento.fileName?.match(/\.docx?$/i) !== null
  );
}

function getUrlParaImpressao(documento: RelatorioDocumento): string | null {
  if (documento.tipo === "LINK_YOUTUBE") return null;

  if (isDocumentoWord(documento)) {
    return documento.pdfStatus === "PRONTO" && documento.pdfUrl
      ? documento.pdfUrl
      : null;
  }

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

function getEtapaRelatorioLabel(etapa?: string): string | undefined {
  const labels: Record<string, string> = {
    BERCARIO: "Berçário",
    INFANTIL: "Infantil",
  };

  return etapa ? labels[etapa] || etapa : undefined;
}

export function RevisaoRelatorioContent({
  relatorioId,
}: RevisaoRelatorioContentProps) {
  const router = useRouter();
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [documentoParaExcluir, setDocumentoParaExcluir] =
    useState<RelatorioDocumento | null>(null);
  const [historicoVersao, setHistoricoVersao] = useState(0);

  const { getRelatorio, editarWord, sincronizarWord, deleteDocumento } =
    useRelatorio();
  const { semestres, isLoading: isLoadingSemestre } = useSemestreRelatorio();
  const {
    loading: loadingAction,
    aprovar,
    devolver,
    aprovarDocumento,
    desaprovarDocumento,
    regerarPdfDocumento,
    imprimirDocumento,
  } = useAnalistaRelatorio();

  const carregarRelatorio = useCallback(
    async (propagarErro = false) => {
      setIsLoading(true);
      setActionError(null);
      try {
        setRelatorio(await getRelatorio(relatorioId));
      } catch (err) {
        const mensagem = obterMensagemErro(
          err,
          "Não foi possível carregar o relatório. Tente novamente.",
        );
        setActionError(mensagem);
        if (propagarErro) {
          throw new Error(MENSAGEM_ARQUIVO_EXCLUIDO_SEM_ATUALIZAR);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [getRelatorio, relatorioId],
  );

  useEffect(() => {
    void carregarRelatorio();
  }, [carregarRelatorio]);

  const handleAprovar = useCallback(async () => {
    try {
      await aprovar(relatorioId);
      setSuccessMessage("Relatório aprovado e enviado para coordenação.");
      setTimeout(() => router.push("/relatorios/analise"), 1200);
    } catch (err) {
      setActionError(
        obterMensagemErro(
          err,
          "Não foi possível aprovar o relatório. Tente novamente.",
        ),
      );
    }
  }, [aprovar, relatorioId, router]);

  const handleDevolver = useCallback(async () => {
    const motivo =
      window.prompt("Informe o motivo da devolução para a professora") ||
      "Ajustes solicitados pela analista";

    try {
      await devolver(relatorioId, motivo);
      setSuccessMessage("Relatório devolvido para a professora.");
      setTimeout(() => router.push("/relatorios/analise"), 1200);
    } catch (err) {
      setActionError(
        obterMensagemErro(
          err,
          "Não foi possível devolver o relatório. Tente novamente.",
        ),
      );
    }
  }, [devolver, relatorioId, router]);

  const handleAprovarDocumento = useCallback(
    async (documentoId: string) => {
      try {
        await aprovarDocumento(relatorioId, documentoId);
        await carregarRelatorio();
        setSuccessMessage("Documento aprovado.");
      } catch (err) {
        setActionError(
          obterMensagemErro(
            err,
            "Não foi possível aprovar o documento. Tente novamente.",
          ),
        );
      }
    },
    [aprovarDocumento, carregarRelatorio, relatorioId],
  );

  const handleDesaprovarDocumento = useCallback(
    async (documentoId: string) => {
      try {
        await desaprovarDocumento(relatorioId, documentoId);
        await carregarRelatorio();
        setSuccessMessage("Aprovação do documento desfeita.");
      } catch (err) {
        setActionError(
          obterMensagemErro(
            err,
            "Não foi possível desfazer a aprovação. Tente novamente.",
          ),
        );
      }
    },
    [desaprovarDocumento, carregarRelatorio, relatorioId],
  );

  const handleExcluirDocumento = useCallback(
    async (documentoId: string, motivo: string) => {
      setActionError(null);
      setSuccessMessage(null);

      try {
        await deleteDocumento(relatorioId, documentoId, motivo);
      } catch (err) {
        setActionError(
          obterMensagemErro(
            err,
            "Não foi possível excluir o arquivo. Tente novamente.",
          ),
        );
        throw err;
      }

      try {
        await carregarRelatorio(true);
        setHistoricoVersao((versao) => versao + 1);
        setSuccessMessage("Arquivo excluído com sucesso!");
      } catch (err) {
        console.error(
          "Arquivo excluído, mas não foi possível atualizar o relatório:",
          err,
        );
        setActionError(MENSAGEM_ARQUIVO_EXCLUIDO_SEM_ATUALIZAR);
      }
    },
    [carregarRelatorio, deleteDocumento, relatorioId],
  );

  const handleEditarWord = useCallback(
    async (documentoId: string) => {
      try {
        const { url } = await editarWord(relatorioId, documentoId);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (err) {
        setActionError(
          obterMensagemErro(
            err,
            "Não foi possível abrir a edição no Word. Tente novamente.",
          ),
        );
      }
    },
    [editarWord, relatorioId],
  );

  const handleSincronizarWord = useCallback(
    async (documentoId: string) => {
      try {
        await sincronizarWord(relatorioId, documentoId);
        await carregarRelatorio();
        setSuccessMessage("Documento sincronizado.");
      } catch (err) {
        setActionError(
          obterMensagemErro(
            err,
            "Não foi possível sincronizar o documento. Tente novamente.",
          ),
        );
      }
    },
    [carregarRelatorio, relatorioId, sincronizarWord],
  );

  const handleRegerarPdfDocumento = useCallback(
    async (documentoId: string) => {
      try {
        await regerarPdfDocumento(relatorioId, documentoId);
        await carregarRelatorio();
        setSuccessMessage("PDF enviado para preparação.");
      } catch (err) {
        setActionError(
          obterMensagemErro(
            err,
            "Não foi possível preparar o PDF. Tente novamente.",
          ),
        );
      }
    },
    [carregarRelatorio, regerarPdfDocumento, relatorioId],
  );

  const handleImprimirDocumento = useCallback(
    async (documento: RelatorioDocumento) => {
      const url = getUrlParaImpressao(documento);
      if (!url) {
        setActionError("PDF de impressão ainda não está disponível.");
        return;
      }

      try {
        window.open(url, "_blank", "noopener,noreferrer");
        await imprimirDocumento(relatorioId, documento.id);
        await carregarRelatorio();
        setSuccessMessage("Impressão registrada.");
      } catch (err) {
        setActionError(
          obterMensagemErro(
            err,
            "Não foi possível registrar a impressão. Tente novamente.",
          ),
        );
      }
    },
    [carregarRelatorio, imprimirDocumento, relatorioId],
  );

  if (isLoading && !relatorio) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando relatório...</p>
        </div>
      </div>
    );
  }

  if (!relatorio) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <Link
          href="/relatorios/analise"
          className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para análise
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Relatório não encontrado</AlertTitle>
          <AlertDescription>
            {actionError ||
              "O relatório solicitado não foi encontrado ou você não tem permissão para acessá-lo."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const canPerformActions =
    relatorio.status === "AGUARDANDO_ANALISTA" ||
    relatorio.status === "REVISAO_ANALISTA";
  const semestre = semestres.find(
    (item) =>
      item.id === relatorio.semestreRelatorioId ||
      item.id === relatorio.semestreId,
  );

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <Link
          href="/relatorios/analise"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para análise
        </Link>
      </div>

      <RelatorioHeader
        professorName={relatorio.user?.name || relatorio.professorName || ""}
        turmaName={relatorio.turma?.name || relatorio.turmaName || ""}
        turmaCode={relatorio.turma?.code || relatorio.turmaCode}
        semestreNumero={semestre?.semestre}
        semestreDescricao={semestre?.descricao}
        semestreInicio={semestre?.dataInicio}
        semestreFim={semestre?.dataFim}
        prazoEntrega={semestre?.dataMaximaEntrega ?? relatorio.deadline}
        etapaNome={getEtapaRelatorioLabel(semestre?.etapa)}
        status={relatorio.status}
        submittedAt={relatorio.submittedAt}
        isLoadingSemestre={isLoadingSemestre}
      />

      {successMessage && (
        <Alert className="mb-6 border-green-400 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Sucesso</AlertTitle>
          <AlertDescription className="text-green-700">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {actionError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                Documentos Anexados
              </CardTitle>
              <CardDescription>
                Revise, aprove e edite documentos Word quando necessário.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {relatorio.documentos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum documento anexado.
                </p>
              ) : (
                relatorio.documentos.map((documento) => {
                  const documentoWord = isDocumentoWord(documento);
                  const urlParaImpressao = getUrlParaImpressao(documento);
                  const pdfPendente =
                    documentoWord &&
                    !!documento.approvedAt &&
                    !urlParaImpressao &&
                    (documento.pdfStatus === "PENDENTE" ||
                      documento.pdfStatus === "GERANDO");
                  const pdfComErro =
                    documentoWord &&
                    !!documento.approvedAt &&
                    documento.pdfStatus === "ERRO";
                  const podeRegerarPdf =
                    documentoWord &&
                    !!documento.approvedAt &&
                    !urlParaImpressao &&
                    (documento.pdfStatus === "PENDENTE" ||
                      documento.pdfStatus === "ERRO");

                  return (
                    <div
                      key={documento.id}
                      className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">
                          {documento.fileName || documento.url || "Documento"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {documento.mimeType || documento.tipo}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {documento.url && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            title="Abrir documento"
                            aria-label="Abrir documento"
                            onClick={() =>
                              window.open(
                                documento.url ?? "",
                                "_blank",
                                "noopener,noreferrer",
                              )
                            }
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        {documentoWord && (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                              title="Editar no Word"
                              aria-label="Editar no Word"
                              onClick={() => handleEditarWord(documento.id)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                              title="Sincronizar Word"
                              aria-label="Sincronizar Word"
                              onClick={() =>
                                handleSincronizarWord(documento.id)
                              }
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {urlParaImpressao && documento.approvedAt && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            title="Imprimir documento"
                            aria-label="Imprimir documento"
                            onClick={() => handleImprimirDocumento(documento)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        )}
                        {pdfPendente && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            title="PDF em preparação"
                            aria-label="PDF em preparação"
                            disabled
                          >
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </Button>
                        )}
                        {pdfComErro && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            title="PDF com erro"
                            aria-label="PDF com erro"
                            disabled
                          >
                            <AlertCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {podeRegerarPdf && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            title="Gerar PDF"
                            aria-label="Gerar PDF"
                            onClick={() =>
                              handleRegerarPdfDocumento(documento.id)
                            }
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        {documento.approvedAt ? (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            title="Desfazer aprovação do documento"
                            aria-label="Desfazer aprovação do documento"
                            onClick={() =>
                              handleDesaprovarDocumento(documento.id)
                            }
                          >
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            title="Aprovar documento"
                            aria-label="Aprovar documento"
                            onClick={() => handleAprovarDocumento(documento.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        {isDocumentoExcluivel(documento) && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 text-destructive hover:text-destructive"
                            title="Excluir arquivo"
                            aria-label="Excluir arquivo"
                            onClick={() => setDocumentoParaExcluir(documento)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <HistoricoTimeline
            key={historicoVersao}
            planoId={relatorioId}
            modulo="relatorio"
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ações</CardTitle>
              <CardDescription>
                {canPerformActions
                  ? "Revise o relatório e escolha uma ação."
                  : "Este relatório não está aguardando análise."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={handleAprovar}
                disabled={!canPerformActions || loadingAction}
                className="w-full bg-green-600 text-white hover:bg-green-700"
              >
                <Send className="mr-2 h-4 w-4" />
                Aprovar
              </Button>
              <Button
                onClick={handleDevolver}
                disabled={!canPerformActions || loadingAction}
                variant="outline"
                className="w-full border-yellow-400 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 hover:text-yellow-800"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Devolver
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {documentoParaExcluir && (
        <ConfirmarExclusaoDocumentoDialog
          open
          documentoId={documentoParaExcluir.id}
          nomeArquivo={documentoParaExcluir.fileName || "Documento"}
          onOpenChange={(open: boolean) => {
            if (!open) setDocumentoParaExcluir(null);
          }}
          onConfirmar={handleExcluirDocumento}
        />
      )}
    </div>
  );
}
