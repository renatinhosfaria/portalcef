"use client";

/**
 * RevisaoProvaContent Component
 * Client component para a pagina de revisao da analista pedagogica - Provas
 * Espelha o RevisaoContent adaptado para provas
 */

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
  ClipboardCheck,
  Loader2,
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
  type PlanoDocumento,
} from "../../../../features/plano-aula";

import {
  ProvaHeader,
  useAnalistaProvaActions,
  useProva,
  useProvaDetalhe,
} from "../../../../features/prova";

interface RevisaoProvaContentProps {
  provaId: string;
}

export function RevisaoProvaContent({ provaId }: RevisaoProvaContentProps) {
  const router = useRouter();
  const {
    loading: loadingProva,
    prova,
    error,
    fetchProva,
    refetch,
  } = useProvaDetalhe();
  const { loading: loadingAction, aprovar, devolver } = useAnalistaProvaActions();
  const { uploadDocumento, addLink, aprovarDocumento, desaprovarDocumento, imprimirDocumento } =
    useProva();

  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Carrega a prova na montagem
  useEffect(() => {
    fetchProva(provaId);
  }, [provaId, fetchProva]);

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
      refetch();
    }, 3000);

    return () => clearInterval(interval);
  }, [prova?.documentos, refetch]);

  /**
   * Aprova um documento individualmente
   */
  const handleAprovarDocumento = useCallback(
    async (documentoId: string) => {
      try {
        await aprovarDocumento(documentoId);
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
   * Desfaz a aprovacao de um documento
   */
  const handleDesaprovarDocumento = useCallback(
    async (documentoId: string) => {
      try {
        await desaprovarDocumento(documentoId);
        await refetch();
        setSuccessMessage("Aprovacao do documento desfeita!");
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao desfazer aprovacao do documento";
        setActionError(message);
      }
    },
    [desaprovarDocumento, refetch],
  );

  /**
   * Imprime um documento aprovado
   */
  const handleImprimirDocumento = useCallback(
    async (documentoId: string) => {
      try {
        await imprimirDocumento(documentoId);
        await refetch();
        setSuccessMessage("Documento impresso e registrado no historico!");
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
   * Retorna o resultado adaptado para PlanoDocumento (compatibilidade com DocumentoUpload)
   */
  const handleUploadDocumento = useCallback(
    async (file: File): Promise<PlanoDocumento> => {
      if (!prova) throw new Error("Prova não encontrada");

      const result = await uploadDocumento(prova.id, file);
      return { ...result, planoId: result.provaId } as unknown as PlanoDocumento;
    },
    [prova, uploadDocumento],
  );

  /**
   * Adicionar link YouTube pela analista
   */
  const handleAddLink = useCallback(
    async (url: string) => {
      if (!prova) return;
      try {
        await addLink(prova.id, url);
        await refetch();
        setSuccessMessage("Link adicionado com sucesso!");
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao adicionar link";
        setActionError(message);
      }
    },
    [prova, addLink, refetch],
  );

  /**
   * Aprova a prova e envia para a coordenacao
   */
  const handleAprovar = useCallback(async () => {
    setActionError(null);
    setSuccessMessage(null);

    try {
      await aprovar(provaId);
      setSuccessMessage("Prova aprovada com sucesso!");
      setTimeout(() => {
        router.push("/provas/analise");
      }, 2000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao aprovar prova";
      setActionError(message);
    }
  }, [provaId, aprovar, router]);

  /**
   * Devolve a prova para a professora
   */
  const handleDevolver = useCallback(async () => {
    setActionError(null);
    setSuccessMessage(null);

    try {
      await devolver(provaId);
      setSuccessMessage("Prova devolvida para a Professora!");
      setTimeout(() => {
        router.push("/provas/analise");
      }, 2000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao devolver prova";
      setActionError(message);
    }
  }, [provaId, devolver, router]);

  // Estado de carregamento
  if (loadingProva && !prova) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando prova...</p>
        </div>
      </div>
    );
  }

  // Erro ao carregar
  if (error && !prova) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <Link
            href="/provas/analise"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Lista de Analise
          </Link>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar prova</AlertTitle>
          <AlertDescription>
            {error}
            <Button
              variant="link"
              className="h-auto p-0 pl-2"
              onClick={() => fetchProva(provaId)}
            >
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Prova nao encontrada
  if (!prova) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <Link
            href="/provas/analise"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Lista de Analise
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ClipboardCheck className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Prova nao encontrada</h1>
          <p className="text-muted-foreground">
            A prova solicitada nao foi encontrada ou voce nao tem
            permissao para acessa-la.
          </p>
        </div>
      </div>
    );
  }

  const isLoading = loadingProva || loadingAction;
  const canPerformActions =
    !isLoading && prova.status === "AGUARDANDO_ANALISTA";

  // Adaptar documentos da prova para o formato esperado pelo DocumentoList (PlanoDocumento)
  const documentosAdaptados: PlanoDocumento[] = prova.documentos.map((doc) => ({
    ...doc,
    planoId: doc.provaId,
  } as unknown as PlanoDocumento));

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Back Button */}
      <div className="mb-6">
        <Link
          href="/provas/analise"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Lista de Analise
        </Link>
      </div>

      {/* Header Info */}
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
                <ClipboardCheck className="h-5 w-5" />
                Documentos Anexados
              </CardTitle>
              <CardDescription>
                Revise os documentos enviados pela professora. Voce pode
                adicionar comentarios aos documentos antes de devolver a prova.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentoList
                documentos={documentosAdaptados}
                canDelete={false}
                canAprovar={true}
                canComentar={true}
                onAprovar={handleAprovarDocumento}
                onDesaprovar={handleDesaprovarDocumento}
                onImprimir={handleImprimirDocumento}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - 1 coluna */}
        <div className="space-y-6">
          {/* Historico */}
          <HistoricoTimeline planoId={provaId} />

          {/* Acoes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Acoes</CardTitle>
              <CardDescription>
                {canPerformActions
                  ? "Revise a prova e escolha uma acao abaixo."
                  : "Esta prova nao esta aguardando sua analise."}
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
                        Aprovar Prova
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

                  {/* Aviso sobre comentarios */}
                  <p className="text-xs text-muted-foreground text-center">
                    Adicione comentários aos documentos usando o botão
                    &quot;Comentar&quot; antes de devolver.
                  </p>
                </>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Esta prova nao esta no status &quot;Aguardando
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
                  Envie a versao corrigida do documento diretamente a prova.
                </p>
                <DocumentoUpload
                  onUpload={handleUploadDocumento}
                  onAddLink={handleAddLink}
                  onAllUploadsComplete={refetch}
                  disabled={!prova}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
