"use client";

import { Button } from "@essencia/ui/components/button";
import { Mic, Square, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface GravadorAudioProps {
  onRecordingComplete: (blob: Blob, filename: string) => void;
  maxDurationSeconds?: number;
}

type EstadoGravacao = "inativo" | "gravando" | "concluido";

export function GravadorAudio({
  onRecordingComplete,
  maxDurationSeconds = 180,
}: GravadorAudioProps) {
  const [estado, setEstado] = useState<EstadoGravacao>("inativo");
  const [tempoDecorrido, setTempoDecorrido] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tempoInicioRef = useRef<number>(0);

  // Limpar recursos ao desmontar
  useEffect(() => {
    return () => {
      pararTracks();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pararTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const pararTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const iniciarGravacao = useCallback(async () => {
    setErro(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        blobRef.current = blob;

        const url = URL.createObjectURL(blob);
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(url);
        setEstado("concluido");
        pararTracks();
        pararTimer();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);

      setTempoDecorrido(0);
      tempoInicioRef.current = Date.now();
      setEstado("gravando");

      // Timer de contagem
      timerRef.current = setInterval(() => {
        const decorrido = Math.floor(
          (Date.now() - tempoInicioRef.current) / 1000,
        );
        setTempoDecorrido(decorrido);

        if (decorrido >= maxDurationSeconds) {
          pararGravacao();
        }
      }, 200);
    } catch (err) {
      pararTracks();
      if (err instanceof DOMException) {
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError"
        ) {
          setErro(
            "Permissao de microfone negada. Verifique as permissoes do navegador.",
          );
        } else if (err.name === "NotFoundError") {
          setErro("Nenhum microfone encontrado neste dispositivo.");
        } else {
          setErro("Erro ao acessar o microfone.");
        }
      } else {
        setErro("Erro ao iniciar gravacao de audio.");
      }
    }
  }, [maxDurationSeconds, previewUrl, pararTracks, pararTimer]);

  const pararGravacao = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    pararTimer();
  }, [pararTimer]);

  const usarGravacao = useCallback(() => {
    if (blobRef.current) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `gravacao-audio-${timestamp}.webm`;
      onRecordingComplete(blobRef.current, filename);
    }
  }, [onRecordingComplete]);

  const descartarGravacao = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    blobRef.current = null;
    chunksRef.current = [];
    setEstado("inativo");
    setTempoDecorrido(0);
  }, [previewUrl]);

  const formatarTempo = (segundos: number): string => {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    return `${min.toString().padStart(2, "0")}:${seg.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      {/* Estado Inativo - Botao Iniciar */}
      {estado === "inativo" && (
        <Button type="button" variant="outline" onClick={iniciarGravacao}>
          <Mic className="mr-2 h-4 w-4" />
          Gravar Audio
        </Button>
      )}

      {/* Estado Gravando */}
      {estado === "gravando" && (
        <div className="rounded-lg border bg-background p-4 space-y-4">
          {/* Indicador de Gravacao */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium">Gravando</span>
            </div>
            <span className="text-sm font-mono text-muted-foreground">
              {formatarTempo(tempoDecorrido)} /{" "}
              {formatarTempo(maxDurationSeconds)}
            </span>
          </div>

          {/* Barra de Progresso */}
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-red-500 transition-all duration-200"
              style={{
                width: `${(tempoDecorrido / maxDurationSeconds) * 100}%`,
              }}
            />
          </div>

          {/* Visualizacao simples - pulsacao */}
          <div className="flex items-center justify-center gap-1 h-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="w-1 bg-emerald-500 rounded-full animate-pulse"
                style={{
                  height: `${12 + Math.random() * 20}px`,
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: `${0.5 + Math.random() * 0.5}s`,
                }}
              />
            ))}
          </div>

          {/* Botao Parar */}
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={pararGravacao}
          >
            <Square className="mr-2 h-4 w-4" />
            Parar
          </Button>
        </div>
      )}

      {/* Estado Concluido - Preview */}
      {estado === "concluido" && previewUrl && (
        <div className="rounded-lg border bg-background p-4 space-y-4">
          <p className="text-sm font-medium">Preview do Audio</p>

          <audio src={previewUrl} controls className="w-full" />

          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={usarGravacao}>
              Usar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={descartarGravacao}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Descartar
            </Button>
          </div>
        </div>
      )}

      {/* Mensagem de Erro */}
      {erro && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <Mic className="h-4 w-4 flex-shrink-0" />
          <span>{erro}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2 text-destructive hover:text-destructive"
            onClick={() => setErro(null)}
          >
            Fechar
          </Button>
        </div>
      )}
    </div>
  );
}
