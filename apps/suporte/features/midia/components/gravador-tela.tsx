"use client";

import { Button } from "@essencia/ui/components/button";
import { Monitor, Pause, Play, Square, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface GravadorTelaProps {
  onRecordingComplete: (blob: Blob, filename: string) => void;
  maxDurationSeconds?: number;
}

type EstadoGravacao = "inativo" | "gravando" | "pausado" | "concluido";

export function GravadorTela({
  onRecordingComplete,
  maxDurationSeconds = 120,
}: GravadorTelaProps) {
  const [estado, setEstado] = useState<EstadoGravacao>("inativo");
  const [tempoRestante, setTempoRestante] = useState(maxDurationSeconds);
  const [suportado, setSuportado] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tempoInicioRef = useRef<number>(0);
  const tempoDecorridoRef = useRef<number>(0);

  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !("getDisplayMedia" in navigator.mediaDevices)
    ) {
      setSuportado(false);
    }
  }, []);

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

  const iniciarTimer = useCallback(() => {
    tempoInicioRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const decorrido =
        tempoDecorridoRef.current +
        (Date.now() - tempoInicioRef.current) / 1000;
      const restante = Math.max(0, maxDurationSeconds - decorrido);
      setTempoRestante(Math.ceil(restante));

      if (restante <= 0) {
        pararGravacao();
      }
    }, 200);
  }, [maxDurationSeconds]);

  const iniciarGravacao = useCallback(async () => {
    setErro(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      streamRef.current = stream;

      // Detectar quando o usuario para o compartilhamento pela UI do navegador
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state !== "inactive"
        ) {
          pararGravacao();
        }
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm",
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
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

      tempoDecorridoRef.current = 0;
      setTempoRestante(maxDurationSeconds);
      setEstado("gravando");
      iniciarTimer();
    } catch (err) {
      pararTracks();
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setErro("Permissao de compartilhamento de tela negada.");
      } else {
        setErro("Erro ao iniciar gravacao de tela.");
      }
    }
  }, [maxDurationSeconds, previewUrl, pararTracks, pararTimer, iniciarTimer]);

  const pararGravacao = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    pararTimer();
  }, [pararTimer]);

  const pausarGravacao = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.pause();
      tempoDecorridoRef.current +=
        (Date.now() - tempoInicioRef.current) / 1000;
      pararTimer();
      setEstado("pausado");
    }
  }, [pararTimer]);

  const retomarGravacao = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "paused"
    ) {
      mediaRecorderRef.current.resume();
      setEstado("gravando");
      iniciarTimer();
    }
  }, [iniciarTimer]);

  const usarGravacao = useCallback(() => {
    if (blobRef.current) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `gravacao-tela-${timestamp}.webm`;
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
    setTempoRestante(maxDurationSeconds);
    tempoDecorridoRef.current = 0;
  }, [previewUrl, maxDurationSeconds]);

  const formatarTempo = (segundos: number): string => {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    return `${min.toString().padStart(2, "0")}:${seg.toString().padStart(2, "0")}`;
  };

  if (!suportado) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <div className="flex items-start gap-3">
          <Monitor className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-yellow-800">
            Gravacao de tela nao disponivel neste navegador. Use o upload de
            arquivo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Estado Inativo - Botao Iniciar */}
      {estado === "inativo" && (
        <Button type="button" variant="outline" onClick={iniciarGravacao}>
          <Monitor className="mr-2 h-4 w-4" />
          Gravar Tela
        </Button>
      )}

      {/* Estado Gravando / Pausado */}
      {(estado === "gravando" || estado === "pausado") && (
        <div className="rounded-lg border bg-background p-4 space-y-4">
          {/* Indicador de Gravacao */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className={`h-3 w-3 rounded-full ${
                  estado === "gravando"
                    ? "bg-red-500 animate-pulse"
                    : "bg-yellow-500"
                }`}
              />
              <span className="text-sm font-medium">
                {estado === "gravando" ? "Gravando" : "Pausado"}
              </span>
            </div>
            <span className="text-sm font-mono text-muted-foreground">
              {formatarTempo(tempoRestante)}
            </span>
          </div>

          {/* Barra de Progresso */}
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-red-500 transition-all duration-200"
              style={{
                width: `${((maxDurationSeconds - tempoRestante) / maxDurationSeconds) * 100}%`,
              }}
            />
          </div>

          {/* Controles */}
          <div className="flex items-center gap-2">
            {estado === "gravando" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={pausarGravacao}
              >
                <Pause className="mr-2 h-4 w-4" />
                Pausar
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={retomarGravacao}
              >
                <Play className="mr-2 h-4 w-4" />
                Retomar
              </Button>
            )}

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
        </div>
      )}

      {/* Estado Concluido - Preview */}
      {estado === "concluido" && previewUrl && (
        <div className="rounded-lg border bg-background p-4 space-y-4">
          <p className="text-sm font-medium">Preview da Gravacao</p>

          <video
            src={previewUrl}
            controls
            className="w-full rounded-lg max-h-[300px] bg-black"
          />

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
