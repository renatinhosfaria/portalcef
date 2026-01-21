"use client";

/**
 * RevisaoContent - Client Component para Revisao da Coordenadora
 * Task 4.5: Componente que gerencia a revisao final do plano de aula
 *
 * Funcionalidades:
 * - Visualiza documentos e comentarios existentes
 * - Adiciona novos comentarios
 * - Aprova plano (aprovacao final)
 * - Devolve para Professora ou Analista (com comentarios obrigatorios)
 */

import { Alert, AlertDescription, AlertTitle } from "@essencia/ui/components/alert";
import { Button } from "@essencia/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@essencia/ui/components/card";
import { Label } from "@essencia/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@essencia/ui/components/radio-group";
import { Textarea } from "@essencia/ui/components/textarea";
import { cn } from "@essencia/ui/lib/utils";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  MessageSquare,
  Send,
  Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  DocumentoList,
  useCoordenadoraActions,
  usePlanoDetalhe,
  type AddComentarioDto,
  type PlanoAula,
} from "../../../features/plano-aula";

interface RevisaoContentProps {
  planoId: string;
  planoInicial: PlanoAula;
  currentUserName: string;
  canApprove: boolean;
}

type DestinoDevolver = "PROFESSORA" | "ANALISTA";
type ModoAcao = "idle" | "aprovar" | "devolver";

/**
 * Componente para adicionar comentario em um documento
 */
interface ComentarioInputProps {
  documentoId: string;
  documentoNome: string;
  valor: string;
  onChange: (docId: string, valor: string) => void;
}

function ComentarioInput({
  documentoId,
  documentoNome,
  valor,
  onChange,
}: ComentarioInputProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`comentario-${documentoId}`} className="text-sm font-medium">
        Comentario para: {documentoNome}
      </Label>
      <Textarea
        id={`comentario-${documentoId}`}
        placeholder="Digite seu comentario sobre este documento..."
        value={valor}
        onChange={(e) => onChange(documentoId, e.target.value)}
        className="min-h-[80px] resize-y"
      />
    </div>
  );
}

