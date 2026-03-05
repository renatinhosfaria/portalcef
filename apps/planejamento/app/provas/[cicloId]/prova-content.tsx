"use client";

/**
 * ProvaDetailContent - Client Component para gerenciamento da Prova
 * Espelha o PlanoContent adaptado para o fluxo de provas
 */

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@essencia/ui/components/alert";
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
  ClipboardCheck,
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
  HistoricoTimeline,
  PlanoStatusBadge,
  type PlanoDocumento,
} from "../../../features/plano-aula";
import type { PlanoAulaStatus } from "../../../features/plano-aula";

import {
  useProva,
  type Prova,
  type ProvaStatus,
} from "../../../features/prova";

interface ProvaDetailContentProps {
  cicloId: string;
  turmaId: string | null;
  userId: string | null;
}

/**
 * Verifica se o status permite edicao
 */
function canEdit(status: ProvaStatus): boolean {
  return ["RASCUNHO", "RECUPERADO", "DEVOLVIDO_ANALISTA", "DEVOLVIDO_COORDENADORA"].includes(
    status,
  );
}

/**
 * Verifica se o status e de devolucao
 */
function isDevolvido(status: ProvaStatus): boolean {
  return ["DEVOLVIDO_ANALISTA", "DEVOLVIDO_COORDENADORA"].includes(status);
}

/**
 * Obtem mensagem de feedback baseada no status
 */
function getFeedbackMessage(status: ProvaStatus): string | null {
  switch (status) {
    case "DEVOLVIDO_ANALISTA":
      return "Sua prova foi devolvida pela Analista Pedagogica com comentarios para ajustes. Verifique os comentarios nos documentos abaixo.";
    case "DEVOLVIDO_COORDENADORA":
      return "Sua prova foi devolvida pela Coordenadora com comentarios para ajustes. Verifique os comentarios nos documentos abaixo.";
    default:
      return null;
  }
}

