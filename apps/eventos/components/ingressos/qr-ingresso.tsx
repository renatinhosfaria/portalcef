"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrIngresso({ conteudo, tamanho = 180 }: { conteudo: string; tamanho?: number }): React.JSX.Element {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    QRCode.toString(conteudo, { type: "svg", margin: 1, width: tamanho })
      .then((resultado) => { if (ativo) setSvg(resultado); })
      .catch(() => { if (ativo) setSvg(null); });
    return () => { ativo = false; };
  }, [conteudo, tamanho]);

  if (svg) return <div className="flex min-h-44 min-w-44 items-center justify-center rounded-xl bg-white p-2" aria-label="QR code do ingresso" dangerouslySetInnerHTML={{ __html: svg }} />;
  return <div className="flex min-h-44 min-w-44 items-center justify-center rounded-xl bg-white p-2" aria-label="QR code do ingresso"><span className="text-xs text-[var(--tinta-2)]">Gerando QR…</span></div>;
}
