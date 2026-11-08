"use client";

import React from "react";
import type { LugarMapa, TransformacaoZoom } from "@essencia/components/eventos/mapa-estilo-b";

export interface MinimapaProps {
  largura: number;
  altura: number;
  lugares: LugarMapa[];
  transformacao: TransformacaoZoom;
  className?: string;
}

export function Minimapa({ largura, altura, lugares, transformacao, className }: MinimapaProps): React.JSX.Element {
  const larguraVisivel = largura / transformacao.k;
  const alturaVisivel = altura / transformacao.k;
  return (
    <div data-testid="minimapa" className={className ?? "absolute bottom-3 right-3 z-10 rounded-lg border border-[#d9ddcf] bg-white/95 p-1 shadow-sm"} aria-hidden="true">
      <svg viewBox={`0 0 ${largura} ${altura}`} width="120" height="80" preserveAspectRatio="xMidYMid meet">
        <rect width={largura} height={altura} fill="#f5f3ed" />
        {lugares.map((lugar) => (
          <rect key={lugar.id} x={lugar.x - lugar.largura / 2} y={lugar.y - lugar.altura / 2} width={lugar.largura} height={lugar.altura} rx={lugar.altura * 0.2} fill="#d9ddcf" />
        ))}
        {transformacao.k > 1.5 ? (
          <rect
            data-minimapa-viewport
            x={Math.max(0, Math.min(largura - larguraVisivel, -transformacao.x / transformacao.k))}
            y={Math.max(0, Math.min(altura - alturaVisivel, -transformacao.y / transformacao.k))}
            width={Math.min(largura, larguraVisivel)}
            height={Math.min(altura, alturaVisivel)}
            fill="none"
            stroke="#3f6f12"
            strokeWidth={Math.max(2, largura / 300)}
          />
        ) : null}
      </svg>
    </div>
  );
}
