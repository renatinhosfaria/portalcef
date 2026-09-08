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
import { AlertCircle, ArrowLeft, Loader2, Printer, Send } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  DocumentoList,
  HistoricoTimeline,
  type PlanoDocumento,
} from "../../../../../features/plano-aula";
import {
  adaptarDocumentoProvaParaDocumentoList,
  ProvaHeader,
  useGestaoImpressao,
  useProva,
  useProvaDetalhe,
} from "../../../../../features/prova";
import {
  MENSAGEM_ARQUIVO_EXCLUIDO_SEM_ATUALIZAR,
  obterMensagemErro,
} from "../../../../../lib/mensagens-erro";

interface ProvaGestaoContentProps {
  provaId: string;
}

export function ProvaGestaoContent({ provaId }: ProvaGestaoContentProps) {
  const {
    loading: loadingProva,
    prova,
    error,
    fetchProva,
    refetch,
  } = useProvaDetalhe();
  const { imprimirDocumento, deleteDocumento } = useProva();
  const { loading: loadingGestao, enviarParaAnalise } = useGestaoImpressao();

  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [historicoVersao, setHistoricoVersao] = useState(0);

  useEffect(() => {
    fetchProva(provaId).catch(() => undefined);
  }, [fetchProva, provaId]);

  const handleImprimirDocumento = useCallback(
    async (documentoId: string) => {
      setActionError(null);
      setSuccessMessage(null);

      try {
        await imprimirDocumento(documentoId);
        await refetch();
        setSuccessMessage("Impressao registrada com sucesso.");
      } catch (err) {
        setActionError(
          obterMensagemErro(
            err,
            "Não foi possível registrar a impressão. Tente novamente.",
          ),
        );
      }
    },
    [imprimirDocumento, refetch],
  );

  const handleExcluirDocumento = useCallback(
    async (documentoId: string, motivo: string) => {
      if (!prova?.id) return;

      setActionError(null);
      setSuccessMessage(null);

      try {
        await deleteDocumento(prova.id, documentoId, motivo);
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
        await refetch();
        setHistoricoVersao((versao) => versao + 1);
        setSuccessMessage("Arquivo excluído com sucesso.");
      } catch (err) {
        console.error(
          "Arquivo excluído, mas não foi possível atualizar a prova:",
          err,
        );
        setActionError(MENSAGEM_ARQUIVO_EXCLUIDO_SEM_ATUALIZAR);
      }
    },
    [deleteDocumento, prova?.id, refetch],
  );

  const handleEnviarParaAnalise = useCallback(async () => {
    if (!prova?.id) return;

    setActionError(null);
    setSuccessMessage(null);

    try {
      await enviarParaAnalise(prova.id);
      await refetch();
      setSuccessMessage("Prova enviada para análise pedagógica.");
    } catch (err) {
      setActionError(
        obterMensagemErro(
          err,
          "Não foi possível enviar a prova para análise. Tente novamente.",
        ),
      );
    }
  }, [enviarParaAnalise, prova?.id, refetch]);

  if (loadingProva && !prova) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Carregando prova...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !prova) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar prova</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!prova) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Prova nao encontrada</AlertTitle>
          <AlertDescription>
            A prova solicitada nao foi encontrada ou voce nao tem permissao para
            acessa-la.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const documentosAdaptados: PlanoDocumento[] = prova.documentos.map(
    adaptarDocumentoProvaParaDocumentoList,
  );
  const podeEnviarParaAnalise = prova.status === "AGUARDANDO_IMPRESSAO";
  const documentosImprimiveis = prova.documentos.filter(
    (documento) => documento.tipo !== "LINK_YOUTUBE",
  );
  const documentosImpressos = documentosImprimiveis.filter(
    (documento) => !!documento.printedAt,
  );
  const documentosPendentesImpressao =
    documentosImprimiveis.length - documentosImpressos.length;
  const podeAvancarParaAnalise =
    podeEnviarParaAnalise && documentosPendentesImpressao === 0;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <Link
          href="/provas/gestao/provas"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Provas
        </Link>
      </div>

      <ProvaHeader
        professorName={prova.user?.name || prova.professorName || ""}
        turmaName={prova.turma?.name || prova.turmaName || ""}
        turmaCode={prova.turma?.code || prova.turmaCode}
        cicloNumero={prova.ciclo?.numero}
        cicloDescricao={prova.ciclo?.descricao}
        cicloInicio={prova.ciclo?.dataInicio}
        cicloFim={prova.ciclo?.dataFim}
        prazoEntrega={prova.ciclo?.dataMaximaEntrega}
        status={prova.status}
        submittedAt={prova.submittedAt}
      />

      {successMessage && (
        <Alert className="mb-6 border-green-400 bg-green-50">
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
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Printer className="h-5 w-5" />
                Documentos da Prova
              </CardTitle>
              <CardDescription>
                Visualize e registre a impressao dos documentos enviados pela
                professora.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentoList
                documentos={documentosAdaptados}
                onImprimir={handleImprimirDocumento}
                onDelete={handleExcluirDocumento}
                canDelete={true}
                canAprovar={false}
                canEdit={false}
                canComentar={false}
                permitirImpressaoSemAprovacao={podeEnviarParaAnalise}
                modulo="prova"
              />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Fluxo de Impressao</CardTitle>
              <CardDescription>
                Depois de imprimir todos os documentos, envie a prova para
                análise pedagógica.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {podeEnviarParaAnalise ? (
                <>
                  {documentosPendentesImpressao > 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Imprima todos os documentos para enviar à análise.
                        Faltam {documentosPendentesImpressao} de{" "}
                        {documentosImprimiveis.length}.
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  <Button
                    className="w-full gap-2"
                    onClick={handleEnviarParaAnalise}
                    disabled={loadingGestao || !podeAvancarParaAnalise}
                  >
                    {loadingGestao ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Enviar para Análise
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Esta prova nao esta aguardando impressao.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Histórico da prova</CardTitle>
            </CardHeader>
            <CardContent>
              <HistoricoTimeline
                key={historicoVersao}
                planoId={prova.id}
                modulo="prova"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
