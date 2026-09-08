"use client";

import type { HistoricoEntry } from "@essencia/shared/types";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@essencia/ui/components/alert";
import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@essencia/ui/components/tabs";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  History,
  Loader2,
  MessageSquare,
  Send,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  DocumentoUpload,
  DocumentoList,
  type PlanoDocumento,
} from "../../../features/plano-aula";
import {
  STATUS_LABELS,
  type Relatorio,
  type RelatorioDocumento,
  type RelatorioStatus,
  useRelatorio,
} from "../../../features/relatorio";
import { obterMensagemErro } from "../../../lib/mensagens-erro";

interface RelatorioContentProps {
  semestreId: string;
  turmaId: string | null;
}

const MENSAGEM_ERRO_ATUALIZAR_RELATORIO_APOS_EXCLUSAO =
  "O arquivo foi excluído, mas não foi possível atualizar o relatório e o histórico agora. Atualize a página para conferir.";

function canEdit(status: RelatorioStatus): boolean {
  return [
    "RASCUNHO",
    "RECUPERADO",
    "DEVOLVIDO_ANALISTA",
    "DEVOLVIDO_COORDENADORA",
  ].includes(status);
}

function isDevolvido(status: RelatorioStatus): boolean {
  return ["DEVOLVIDO_ANALISTA", "DEVOLVIDO_COORDENADORA"].includes(status);
}

function adaptarDocumento(documento: RelatorioDocumento): PlanoDocumento {
  return {
    ...documento,
    planoId: documento.relatorioId,
    storageKey: documento.storageKey ?? undefined,
    url: documento.url ?? undefined,
    fileSize: documento.fileSize ?? undefined,
    sharepointItemId: documento.sharepointItemId ?? undefined,
    sharepointEditUrl: documento.sharepointEditUrl ?? undefined,
    editandoDesde: documento.editandoDesde ?? undefined,
    pdfStorageKey: documento.pdfStorageKey ?? undefined,
    pdfUrl: documento.pdfUrl ?? undefined,
    pdfError: documento.pdfError ?? undefined,
    pdfRequestedAt: documento.pdfRequestedAt ?? undefined,
    pdfGeneratedAt: documento.pdfGeneratedAt ?? undefined,
    approvedBy: documento.approvedBy ?? undefined,
    approvedAt: documento.approvedAt ?? undefined,
    printedBy: documento.printedBy ?? undefined,
    printedAt: documento.printedAt ?? undefined,
    pdfStatus: documento.pdfStatus,
    temComentarios: documento.temComentarios,
  };
}

function HistoricoRelatorio({ historico }: { historico: HistoricoEntry[] }) {
  if (historico.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum registro de histórico encontrado.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {historico.map((item) => (
        <div key={item.id} className="rounded-md border p-3">
          <p className="text-sm font-medium">{item.acao}</p>
          <p className="text-xs text-muted-foreground">
            {item.userName} • {item.statusNovo}
          </p>
        </div>
      ))}
    </div>
  );
}

