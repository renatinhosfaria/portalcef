"use client";

import React from "react";
import type { PontoConferir } from "@essencia/shared/eventos/mapa-proposta";

interface ListaPontosProps {
  pontos: PontoConferir[];
  selecionadoId: string | null;
  onSelecionar: (ponto: PontoConferir) => void;
  onConferir: (ponto: PontoConferir) => void;
}

export function ListaPontos({ pontos, selecionadoId, onSelecionar, onConferir }: ListaPontosProps) {
  const pendentes = pontos.filter((ponto) => !ponto.conferido).length;
  return (
    <section aria-label="Pontos para conferir" className="space-y-2">
      <h2 className="font-[family-name:var(--font-display,Outfit),system-ui,sans-serif] text-sm font-bold text-[#24302c]">
        {pendentes === 0 ? "Nenhum ponto para conferir" : `${pendentes} ${pendentes === 1 ? "ponto" : "pontos"} para conferir`}
      </h2>
      <ul className="space-y-2">
        {pontos.map((ponto) => (
          <li
            key={ponto.id}
            className={`rounded-xl border p-3 text-sm ${
              ponto.conferido ? "border-[#d6e6b8] bg-[#f4f9ea]" : "border-[#f0d9a8] bg-[#fff8e8]"
            } ${selecionadoId === ponto.id ? "ring-2 ring-[#a3d154]" : ""}`}
          >
            <button type="button" onClick={() => onSelecionar(ponto)} className="block w-full text-left text-[#24302c]">
              {ponto.conferido ? "✓ " : ""}
              {ponto.mensagem}
            </button>
            {selecionadoId === ponto.id && !ponto.conferido ? (
              <button
                type="button"
                onClick={() => onConferir(ponto)}
                className="mt-2 rounded-lg bg-[#a3d154] px-3 py-1 text-xs font-semibold text-[#24302c]"
              >
                Marcar como conferido
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
