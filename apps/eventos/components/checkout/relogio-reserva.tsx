"use client";

import React, { useEffect, useRef, useState } from "react";

export function formatarTempoRestante(ms: number): string {
  const segundos = Math.max(0, Math.floor(ms / 1000));
  const minutos = Math.floor(segundos / 60);
  return `${String(minutos).padStart(2, "0")}:${String(segundos % 60).padStart(2, "0")}`;
}

type Props = { expiraEm: Date | string; onEsgotar: () => void; agora?: () => number };

export function RelogioReserva({ expiraEm, onEsgotar, agora = Date.now }: Props): React.JSX.Element {
  const expiraEmMs = new Date(expiraEm).getTime();
  const [restante, setRestante] = useState(() => expiraEmMs - agora());
  const esgotadoRef = useRef(false);

  useEffect(() => {
    const atualizar = () => {
      const proximo = expiraEmMs - agora();
      setRestante(proximo);
      if (proximo <= 0 && !esgotadoRef.current) {
        esgotadoRef.current = true;
        onEsgotar();
      }
    };
    atualizar();
    const timer = window.setInterval(atualizar, 1000);
    return () => window.clearInterval(timer);
  }, [agora, expiraEmMs, onEsgotar]);

  return <div role="status" aria-live="polite" className="fixed inset-x-0 top-0 z-30 border-b border-[#d9ddcf] bg-[#f5f7f1] px-4 py-3 text-center text-sm font-semibold text-[#3f6f12]">Seus lugares estão guardados por {formatarTempoRestante(restante)}</div>;
}
