"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicMap, PublicSeat } from "@essencia/shared/types";
import { obterMapaSessao } from "../../lib/eventos-api";
import type { AssentoSelecionado } from "../../lib/selecao-lugares";

const INTERVALO_PADRAO_MS = 20_000;

export function lugaresPerdidos(selecao: AssentoSelecionado[], mapa: PublicMap): PublicSeat[] {
  const selecionados = new Set(selecao.map((item) => item.seatId));
  return mapa.seats.filter((seat) => selecionados.has(seat.id) && seat.state !== "available");
}

export function useDisponibilidadeAoVivo(sessionId: string, mapaInicial: PublicMap, opcoes: { intervaloMs?: number; buscar?: (sessionId: string) => Promise<PublicMap> } = {}): { mapa: PublicMap; atualizarAgora: () => Promise<PublicMap> } {
  const intervaloMs = opcoes.intervaloMs ?? INTERVALO_PADRAO_MS;
  const buscar = opcoes.buscar ?? obterMapaSessao;
  const [mapa, setMapa] = useState(mapaInicial);
  const mapaRef = useRef(mapaInicial);

  useEffect(() => {
    mapaRef.current = mapa;
  }, [mapa]);

  useEffect(() => {
    mapaRef.current = mapaInicial;
    setMapa(mapaInicial);
  }, [sessionId, mapaInicial]);

  const atualizarAgora = useCallback(async (): Promise<PublicMap> => {
    const atualizado = await buscar(sessionId);
    mapaRef.current = atualizado;
    setMapa(atualizado);
    return atualizado;
  }, [buscar, sessionId]);

  useEffect(() => {
    const consultarSeVisivel = (): void => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void atualizarAgora().catch(() => undefined);
    };
    const aoMudarVisibilidade = (): void => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return;
      consultarSeVisivel();
    };
    const temporizador = window.setInterval(consultarSeVisivel, intervaloMs);
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => {
      window.clearInterval(temporizador);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, [atualizarAgora, intervaloMs]);

  return { mapa, atualizarAgora };
}
