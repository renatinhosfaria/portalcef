"use client";

/**
 * RevisaoContent Component
 * Client component para a pagina de revisao da analista pedagogica
 * Task 4.3: Criar pagina onde a analista revisa e aprova/devolve um plano
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  FileText,
  Loader2,
  Plus,
  RotateCcw,
  Send,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  DocumentoList,
  DocumentoUpload,
  HistoricoTimeline,
  PlanoHeader,
  useAnalistaActions,
  usePeriodoData,
  usePlanoAula,
  usePlanoDetalhe,
} from "../../../features/plano-aula";

import { TarefaForm } from "./tarefa-form";

interface RevisaoContentProps {
  planoId: string;
}

export function RevisaoContent({ planoId }: RevisaoContentProps) {
  const router = useRouter();
  const {
    loading: loadingPlano,
    plano,
    error,
    fetchPlano,
    refetch,
  } = usePlanoDetalhe();
  const { loading: loadingAction, aprovar, devolver } = useAnalistaActions();
  const { uploadDocumento, addLink, aprovarDocumento, desaprovarDocumento, imprimirDocumento, editarComentario, deletarComentario } =
    usePlanoAula();

  // Buscar dados do período para exibir no header
  const { periodo: periodoData, etapaNome, isLoading: isLoadingPeriodo } = usePeriodoData(plano?.quinzenaId);

  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [isTarefaFormOpen, setIsTarefaFormOpen] = useState(false);

  // Carrega o usuario atual
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await api.get<{ user: { id: string } }>("/auth/me");
        setCurrentUserId(response.user.id);
      } catch (err) {
        console.error("Erro ao buscar usuario atual:", err);
      }
    };
    fetchCurrentUser();
  }, []);

  // Carrega o plano na montagem
  useEffect(() => {
    fetchPlano(planoId);
  }, [planoId, fetchPlano]);

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
      refetch();
    }, 3000); // Poll a cada 3 segundos

    return () => clearInterval(interval);
  }, [plano?.documentos, refetch]);

  /**
   * Adiciona comentario a um documento via API
   */
  const handleAddComentarioViaApi = useCallback(
    async (documentoId: string, comentario: string) => {
      try {
        await api.post("/plano-aula/comentarios", {
          documentoId,
          comentario,
        });
        // Recarregar plano para mostrar novo comentario
        await refetch();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao adicionar comentario";
        setActionError(message);
      }
    },
    [refetch],
  );

  /**
   * Edita um comentario existente
   */
  const handleEditComentario = useCallback(
    async (comentarioId: string, novoTexto: string) => {
      try {
        await editarComentario(comentarioId, novoTexto);
        // Recarregar plano para mostrar comentario atualizado
        await refetch();
        setSuccessMessage("Comentário editado com sucesso!");
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao editar comentário";
        setActionError(message);
      }
    },
    [editarComentario, refetch],
  );

  /**
   * Deleta um comentario
   */
  const handleDeleteComentario = useCallback(
    async (comentarioId: string) => {
      try {
        await deletarComentario(comentarioId);
        // Recarregar plano para atualizar lista de comentarios
        await refetch();
        setSuccessMessage("Comentário deletado com sucesso!");
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao deletar comentário";
        setActionError(message);
      }
    },
    [deletarComentario, refetch],
  );

  /**
   * Aprova um documento individualmente
   */
  const handleAprovarDocumento = useCallback(
    async (documentoId: string) => {
      try {
        await aprovarDocumento(documentoId);
        // Recarregar plano para mostrar aprovacao
        await refetch();
        setSuccessMessage("Documento aprovado com sucesso!");
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao aprovar documento";
        setActionError(message);
      }
    },
    [aprovarDocumento, refetch],
  );

  /**
   * Desfaz a aprovação de um documento
   */
  const handleDesaprovarDocumento = useCallback(
    async (documentoId: string) => {
      try {
        await desaprovarDocumento(documentoId);
        await refetch();
        setSuccessMessage("Aprovação do documento desfeita!");
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao desfazer aprovação do documento";
        setActionError(message);
      }
    },
    [desaprovarDocumento, refetch],
  );

  /**
   * Imprime um documento aprovado e registra no histórico
   */
  const handleImprimirDocumento = useCallback(
    async (documentoId: string) => {
      try {
        await imprimirDocumento(documentoId);
        await refetch();
        setSuccessMessage("Documento impresso e registrado no histórico!");
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao imprimir documento";
        setActionError(message);
      }
    },
    [imprimirDocumento, refetch],
  );

  /**
   * Upload de documento pela analista
   */
  const handleUploadDocumento = useCallback(
    async (file: File) => {
      if (!plano) return;
      try {
        await uploadDocumento(plano.id, file);
        await refetch();
        setSuccessMessage("Documento enviado com sucesso!");
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao enviar documento";
        setActionError(message);
      }
    },
    [plano, uploadDocumento, refetch],
  );

  /**
   * Adicionar link YouTube pela analista
   */
  const handleAddLink = useCallback(
    async (url: string) => {
      if (!plano) return;
      try {
        await addLink(plano.id, url);
        await refetch();
        setSuccessMessage("Link adicionado com sucesso!");
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao adicionar link";
        setActionError(message);
      }
    },
    [plano, addLink, refetch],
  );

  /**
   * Aprova o plano e envia para a coordenacao
   */
  const handleAprovar = useCallback(async () => {
    setActionError(null);
    setSuccessMessage(null);

    try {
      await aprovar(planoId);
      setSuccessMessage("Plano aprovado com sucesso!");
      // Redirecionar apos 2 segundos
      setTimeout(() => {
        router.push("/analise");
      }, 2000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao aprovar plano";
      setActionError(message);
    }
  }, [planoId, aprovar, router]);

  /**
   * Devolve o plano para a professora
   * Os comentarios devem ser adicionados via painel flutuante antes de devolver
   */
  const handleDevolver = useCallback(async () => {
    setActionError(null);
    setSuccessMessage(null);

    try {
      await devolver(planoId);
      setSuccessMessage("Plano devolvido para a Professora!");
      // Redirecionar apos 2 segundos
      setTimeout(() => {
        router.push("/analise");
      }, 2000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao devolver plano";
      setActionError(message);
    }
  }, [planoId, devolver, router]);

  // Estado de carregamento
  if (loadingPlano && !plano) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando plano de aula...</p>
        </div>
      </div>
    );
  }

  // Erro ao carregar
  if (error && !plano) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <Link
            href="/analise"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Lista de Analise
          </Link>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar plano</AlertTitle>
          <AlertDescription>
            {error}
            <Button
              variant="link"
              className="h-auto p-0 pl-2"
              onClick={() => fetchPlano(planoId)}
            >
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Plano nao encontrado
  if (!plano) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <Link
            href="/analise"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Lista de Analise
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Plano nao encontrado</h1>
          <p className="text-muted-foreground">
            O plano de aula solicitado nao foi encontrado ou voce nao tem
            permissao para acessa-lo.
          </p>
        </div>
      </div>
    );
  }

  const isLoading = loadingPlano || loadingAction;
  const canPerformActions =
    !isLoading && plano.status === "AGUARDANDO_ANALISTA";

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Back Button */}
      <div className="mb-6">
        <Link
          href="/analise"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Lista de Analise
        </Link>
      </div>

      {/* Header Info */}
      <PlanoHeader
        professorName={plano.professorName}
        turmaName={plano.turmaName}
        turmaCode={plano.turmaCode}
        periodoNumero={periodoData?.numero}
        periodoDescricao={periodoData?.descricao}
        periodoInicio={periodoData?.dataInicio}
        periodoFim={periodoData?.dataFim}
        prazoEntrega={periodoData?.dataMaximaEntrega}
        etapaNome={etapaNome ?? undefined}
        status={plano.status}
        submittedAt={plano.submittedAt}
        isLoadingPeriodo={isLoadingPeriodo}
      />

      {/* Success Message */}
      {successMessage && (
        <Alert className="mb-6 border-green-400 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Sucesso!</AlertTitle>
          <AlertDescription className="text-green-700">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Error Message */}
      {actionError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Documentos - 2 colunas */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                Documentos Anexados
              </CardTitle>
              <CardDescription>
                Revise os documentos enviados pela professora. Voce pode
                adicionar comentarios aos documentos antes de devolver o plano.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentoList
                documentos={plano.documentos}
                showComments={true}
                canDelete={false}
                canAprovar={true}
                onAddComentario={handleAddComentarioViaApi}
                onEditComentario={handleEditComentario}
                onDeleteComentario={handleDeleteComentario}
                onAprovar={handleAprovarDocumento}
                onDesaprovar={handleDesaprovarDocumento}
                onImprimir={handleImprimirDocumento}
                currentUserId={currentUserId}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - 1 coluna */}
        <div className="space-y-6">
          {/* Historico */}
          <HistoricoTimeline planoId={planoId} />

          {/* Acoes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Acoes</CardTitle>
              <CardDescription>
                {canPerformActions
                  ? "Revise o plano e escolha uma acao abaixo."
                  : "Este plano nao esta aguardando sua analise."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {canPerformActions ? (
                <>
                  {/* Botao Aprovar */}
                  <Button
                    onClick={handleAprovar}
                    disabled={isLoading}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    {loadingAction ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Aprovar Plano de Aula
                      </>
                    )}
                  </Button>

                  {/* Botao Devolver */}
                  <Button
                    onClick={handleDevolver}
                    disabled={isLoading}
                    variant="outline"
                    className="w-full border-yellow-400 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 hover:text-yellow-800"
                  >
                    {loadingAction ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Devolver para Professora
                      </>
                    )}
                  </Button>

                  {/* Botao Criar Tarefa */}
                  <Button
                    onClick={() => setIsTarefaFormOpen(true)}
                    disabled={isLoading}
                    variant="outline"
                    className="w-full border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Criar Tarefa vinculada ao Plano
                  </Button>

                  {/* Aviso sobre comentarios */}
                  <p className="text-xs text-muted-foreground text-center">
                    Adicione comentarios aos documentos via painel flutuante
                    antes de devolver.
                  </p>
                </>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Este plano nao esta no status &quot;Aguardando
                    Analise&quot;. Nenhuma acao disponivel.
                  </AlertDescription>
                </Alert>
              )}

              {/* Upload de documento pela analista */}
              <div className="mt-4 rounded-lg border-2 border-indigo-200 bg-indigo-50/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="rounded-md bg-indigo-100 p-1.5">
                    <Upload className="h-4 w-4 text-indigo-600" />
                  </div>
                  <p className="text-sm font-semibold text-indigo-900">
                    Enviar Documento Corrigido
                  </p>
                </div>
                <p className="text-xs text-indigo-600/80 mb-3">
                  Envie a versao corrigida do documento diretamente ao plano.
                </p>
                <DocumentoUpload
                  onUpload={handleUploadDocumento}
                  onAddLink={handleAddLink}
                  disabled={!plano}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <TarefaForm
        isOpen={isTarefaFormOpen}
        onClose={() => setIsTarefaFormOpen(false)}
        initialContexts={{
          quinzenaId: plano?.quinzenaId,
          etapaId: plano?.stageId,
          turmaId: plano?.turmaId,
          professoraId: plano?.userId,
        }}
      />
    </div>
  );
}