export function RelatorioContent({
  semestreId,
  turmaId,
}: RelatorioContentProps) {
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [historico, setHistorico] = useState<HistoricoEntry[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    loading: actionLoading,
    criarRelatorio,
    getRelatorio,
    getHistorico,
    uploadDocumento,
    addLink,
    deleteDocumento,
    submeterRelatorio,
    recuperarRelatorio,
  } = useRelatorio();

  const carregarHistorico = useCallback(
    async (relatorioId: string, propagarErro = false) => {
      try {
        setHistorico(await getHistorico(relatorioId));
      } catch (err) {
        setHistorico([]);
        if (propagarErro) {
          throw new Error(MENSAGEM_ERRO_ATUALIZAR_RELATORIO_APOS_EXCLUSAO, {
            cause: err,
          });
        }
      }
    },
    [getHistorico],
  );

  const refetchRelatorio = useCallback(async (propagarErroHistorico = false) => {
    if (!relatorio?.id) return;
    const atualizado = await getRelatorio(relatorio.id);
    setRelatorio(atualizado);
    await carregarHistorico(atualizado.id, propagarErroHistorico);
  }, [carregarHistorico, getRelatorio, relatorio?.id]);

  const carregarOuCriarRelatorio = useCallback(async () => {
    if (!turmaId) {
      setInitialLoading(false);
      return;
    }

    try {
      setInitialLoading(true);
      const criado = await criarRelatorio(turmaId, semestreId, semestreId);
      const detalhe = await getRelatorio(criado.id);
      setRelatorio(detalhe);
      await carregarHistorico(detalhe.id);
      setError(null);
    } catch (err) {
      setError(
        obterMensagemErro(
          err,
          "Não foi possível carregar o relatório. Tente novamente.",
        ),
      );
    } finally {
      setInitialLoading(false);
    }
  }, [carregarHistorico, criarRelatorio, getRelatorio, semestreId, turmaId]);

  useEffect(() => {
    void carregarOuCriarRelatorio();
  }, [carregarOuCriarRelatorio]);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!relatorio?.id) throw new Error("Relatório não encontrado");
      const documento = await uploadDocumento(relatorio.id, file);
      return adaptarDocumento(documento);
    },
    [relatorio?.id, uploadDocumento],
  );

  const handleAddLink = useCallback(
    async (url: string) => {
      if (!relatorio?.id) return;
      await addLink(relatorio.id, url);
      await refetchRelatorio();
    },
    [addLink, refetchRelatorio, relatorio?.id],
  );

  const handleExcluirDocumento = useCallback(
    async (documentoId: string, motivo: string) => {
      if (!relatorio?.id) return;

      setError(null);
      setSuccessMessage(null);
      try {
        await deleteDocumento(relatorio.id, documentoId, motivo);
        await refetchRelatorio(true);
        setSuccessMessage("Arquivo excluído com sucesso.");
      } catch (err) {
        setError(
          obterMensagemErro(
            err,
            MENSAGEM_ERRO_ATUALIZAR_RELATORIO_APOS_EXCLUSAO,
          ),
        );
        throw err;
      }
    },
    [deleteDocumento, refetchRelatorio, relatorio?.id],
  );

  const handleSubmit = useCallback(async () => {
    if (!relatorio?.id) return;
    setSubmitting(true);
    try {
      await submeterRelatorio(relatorio.id);
      await refetchRelatorio();
    } catch (err) {
      setError(
        obterMensagemErro(
          err,
          "Não foi possível enviar o relatório para análise. Tente novamente.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }, [refetchRelatorio, relatorio?.id, submeterRelatorio]);

  const handleRecuperar = useCallback(async () => {
    if (!relatorio?.id) return;
    setRecuperando(true);
    try {
      await recuperarRelatorio(relatorio.id);
      await refetchRelatorio();
    } catch (err) {
      setError(
        obterMensagemErro(
          err,
          "Não foi possível recuperar o relatório. Tente novamente.",
        ),
      );
    } finally {
      setRecuperando(false);
    }
  }, [recuperarRelatorio, refetchRelatorio, relatorio?.id]);

  if (initialLoading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Carregando relatório...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!turmaId) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Turma não informada</AlertTitle>
          <AlertDescription>
            Volte para a seleção de turmas e escolha uma turma válida.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error && !relatorio) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!relatorio) {
    return null;
  }

  const isEditable = canEdit(relatorio.status);
  const hasDocuments = relatorio.documentos.length > 0;
  const canSubmit = isEditable && hasDocuments && !actionLoading && !submitting;

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      {successMessage && (
        <Alert className="border-green-400 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Sucesso</AlertTitle>
          <AlertDescription className="text-green-700">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {error && relatorio && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Não foi possível concluir a ação</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Relatório Semestral
        </h1>
        <p className="text-muted-foreground">
          {relatorio.turma?.name || relatorio.turmaName || "Turma"} •{" "}
          {STATUS_LABELS[relatorio.status]}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Status do Relatório
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isDevolvido(relatorio.status) && (
            <Alert className="border-yellow-400 bg-yellow-50">
              <MessageSquare className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800">
                Ajustes solicitados
              </AlertTitle>
              <AlertDescription className="text-yellow-700">
                Verifique os comentários nos documentos e reenvie o relatório.
              </AlertDescription>
            </Alert>
          )}

          {relatorio.status === "APROVADO" && (
            <Alert className="border-green-400 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">
                Relatório aprovado
              </AlertTitle>
              <AlertDescription className="text-green-700">
                O relatório foi aprovado pela coordenação.
              </AlertDescription>
            </Alert>
          )}

          {relatorio.status === "AGUARDANDO_ANALISTA" && (
            <Button
              variant="outline"
              className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={handleRecuperar}
              disabled={recuperando}
            >
              {recuperando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Recuperando...
                </>
              ) : (
                <>
                  <Undo2 className="h-4 w-4" />
                  Recuperar Relatório
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="documentos">
            <TabsList>
              <TabsTrigger value="documentos">
                <FileText className="mr-2 h-4 w-4" />
                Documentos
              </TabsTrigger>
              <TabsTrigger value="historico">
                <History className="mr-2 h-4 w-4" />
                Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="documentos" className="space-y-6">
              {isEditable && (
                <DocumentoUpload
                  onUpload={handleUpload}
                  onAddLink={handleAddLink}
                  onAllUploadsComplete={refetchRelatorio}
                  disabled={actionLoading}
                />
              )}

              <DocumentoList
                documentos={relatorio.documentos.map(adaptarDocumento)}
                onDelete={handleExcluirDocumento}
                canDelete={true}
                modulo="plano-aula"
              />
            </TabsContent>

            <TabsContent value="historico">
              <HistoricoRelatorio historico={historico} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {isEditable && (
        <Card>
          <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-end">
            {!hasDocuments && (
              <p className="text-sm text-muted-foreground">
                Anexe pelo menos um documento para enviar o relatório.
              </p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="gap-2"
            >
              {submitting ? (
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
