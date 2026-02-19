"use client";

/**
 * PlanoContent - Client Component para gerenciamento do Plano de Aula
 * Task 23: Atualizado para usar periodoId (UUID) ao invés de quinzenaId (número)
 */

import { api } from "@essencia/shared/fetchers/client";
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
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  DocumentoUpload,
  DocumentoList,
  HistoricoTimeline,
  PlanoStatusBadge,
  usePlanoAula,
  type PlanoAula,
  type PlanoAulaStatus,
} from "../../../features/plano-aula";

interface ComentarioApiPayload {
  documentoId: string;
  comentario: string;
}

interface PlanoContentProps {
  periodoId: string; // UUID do período (não mais número hardcoded)
  turmaId: string | null;
  userId: string | null;
}

/**
 * Verifica se o status permite edicao (upload/delete de documentos)
 */
function canEdit(status: PlanoAulaStatus): boolean {
  return ["RASCUNHO", "DEVOLVIDO_ANALISTA", "DEVOLVIDO_COORDENADORA"].includes(
    status,
  );
}

/**
 * Verifica se o status e de devolucao (mostrar comentarios)
 */
function isDevolvido(status: PlanoAulaStatus): boolean {
  return ["DEVOLVIDO_ANALISTA", "DEVOLVIDO_COORDENADORA"].includes(status);
}

/**
 * Obtem mensagem de feedback baseada no status
 */
function getFeedbackMessage(status: PlanoAulaStatus): string | null {
  switch (status) {
    case "DEVOLVIDO_ANALISTA":
      return "Seu plano de aula foi devolvido pela Analista Pedagogica com comentarios para ajustes. Verifique os comentarios nos documentos abaixo.";
    case "DEVOLVIDO_COORDENADORA":
      return "Seu plano de aula foi devolvido pela Coordenadora com comentarios para ajustes. Verifique os comentarios nos documentos abaixo.";
    default:
      return null;
  }
}

