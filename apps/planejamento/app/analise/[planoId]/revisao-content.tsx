"use client";

/**
 * RevisaoContent Component
 * Client component para a pagina de revisao da analista pedagogica
 * Task 4.3: Criar pagina onde a analista revisa e aprova/devolve um plano
 */

import {
  formatQuinzenaDateRange,
  getQuinzenaById,
} from "@essencia/shared/config/quinzenas";
import { Alert, AlertDescription, AlertTitle } from "@essencia/ui/components/alert";
import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@essencia/ui/components/select";
import { Textarea } from "@essencia/ui/components/textarea";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  DocumentoList,
  HistoricoTimeline,
  PlanoStatusBadge,
  useAnalistaActions,
  usePlanoDetalhe,
  type AddComentarioDto,
  type PlanoDocumento,
} from "../../../features/plano-aula";

interface RevisaoContentProps {
  planoId: string;
}

/**
 * Formata a data de submissao para exibicao
 */
function formatarDataSubmissao(data?: string): string {
  if (!data) return "Nao informada";
  const date = new Date(data);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Componente para adicionar comentario a um documento
 */
interface AddComentarioFormProps {
  documentos: PlanoDocumento[];
  onAddComentario: (dto: AddComentarioDto) => void;
  disabled?: boolean;
}

function AddComentarioForm({
  documentos,
  onAddComentario,
  disabled,
}: AddComentarioFormProps) {
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [comentario, setComentario] = useState("");

  const handleSubmit = () => {
    if (!selectedDocId || !comentario.trim()) return;

    onAddComentario({
      documentoId: selectedDocId,
      comentario: comentario.trim(),
    });

    // Limpar formulario
    setComentario("");
    // Manter documento selecionado para facilitar adicao de mais comentarios
  };

  const canSubmit = selectedDocId && comentario.trim().length > 0 && !disabled;

  return (
    <div className="space-y-4">
      {/* Selecao de Documento */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Documento</label>
        <Select value={selectedDocId} onValueChange={setSelectedDocId}>
          <SelectTrigger disabled={disabled}>
            <SelectValue placeholder="Selecione o documento para comentar" />
          </SelectTrigger>
          <SelectContent>
            {documentos.map((doc) => (
              <SelectItem key={doc.id} value={doc.id}>
                {doc.tipo === "LINK_YOUTUBE"
                  ? "Video do YouTube"
                  : doc.fileName || "Documento sem nome"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Campo de Comentario */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Comentario</label>
        <Textarea
          placeholder="Digite seu comentario sobre o documento..."
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          disabled={disabled}
          rows={3}
          className="resize-none"
        />
      </div>

      {/* Botao Adicionar */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full"
      >
        <MessageSquare className="mr-2 h-4 w-4" />
        Adicionar Comentario
      </Button>
    </div>
  );
}

/**
 * Lista de comentarios pendentes de envio
 */
interface ComentariosPendentesProps {
  comentarios: AddComentarioDto[];
  documentos: PlanoDocumento[];
  onRemove: (index: number) => void;
}

function ComentariosPendentes({
  comentarios,
  documentos,
  onRemove,
}: ComentariosPendentesProps) {
  if (comentarios.length === 0) {
    return null;
  }

  const getDocumentoNome = (docId: string): string => {
    const doc = documentos.find((d) => d.id === docId);
    if (!doc) return "Documento desconhecido";
    return doc.tipo === "LINK_YOUTUBE"
      ? "Video do YouTube"
      : doc.fileName || "Documento sem nome";
  };

  return (
    <div className="mt-4 space-y-2">
      <p className="text-sm font-medium text-muted-foreground">
        Comentarios a enviar ({comentarios.length}):
      </p>
      <div className="space-y-2">
        {comentarios.map((c, index) => (
          <div
            key={`${c.documentoId}-${index}`}
            className="flex items-start justify-between gap-2 rounded-md border bg-muted/50 p-3 text-sm"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-xs text-muted-foreground mb-1">
                {getDocumentoNome(c.documentoId)}
              </p>
              <p className="text-foreground">{c.comentario}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(index)}
              title="Remover comentario"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RevisaoContent({ planoId }: RevisaoContentProps) {
  const router = useRouter();
  const { loading: loadingPlano, plano, error, fetchPlano, refetch } = usePlanoDetalhe();
  const { loading: loadingAction, aprovar, devolver } = useAnalistaActions();

  const [comentariosPendentes, setComentariosPendentes] = useState<
    AddComentarioDto[]
  >([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
   * Adiciona comentario a lista de pendentes
   */
  const handleAddComentario = useCallback((dto: AddComentarioDto) => {
    setComentariosPendentes((prev) => [...prev, dto]);
  }, []);

  /**
   * Remove comentario da lista de pendentes
   */
  const handleRemoveComentario = useCallback((index: number) => {
    setComentariosPendentes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * Aprova o plano e envia para a coordenacao
   */
  const handleAprovar = useCallback(async () => {
    setActionError(null);
    setSuccessMessage(null);

    try {
      await aprovar(planoId);
      setSuccessMessage("Plano aprovado e enviado para a Coordenacao!");
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
   * Devolve o plano para a professora com comentarios
   */
  const handleDevolver = useCallback(async () => {
    setActionError(null);
    setSuccessMessage(null);

    if (comentariosPendentes.length === 0) {
      setActionError(
        "E necessario adicionar pelo menos um comentario para devolver o plano.",
      );
      return;
    }

    try {
      await devolver(planoId, comentariosPendentes);
      setSuccessMessage("Plano devolvido para a Professora com comentarios!");
      setComentariosPendentes([]);
      // Redirecionar apos 2 segundos
      setTimeout(() => {
        router.push("/analise");
      }, 2000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao devolver plano";
      setActionError(message);
    }
  }, [planoId, devolver, comentariosPendentes, router]);

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

  // Obter configuracao da quinzena
  const quinzenaConfig = getQuinzenaById(plano.quinzenaId);
  const periodoDisplay = quinzenaConfig
    ? formatQuinzenaDateRange(quinzenaConfig)
    : "Periodo nao encontrado";

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
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              {/* Professora e Turma */}
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">
                    {plano.professorName}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {plano.turmaName}
                    {plano.turmaCode && (
                      <span className="text-muted-foreground ml-1">
                        ({plano.turmaCode})
                      </span>
                    )}
                  </CardDescription>
                </div>
              </div>

              {/* Quinzena e Data */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {quinzenaConfig?.label || plano.quinzenaId} -{" "}
                    {periodoDisplay}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>
                    Enviado em: {formatarDataSubmissao(plano.submittedAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex-shrink-0">
              <PlanoStatusBadge status={plano.status} className="text-sm" />
            </div>
          </div>
        </CardHeader>
      </Card>

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
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - 1 coluna */}
        <div className="space-y-6">
          {/* Historico */}
          <HistoricoTimeline planoId={planoId} />

          {/* Adicionar Comentario */}
          {canPerformActions && plano.documentos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquare className="h-5 w-5" />
                  Adicionar Comentario
                </CardTitle>
                <CardDescription>
                  Adicione comentarios aos documentos para devolver o plano para
                  ajustes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AddComentarioForm
                  documentos={plano.documentos}
                  onAddComentario={handleAddComentario}
                  disabled={isLoading}
                />
                <ComentariosPendentes
                  comentarios={comentariosPendentes}
                  documentos={plano.documentos}
                  onRemove={handleRemoveComentario}
                />
              </CardContent>
            </Card>
          )}

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
                        Aprovar e Enviar para Coordenacao
                      </>
                    )}
                  </Button>

                  {/* Botao Devolver */}
                  <Button
                    onClick={handleDevolver}
                    disabled={isLoading || comentariosPendentes.length === 0}
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
                        {comentariosPendentes.length > 0 && (
                          <span className="ml-1">
                            ({comentariosPendentes.length})
                          </span>
                        )}
                      </>
                    )}
                  </Button>

                  {/* Aviso se nao tem comentarios para devolver */}
                  {comentariosPendentes.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                      Para devolver o plano, adicione pelo menos um comentario.
                    </p>
                  )}
                </>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Este plano nao esta no status &quot;Aguardando Analise&quot;.
                    Nenhuma acao disponivel.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
