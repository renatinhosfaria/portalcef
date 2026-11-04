"use client";

import React, { useEffect, useRef, useState } from "react";

const ESCALA_RENDER = 2;

export interface PlantaPdfProps {
  url: string;
  pagina: number;
  largura: number;
  altura: number;
}

/** Desenha uma página do PDF original num canvas. O pdf.js só é carregado no navegador. */
export function PlantaPdf({ url, pagina, largura, altura }: PlantaPdfProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let cancelado = false;
    let tarefa: { destroy: () => unknown } | null = null;
    setFalhou(false);

    async function desenhar() {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const carregamento = pdfjs.getDocument({ url, withCredentials: true });
        tarefa = carregamento;
        const documento = await carregamento.promise;
        const paginaPdf = await documento.getPage(pagina);
        if (cancelado) return;
        const viewport = paginaPdf.getViewport({ scale: ESCALA_RENDER });
        const canvas = canvasRef.current;
        const contexto = canvas?.getContext("2d");
        if (!canvas || !contexto) throw new Error("canvas indisponível");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await paginaPdf.render({ canvasContext: contexto, canvas, viewport }).promise;
      } catch {
        if (!cancelado) setFalhou(true);
      }
    }

    void desenhar();
    return () => {
      cancelado = true;
      void tarefa?.destroy();
    };
  }, [url, pagina]);

  if (falhou) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-[#69736e]">
        Não foi possível mostrar a planta original.
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-label="Planta original"
      style={{ width: "100%", height: "100%", aspectRatio: `${largura} / ${altura}`, objectFit: "contain", display: "block" }}
    />
  );
}