export function PlanoContent({
  periodoId,
  turmaId,
  userId,
}: PlanoContentProps) {
  const [plano, setPlano] = useState<PlanoAula | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    loading: actionLoading,
    criarPlano,
    getPlano,
    uploadDocumento,
    addLink,
    imprimirDocumento,
    submeterPlano,
  } = usePlanoAula();

  /**
   * Carrega ou cria o plano de aula para o período
   */
  const loadOrCreatePlano = useCallback(async () => {
    if (!turmaId || !userId) {
      setInitialLoading(false);
      return;
    }

    try {
      // Primeiro, tenta criar o plano (a API retorna o existente se ja houver)
      // Agora usa periodoId (UUID) ao invés de quinzenaNumero
      const result = await criarPlano(turmaId, periodoId);

      // Depois busca os detalhes completos
      const planoDetalhe = await getPlano(result.id);
      setPlano(planoDetalhe);
      setError(null);
    } catch (err) {
      console.error("Erro ao carregar plano:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar plano de aula. Tente novamente.",
      );
    } finally {
      setInitialLoading(false);
    }
  }, [turmaId, userId, periodoId, criarPlano, getPlano]);

  /**
   * Recarrega os dados do plano
   */
  const refetchPlano = useCallback(async () => {
    if (!plano?.id) return;

    try {
      const planoAtualizado = await getPlano(plano.id);
      setPlano(planoAtualizado);
    } catch (err) {
      console.error("Erro ao recarregar plano:", err);
    }
  }, [plano?.id, getPlano]);

  /**
   * Handler para upload de arquivo
   */
  const handleUpload = useCallback(
    async (file: File) => {
      if (!plano?.id) return;

      try {
        await uploadDocumento(plano.id, file);
        await refetchPlano();
      } catch (err) {
        console.error("Erro no upload:", err);
        throw err;
      }
    },
    [plano?.id, uploadDocumento, refetchPlano],
  );

  /**
   * Handler para adicionar link do YouTube
   */
  const handleAddLink = useCallback(
    async (url: string) => {
      if (!plano?.id) return;

      try {
        await addLink(plano.id, url);
        await refetchPlano();
      } catch (err) {
        console.error("Erro ao adicionar link:", err);
        throw err;
      }
    },
    [plano?.id, addLink, refetchPlano],
  );

  /**
   * Handler para adicionar comentário a um documento via API
   */
  const handleAddComentario = useCallback(
    async (documentoId: string, comentario: string) => {
      try {
        const payload: ComentarioApiPayload = { documentoId, comentario };
        await api.post("/plano-aula/comentarios", payload);
        await refetchPlano();
      } catch (err) {
        console.error("Erro ao adicionar comentário:", err);
        throw err;
      }
    },
    [refetchPlano],
  );

  /**
   * Handler para editar comentário existente
   */
  const handleEditComentario = useCallback(
    async (comentarioId: string, novoTexto: string) => {
      try {
        await api.patch(`/plano-aula/comentarios/${comentarioId}`, {
          comentario: novoTexto,
        });
        await refetchPlano();
      } catch (err) {
        console.error("Erro ao editar comentário:", err);
        throw err;
      }
    },
    [refetchPlano],
  );

  /**
   * Handler para deletar comentário
   */
  const handleDeleteComentario = useCallback(
    async (comentarioId: string) => {
      try {
        await api.delete(`/plano-aula/comentarios/${comentarioId}`);
        await refetchPlano();
      } catch (err) {
        console.error("Erro ao deletar comentário:", err);
        throw err;
      }
    },
    [refetchPlano],
  );

  /**
   * Handler para imprimir documento aprovado
   */
  const handleImprimirDocumento = useCallback(
    async (documentoId: string) => {
      try {
        await imprimirDocumento(documentoId);
        await refetchPlano();
      } catch (err) {
        console.error("Erro ao imprimir documento:", err);
        throw err;
      }
    },
    [imprimirDocumento, refetchPlano],
  );

  /**
   * Handler para submeter plano para analise
   */
  const handleSubmit = useCallback(async () => {
    if (!plano?.id) return;

    setSubmitting(true);
    try {
      await submeterPlano(plano.id);
      await refetchPlano();
    } catch (err) {
      console.error("Erro ao submeter plano:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao enviar plano. Tente novamente.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [plano?.id, submeterPlano, refetchPlano]);

  // Carrega o plano na montagem do componente
  useEffect(() => {
    loadOrCreatePlano();
  }, [loadOrCreatePlano]);

  /**
   * Polling para atualizar preview de documentos em conversao
   * Verifica a cada 3 segundos se ha documentos PENDENTE
   */
  useEffect(() => {
    if (!plano?.documentos) return;

    const temDocumentosPendentes = plano.documentos.some(
      (doc) => doc.previewStatus === "PENDENTE",
    );

    if (!temDocumentosPendentes) return;

    const interval = setInterval(() => {
      refetchPlano();
    }, 3000); // Poll a cada 3 segundos

    return () => clearInterval(interval);
  }, [plano?.documentos, refetchPlano]);

  // Estado de carregamento inicial
  if (initialLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando plano de aula...</p>
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
  if (error && !plano) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erro ao carregar</AlertTitle>
        <AlertDescription>
          {error}
          <Button
            variant="link"
            className="h-auto p-0 pl-2"
            onClick={loadOrCreatePlano}
          >
            Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Se nao ha plano (nao deveria acontecer apos criarPlano)
  if (!plano) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Plano nao encontrado</AlertTitle>
        <AlertDescription>
          Nao foi possivel criar ou carregar o plano de aula para este período.
        </AlertDescription>
      </Alert>
    );
  }

  const isEditable = canEdit(plano.status);
  const showFeedback = isDevolvido(plano.status);
  const feedbackMessage = getFeedbackMessage(plano.status);
  const hasDocuments = plano.documentos.length > 0;
  const canSubmit = isEditable && hasDocuments && !actionLoading && !submitting;

  return (
    <div className="space-y-6">
      {/* Status Section */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              Status do Plano de Aula
            </CardTitle>
            <PlanoStatusBadge status={plano.status} />
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
        {plano.status === "APROVADO" && (
          <CardContent className="pt-0">
            <Alert variant="default" className="border-green-400 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">
                Plano Aprovado!
              </AlertTitle>
              <AlertDescription className="text-green-700">
                Seu plano de aula foi aprovado pela coordenacao.
                {plano.approvedAt &&
                  ` Data da aprovacao: ${new Date(plano.approvedAt).toLocaleDateString("pt-BR")}`}
              </AlertDescription>
            </Alert>
          </CardContent>
        )}

        {/* Status Aguardando */}
        {(plano.status === "AGUARDANDO_ANALISTA" ||
          plano.status === "AGUARDANDO_COORDENADORA") && (
          <CardContent className="pt-0">
            <Alert variant="default" className="border-blue-400 bg-blue-50">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <AlertTitle className="text-blue-800">Em Analise</AlertTitle>
              <AlertDescription className="text-blue-700">
                {plano.status === "AGUARDANDO_ANALISTA"
                  ? "Seu plano esta aguardando analise da Analista Pedagogica."
                  : "Seu plano esta aguardando aprovacao da Coordenadora."}
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      {/* Documents and History Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Plano de Aula
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="documentos">
            <TabsList>
              <TabsTrigger value="documentos">
                <FileText className="h-4 w-4 mr-2" />
                Documentos
              </TabsTrigger>
              <TabsTrigger value="historico">
                <History className="h-4 w-4 mr-2" />
                Historico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="documentos" className="space-y-6">
              {/* Upload Area - somente se status permite edicao */}
              {isEditable && (
                <DocumentoUpload
                  onUpload={handleUpload}
                  onAddLink={handleAddLink}
                  disabled={actionLoading}
                />
              )}

              {/* Lista de Documentos */}
              {/* NOTA: Professoras NÃO podem excluir documentos após o upload */}
              <DocumentoList
                documentos={plano.documentos}
                onAddComentario={handleAddComentario}
                onEditComentario={handleEditComentario}
                onDeleteComentario={handleDeleteComentario}
                onImprimir={handleImprimirDocumento}
                showComments={showFeedback}
                canDelete={false}
                currentUserId={userId ?? undefined}
              />
            </TabsContent>

            <TabsContent value="historico">
              <HistoricoTimeline planoId={plano.id} />
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
              {/* Botao Enviar para Analise */}
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
                    {isDevolvido(plano.status)
                      ? "Reenviar para Analise"
                      : "Enviar para Analise"}
                  </>
                )}
              </Button>
            </div>

            {/* Aviso se nao tem documentos */}
            {!hasDocuments && (
              <p className="text-sm text-muted-foreground">
                Anexe pelo menos um documento para enviar o plano.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
