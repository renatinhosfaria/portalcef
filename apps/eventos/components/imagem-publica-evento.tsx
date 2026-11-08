"use client";

import React, { useState } from "react";
import Image from "next/image";

type Props = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  ajuste?: "cobrir" | "conter";
};

export function ImagemPublicaEvento({ src, alt, className = "", sizes, fill = false, width, height, ajuste = "cobrir" }: Props): React.JSX.Element {
  const [falhou, setFalhou] = useState(false);
  if (!src || falhou) return <div role="img" aria-label={alt || "Imagem do evento"} className={`flex items-center justify-center bg-[var(--brand-green)] px-6 text-center font-display text-2xl font-semibold text-white ${className}`}>Essência Feliz</div>;
  return <Image src={src} alt={alt} className={`${className} object-${ajuste}`} sizes={sizes} fill={fill} width={fill ? undefined : width} height={fill ? undefined : height} onError={() => setFalhou(true)} />;
}
