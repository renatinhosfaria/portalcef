"use client";

import { useState, useCallback } from "react";
import { Button } from "@essencia/ui/components/button";
import { Textarea } from "@essencia/ui/components/textarea";
import { toast } from "@essencia/ui/toaster";
import { Send, Paperclip, Mic, X, Loader2 } from "lucide-react";
import { useEnviarMensagem } from "@/hooks/use-enviar-mensagem";
import { UploadArquivo } from "@/features/midia/components/upload-arquivo";
import { GravadorAudio } from "@/features/midia/components/gravador-audio";

// ============================================
// Props
// ============================================
interface OsResponderProps {
  ordemServicoId: string;
  onMessageSent: () => void;
}

// ============================================
// Componente Principal - Formulario de Resposta
// ============================================
export function OsResponder({
  ordemServicoId,
  onMessageSent,
}: OsResponderProps) {
  const [conteudo, setConteudo] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [mostrarUpload, setMostrarUpload] = useState(false);
  const [mostrarGravador, setMostrarGravador] = useState(false);

  const { enviar, isLoading } = useEnviarMensagem();

  // ============================================
  // Handlers de Arquivos
  // ============================================
  const handleFilesSelected = useCallback((files: File[]) => {
    setArquivos((prev) => [...prev, ...files]);
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setArquivos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleRecordingComplete = useCallback(
    (blob: Blob, filename: string) => {
      const file = new File([blob], filename, { type: "audio/webm" });
      setArquivos((prev) => [...prev, file]);
      setMostrarGravador(false);
      toast.success("Gravacao adicionada aos anexos.");
    },
    [],
  );

  // ============================================
  // Submit
  // ============================================
  const handleSubmit = useCallback(async () => {
    const textoTrimmed = conteudo.trim();

    if (!textoTrimmed && arquivos.length === 0) {
      toast.error("Escreva uma mensagem ou anexe um arquivo para enviar.");
      return;
    }

    try {
      await enviar(ordemServicoId, {
        conteudo: textoTrimmed || undefined,
        arquivos,
      });

      // Limpar formulario
      setConteudo("");
      setArquivos([]);
      setMostrarUpload(false);
      setMostrarGravador(false);

      toast.success("Mensagem enviada com sucesso!");
      onMessageSent();
    } catch {
      toast.error("Erro ao enviar mensagem. Tente novamente.");
    }
  }, [conteudo, arquivos, enviar, ordemServicoId, onMessageSent]);

  // ============================================
  // Render
  // ============================================
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-sm font-semibold text-foreground">Responder</p>

      {/* Textarea */}
      <Textarea
        placeholder="Digite sua mensagem..."
        value={conteudo}
        onChange={(e) => setConteudo(e.target.value)}
        rows={3}
        className="resize-none"
        disabled={isLoading}
      />

      {/* Botoes de acao */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setMostrarUpload((prev) => !prev);
            if (mostrarGravador) setMostrarGravador(false);
          }}
          className="gap-2"
          disabled={isLoading}
        >
          {mostrarUpload ? (
            <>
              <X className="h-4 w-4" />
              Fechar anexo
            </>
          ) : (
            <>
              <Paperclip className="h-4 w-4" />
              Anexar arquivo
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setMostrarGravador((prev) => !prev);
            if (mostrarUpload) setMostrarUpload(false);
          }}
          className="gap-2"
          disabled={isLoading}
        >
          {mostrarGravador ? (
            <>
              <X className="h-4 w-4" />
              Fechar gravador
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              Gravar audio
            </>
          )}
        </Button>

        <div className="ml-auto">
          <Button
            onClick={() => void handleSubmit()}
            disabled={isLoading || (!conteudo.trim() && arquivos.length === 0)}
            className="bg-[#A3D154] hover:bg-[#8ec33e] text-slate-900 font-bold gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Area de Upload */}
      {mostrarUpload && (
        <UploadArquivo
          onFilesSelected={handleFilesSelected}
          arquivos={arquivos}
          onRemove={handleRemoveFile}
          maxFiles={5}
          maxSizeMB={100}
          accept="image/*,video/*,audio/*"
        />
      )}

      {/* Gravador de Audio */}
      {mostrarGravador && (
        <GravadorAudio onRecordingComplete={handleRecordingComplete} />
      )}

      {/* Preview de arquivos quando upload esta fechado mas tem arquivos */}
      {!mostrarUpload && arquivos.length > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Paperclip className="h-4 w-4 flex-shrink-0" />
          <span>
            {arquivos.length} arquivo(s) anexado(s)
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2"
            onClick={() => setMostrarUpload(true)}
          >
            Ver
          </Button>
        </div>
      )}
    </div>
  );
}