export function ProvaDetailContent({
  cicloId,
  turmaId,
  userId,
}: ProvaDetailContentProps) {
  const [prova, setProva] = useState<Prova | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showRecuperarDialog, setShowRecuperarDialog] = useState(false);
  const [recuperando, setRecuperando] = useState(false);

  const {
    loading: actionLoading,
    criarProva,
    getProva,
    uploadDocumento,
    addLink,
    imprimirDocumento,
    submeterProva,
    recuperarProva,
  } = useProva();

  /**
   * Carrega ou cria a prova para o ciclo
   */
  const loadOrCreateProva = useCallback(async () => {
    if (!turmaId || !userId) {
      setInitialLoading(false);
      return;
    }

    try {
      const result = await criarProva(turmaId, cicloId);
      const provaDetalhe = await getProva(result.id);
      setProva(provaDetalhe);
      setError(null);
    } catch (err) {
      console.error("Erro ao carregar prova:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar prova. Tente novamente.",
      );
    } finally {
      setInitialLoading(false);
    }
  }, [turmaId, userId, cicloId, criarProva, getProva]);

  /**
   * Recarrega os dados da prova
   */
  const refetchProva = useCallback(async () => {
    if (!prova?.id) return;

    try {
      const provaAtualizada = await getProva(prova.id);
      setProva(provaAtualizada);
    } catch (err) {
      console.error("Erro ao recarregar prova:", err);
    }
  }, [prova?.id, getProva]);

  /**
   * Handler para upload de arquivo
   * Retorna o resultado adaptado para PlanoDocumento (compatibilidade com DocumentoUpload)
   */
  const handleUpload = useCallback(
    async (file: File): Promise<PlanoDocumento> => {
      if (!prova?.id) throw new Error("Prova não encontrada");

      const result = await uploadDocumento(prova.id, file);
      return { ...result, planoId: result.provaId } as unknown as PlanoDocumento;
    },
    [prova?.id, uploadDocumento],
  );

  /**
   * Handler para adicionar link do YouTube
   */
  const handleAddLink = useCallback(
    async (url: string) => {
      if (!prova?.id) return;

      try {
        await addLink(prova.id, url);
        await refetchProva();
      } catch (err) {
        console.error("Erro ao adicionar link:", err);
        throw err;
      }
    },
    [prova?.id, addLink, refetchProva],
  );

  /**
   * Handler para imprimir documento aprovado
   */
  const handleImprimirDocumento = useCallback(
    async (documentoId: string) => {
      try {
        await imprimirDocumento(documentoId);
        await refetchProva();
      } catch (err) {
        console.error("Erro ao imprimir documento:", err);
        throw err;
      }
    },
    [imprimirDocumento, refetchProva],
  );

  /**
   * Handler para submeter prova para analise
   */
  const handleSubmit = useCallback(async () => {
    if (!prova?.id) return;

    setSubmitting(true);
    try {
      await submeterProva(prova.id);
      await refetchProva();
    } catch (err) {
      console.error("Erro ao submeter prova:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao enviar prova. Tente novamente.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [prova?.id, submeterProva, refetchProva]);

  /**
   * Handler para recuperar prova da fila de analise
   */
  const handleRecuperar = useCallback(async () => {
    if (!prova?.id) return;
    setRecuperando(true);
    try {
      await recuperarProva(prova.id);
      await refetchProva();
      setShowRecuperarDialog(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao recuperar prova. Tente novamente.",
      );
    } finally {
      setRecuperando(false);
    }
  }, [prova?.id, recuperarProva, refetchProva]);

  // Carrega a prova na montagem do componente
  useEffect(() => {
    loadOrCreateProva();
  }, [loadOrCreateProva]);

  /**
   * Polling para atualizar preview de documentos em conversao
   */
  useEffect(() => {
    if (!prova?.documentos) return;

    const temDocumentosPendentes = prova.documentos.some(
      (doc) => doc.previewStatus === "PENDENTE",
    );

    if (!temDocumentosPendentes) return;

    const interval = setInterval(() => {
      refetchProva();
    }, 3000);

    return () => clearInterval(interval);
  }, [prova?.documentos, refetchProva]);

  // Estado de carregamento inicial
  if (initialLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando prova...</p>
        </CardContent>
      </Card>
    );
  }

  // Erro ou falta de dados
  if (!turmaId || !userId) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erro de configuracao</AlertTitle>
        <AlertDescription>
          Nao foi possivel identificar sua turma ou usuario. Entre em contato
          com a coordenacao.
        </AlertDescription>
      </Alert>
    );
  }

  // Erro ao carregar
  if (error && !prova) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erro ao carregar</AlertTitle>
        <AlertDescription>
          {error}
          <Button
            variant="link"
            className="h-auto p-0 pl-2"
            onClick={loadOrCreateProva}
          >
            Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!prova) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Prova nao encontrada</AlertTitle>
        <AlertDescription>
          Nao foi possivel criar ou carregar a prova para este ciclo.
        </AlertDescription>
      </Alert>
    );
  }

  const isEditable = canEdit(prova.status);
  const showFeedback = isDevolvido(prova.status);
  const feedbackMessage = getFeedbackMessage(prova.status);
  const hasDocuments = prova.documentos.length > 0;
  const canSubmit = isEditable && hasDocuments && !actionLoading && !submitting;

  // Adaptar documentos da prova para o formato esperado pelo DocumentoList (PlanoDocumento)
  const documentosAdaptados: PlanoDocumento[] = prova.documentos.map((doc) => ({
    ...doc,
    planoId: doc.provaId,
  } as unknown as PlanoDocumento));

  return (
    <div className="space-y-6">
      {/* Status Section */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="h-5 w-5" />
              Status da Prova
            </CardTitle>
            <PlanoStatusBadge status={prova.status as PlanoAulaStatus} />
          </div>
        </CardHeader>

        {/* Feedback Alert para status DEVOLVIDO */}
        {showFeedback && feedbackMessage && (
          <CardContent className="pt-0">
            <Alert variant="default" className="border-yellow-400 bg-yellow-50">
              <MessageSquare className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800">
                Ajustes Solicitados
              </AlertTitle>
              <AlertDescription className="text-yellow-700">
                {feedbackMessage}
              </AlertDescription>
            </Alert>
          </CardContent>
        )}

        {/* Status Aprovado */}
        {prova.status === "APROVADO" && (
          <CardContent className="pt-0">
            <Alert variant="default" className="border-green-400 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">
                Prova Aprovada!
              </AlertTitle>
              <AlertDescription className="text-green-700">
                Sua prova foi aprovada pela coordenacao.
                {prova.approvedAt &&
                  ` Data da aprovacao: ${new Date(prova.approvedAt).toLocaleDateString("pt-BR")}`}
              </AlertDescription>
            </Alert>
          </CardContent>
        )}

        {/* Status Aguardando */}
        {(prova.status === "AGUARDANDO_ANALISTA" ||
          prova.status === "AGUARDANDO_COORDENADORA") && (
          <CardContent className="pt-0">
            <Alert variant="default" className="border-blue-400 bg-blue-50">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <AlertTitle className="text-blue-800">Em Analise</AlertTitle>
              <AlertDescription className="text-blue-700">
                {prova.status === "AGUARDANDO_ANALISTA"
                  ? "Sua prova esta aguardando analise da Analista Pedagogica."
                  : "Sua prova esta aguardando aprovacao da Coordenadora."}
              </AlertDescription>
            </Alert>
            {prova.status === "AGUARDANDO_ANALISTA" && prova.user?.id === userId && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => setShowRecuperarDialog(true)}
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
                      Recuperar Prova
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Documents and History Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardCheck className="h-5 w-5" />
            Prova
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="documentos">
            <TabsList>
              <TabsTrigger value="documentos">
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Documentos
              </TabsTrigger>
              <TabsTrigger value="historico">
                <History className="h-4 w-4 mr-2" />
                Historico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="documentos" className="space-y-6">
              {/* Upload Area */}
              {isEditable && (
                <DocumentoUpload
                  onUpload={handleUpload}
                  onAddLink={handleAddLink}
                  onAllUploadsComplete={refetchProva}
                  disabled={actionLoading}
                />
              )}

              {/* Lista de Documentos */}
              <DocumentoList
                documentos={documentosAdaptados}
                onImprimir={handleImprimirDocumento}
                canDelete={false}
              />
            </TabsContent>

            <TabsContent value="historico">
              <HistoricoTimeline planoId={prova.id} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {isEditable && (
        <Card>
          <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-end">
            {/* Erro de submissao */}
            {error && (
              <Alert variant="destructive" className="mb-0 flex-1">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
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
                    {isDevolvido(prova.status)
                      ? "Reenviar para Analise"
                      : "Enviar para Analise"}
                  </>
                )}
              </Button>
            </div>

            {!hasDocuments && (
              <p className="text-sm text-muted-foreground">
                Anexe pelo menos um documento para enviar a prova.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showRecuperarDialog} onOpenChange={setShowRecuperarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recuperar Prova?</AlertDialogTitle>
            <AlertDialogDescription>
              A prova sera retirada da fila de analise e voltara para edicao.
              Voce precisara envia-la novamente quando estiver pronta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRecuperar} disabled={recuperando}>
              {recuperando ? "Recuperando..." : "Recuperar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
