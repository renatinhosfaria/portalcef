"use client";

import React from "react";
import { useMemo } from "react";
import type { LugarMapa, TransformacaoZoom } from "@essencia/components/eventos/mapa-estilo-b";

export interface LetrasLateraisProps {
  lugares: LugarMapa[];
  transformacao: TransformacaoZoom;
  largura: number;
  altura: number;
}

export function LetrasLaterais({ lugares, transformacao, largura, altura }: LetrasLateraisProps): React.JSX.Element | null {
  const fileiras = useMemo(() => {
    const porFileira = new Map<string, LugarMapa[]>();
    for (const lugar of lugares) porFileira.set(lugar.fileira, [...(porFileira.get(lugar.fileira) ?? []), lugar]);
    return [...porFileira.entries()].map(([fileira, assentos]) => ({
      fileira,
      centroY: assentos.reduce((total, assento) => total + assento.y, 0) / assentos.length,
    }));
  }, [lugares]);

  if (transformacao.k < 3) return null;
  const visiveis = fileiras.filter(({ centroY }) => {
    const y = centroY * transformacao.k + transformacao.y;
    return y >= 0 && y <= altura;
  });
  return (
    <>
      <div data-testid="letras-laterais" className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-8 flex-col items-start">
        {visiveis.map(({ fileira, centroY }) => (
          <span key={`esquerda-${fileira}`} data-fileira={fileira} className="absolute rounded-full bg-[#1f2a24] px-2 py-1 text-xs font-semibold text-white" style={{ top: `${((centroY * transformacao.k + transformacao.y) / altura) * 100}%` }}>{fileira}</span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-8 flex-col items-end">
        {visiveis.map(({ fileira, centroY }) => (
          <span key={`direita-${fileira}`} data-fileira={fileira} className="absolute rounded-full bg-[#1f2a24] px-2 py-1 text-xs font-semibold text-white" style={{ top: `${((centroY * transformacao.k + transformacao.y) / altura) * 100}%` }}>{fileira}</span>
        ))}
      </div>
    </>
  );
}