export function RevisaoContent({
  planoId,
  planoInicial,
  currentUserName: _currentUserName,
  canApprove,
}: RevisaoContentProps) {
  const router = useRouter();

  // Estado do plano
  const { plano, fetchPlano, refetch } = usePlanoDetalhe(planoId);
  const [currentPlano, setCurrentPlano] = useState<PlanoAula>(planoInicial);

  // Estado da acao
  const [modoAcao, setModoAcao] = useState<ModoAcao>("idle");
  const [destinoDevolver, setDestinoDevolver] = useState<DestinoDevolver>("PROFESSORA");
  const [comentarios, setComentarios] = useState<Record<string, string>>({});
  const [comentarioGeral, setComentarioGeral] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Hook de acoes da coordenadora
  const { loading, aprovar, devolver } = useCoordenadoraActions();

  // Carregar plano atualizado
  useEffect(() => {
    if (planoId) {
      fetchPlano(planoId);
    }
  }, [planoId, fetchPlano]);

  // Atualizar plano local quando o hook retornar dados
  useEffect(() => {
    if (plano) {
      setCurrentPlano(plano);
    }
  }, [plano]);

  /**
   * Handler para alterar comentario de um documento
   */
  const handleComentarioChange = useCallback(
    (docId: string, valor: string) => {
      setComentarios((prev) => ({
        ...prev,
        [docId]: valor,
      }));
    },
    [],
  );

  /**
   * Montar lista de comentarios para enviar
   */
  const montarComentariosDto = useCallback((): AddComentarioDto[] => {
    const result: AddComentarioDto[] = [];

    // Comentarios por documento
    for (const [docId, texto] of Object.entries(comentarios)) {
      if (texto.trim()) {
        result.push({
          documentoId: docId,
          comentario: texto.trim(),
        });
      }
    }

    // Comentario geral (associado ao primeiro documento se existir)
    const primeiroDocumento = currentPlano.documentos[0];
    if (comentarioGeral.trim() && primeiroDocumento) {
      result.push({
        documentoId: primeiroDocumento.id,
        comentario: `[Comentario Geral] ${comentarioGeral.trim()}`,
      });
    }

    return result;
  }, [comentarios, comentarioGeral, currentPlano.documentos]);

  /**
   * Verificar se tem pelo menos um comentario (obrigatorio para devolucao)
   */
  const temComentarioParaDevolucao = useCallback((): boolean => {
    const comentariosDto = montarComentariosDto();
    return comentariosDto.length > 0 || comentarioGeral.trim().length > 0;
  }, [montarComentariosDto, comentarioGeral]);

  /**
   * Handler para aprovar o plano
   */
  const handleAprovar = useCallback(async () => {
    setError(null);
    setSuccessMessage(null);

    try {
      await aprovar(planoId);
      setSuccessMessage("Plano aprovado com sucesso!");

      // Atualizar dados e redirecionar apos 1.5s
      await refetch();
      setTimeout(() => {
        router.push("/planejamentos");
      }, 1500);
    } catch (err) {
      console.error("Erro ao aprovar plano:", err);
      setError(
        err instanceof Error ? err.message : "Erro ao aprovar plano. Tente novamente.",
      );
    }
  }, [planoId, aprovar, refetch, router]);

  /**
   * Handler para devolver o plano
   */
  const handleDevolver = useCallback(async () => {
    setError(null);
    setSuccessMessage(null);

    // Validar comentario obrigatorio
    if (!temComentarioParaDevolucao()) {
      setError(
        "E obrigatorio adicionar pelo menos um comentario ao devolver o plano.",
      );
      return;
    }

    try {
      const comentariosDto = montarComentariosDto();
      await devolver(planoId, destinoDevolver, comentariosDto);

      const destinoLabel =
        destinoDevolver === "PROFESSORA" ? "Professora" : "Analista Pedagogica";
      setSuccessMessage(`Plano devolvido para ${destinoLabel} com sucesso!`);

      // Redirecionar apos 1.5s
      setTimeout(() => {
        router.push("/planejamentos");
      }, 1500);
    } catch (err) {
      console.error("Erro ao devolver plano:", err);
      setError(
        err instanceof Error ? err.message : "Erro ao devolver plano. Tente novamente.",
      );
    }
  }, [
    planoId,
    destinoDevolver,
    temComentarioParaDevolucao,
    montarComentariosDto,
    devolver,
    router,
  ]);

  /**
   * Cancelar acao em andamento
   */
  const handleCancelar = useCallback(() => {
    setModoAcao("idle");
    setError(null);
  }, []);

  // Verificar se plano ja foi processado
  const isPlanoProcessado =
    currentPlano.status === "APROVADO" ||
    currentPlano.status === "DEVOLVIDO_COORDENADORA";

  return (
    <div className="space-y-6">
      {/* Mensagem de Sucesso */}
      {successMessage && (
        <Alert variant="default" className="border-green-400 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Sucesso!</AlertTitle>
          <AlertDescription className="text-green-700">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Mensagem de Erro */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Plano ja processado */}
      {isPlanoProcessado && !successMessage && (
        <Alert
          variant="default"
          className={cn(
            currentPlano.status === "APROVADO"
              ? "border-green-400 bg-green-50"
              : "border-orange-400 bg-orange-50",
          )}
        >
          {currentPlano.status === "APROVADO" ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <Undo2 className="h-4 w-4 text-orange-600" />
          )}
          <AlertTitle
            className={
              currentPlano.status === "APROVADO"
                ? "text-green-800"
                : "text-orange-800"
            }
          >
            {currentPlano.status === "APROVADO"
              ? "Plano Aprovado"
              : "Plano Devolvido"}
          </AlertTitle>
          <AlertDescription
            className={
              currentPlano.status === "APROVADO"
                ? "text-green-700"
                : "text-orange-700"
            }
          >
            {currentPlano.status === "APROVADO"
              ? `Este plano foi aprovado${currentPlano.approvedAt ? ` em ${new Date(currentPlano.approvedAt).toLocaleDateString("pt-BR")}` : ""}.`
              : "Este plano foi devolvido e esta aguardando correcoes."}
          </AlertDescription>
        </Alert>
      )}

      {/* Documentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Documentos Anexados ({currentPlano.documentos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentoList
            documentos={currentPlano.documentos}
            showComments={true}
            canDelete={false}
          />
        </CardContent>
      </Card>

      {/* Acoes - somente se pode aprovar */}
      {canApprove && !isPlanoProcessado && (
        <>
          {/* Modo Idle - Botoes de Acao */}
          {modoAcao === "idle" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="h-5 w-5" />
                  Acoes de Revisao
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-4">
                <Button
                  onClick={() => setModoAcao("aprovar")}
                  disabled={loading}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Aprovar Plano
                </Button>
                <Button
                  onClick={() => setModoAcao("devolver")}
                  disabled={loading}
                  variant="outline"
                  className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  <Undo2 className="h-4 w-4" />
                  Devolver Plano
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Modo Aprovar - Confirmacao */}
          {modoAcao === "aprovar" && (
            <Card className="border-green-300">
              <CardHeader className="bg-green-50">
                <CardTitle className="flex items-center gap-2 text-lg text-green-800">
                  <CheckCircle2 className="h-5 w-5" />
                  Confirmar Aprovacao
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <p className="text-muted-foreground">
                  Ao aprovar, o plano de aula sera marcado como{" "}
                  <strong>APROVADO</strong> e a professora sera notificada.
                </p>

                {/* Comentario opcional para aprovacao */}
                <div className="space-y-2">
                  <Label htmlFor="comentario-aprovacao" className="text-sm font-medium">
                    Comentario (opcional)
                  </Label>
                  <Textarea
                    id="comentario-aprovacao"
                    placeholder="Adicione um comentario de feedback se desejar..."
                    value={comentarioGeral}
                    onChange={(e) => setComentarioGeral(e.target.value)}
                    className="min-h-[80px] resize-y"
                  />
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button
                    onClick={handleAprovar}
                    disabled={loading}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Aprovando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Confirmar Aprovacao
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleCancelar}
                    disabled={loading}
                    variant="outline"
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Modo Devolver - Escolha de Destino */}
          {modoAcao === "devolver" && (
            <Card className="border-orange-300">
              <CardHeader className="bg-orange-50">
                <CardTitle className="flex items-center gap-2 text-lg text-orange-800">
                  <Undo2 className="h-5 w-5" />
                  Devolver Plano
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-4">
                {/* Selecao de Destino */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Para quem deseja devolver?
                  </Label>
                  <RadioGroup
                    value={destinoDevolver}
                    onValueChange={(value) =>
                      setDestinoDevolver(value as DestinoDevolver)
                    }
                    className="space-y-2"
                  >
                    <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50">
                      <RadioGroupItem value="PROFESSORA" id="destino-professora" />
                      <Label
                        htmlFor="destino-professora"
                        className="flex-1 cursor-pointer"
                      >
                        <span className="font-medium">Devolver para Professora</span>
                        <p className="text-sm text-muted-foreground">
                          A professora fara os ajustes e reenviara para analise
                        </p>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50">
                      <RadioGroupItem value="ANALISTA" id="destino-analista" />
                      <Label
                        htmlFor="destino-analista"
                        className="flex-1 cursor-pointer"
                      >
                        <span className="font-medium">
                          Devolver para Analista Pedagogica
                        </span>
                        <p className="text-sm text-muted-foreground">
                          A analista revisara novamente antes de enviar para
                          coordenacao
                        </p>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Comentario Geral - Obrigatorio */}
                <div className="space-y-2">
                  <Label htmlFor="comentario-geral" className="text-sm font-medium">
                    Motivo da devolucao{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="comentario-geral"
                    placeholder="Descreva os ajustes necessarios..."
                    value={comentarioGeral}
                    onChange={(e) => setComentarioGeral(e.target.value)}
                    className="min-h-[100px] resize-y"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Obrigatorio: Informe o motivo da devolucao
                  </p>
                </div>

                {/* Comentarios por Documento */}
                {currentPlano.documentos.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">
                        Comentarios por documento (opcional)
                      </Label>
                    </div>
                    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                      {currentPlano.documentos.map((doc) => (
                        <ComentarioInput
                          key={doc.id}
                          documentoId={doc.id}
                          documentoNome={doc.fileName || `Documento ${doc.tipo}`}
                          valor={comentarios[doc.id] || ""}
                          onChange={handleComentarioChange}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Botoes de Acao */}
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button
                    onClick={handleDevolver}
                    disabled={loading || !temComentarioParaDevolucao()}
                    variant="outline"
                    className="gap-2 border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Devolvendo...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Confirmar Devolucao
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleCancelar}
                    disabled={loading}
                    variant="outline"
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Cancelar
                  </Button>
                </div>

                {/* Aviso se nao tem comentario */}
                {!temComentarioParaDevolucao() && (
                  <p className="text-sm text-destructive">
                    Adicione pelo menos um comentario para devolver o plano.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Mensagem se nao pode aprovar */}
      {!canApprove && !isPlanoProcessado && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Status Incompativel</AlertTitle>
          <AlertDescription>
            Este plano nao esta aguardando aprovacao da coordenadora. Status
            atual:{" "}
            <strong>{currentPlano.status.replace(/_/g, " ").toLowerCase()}</strong>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
