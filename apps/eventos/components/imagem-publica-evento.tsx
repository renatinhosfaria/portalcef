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
  const objectClass = ajuste === "conter" ? "object-contain" : "object-cover";
  if (!src || falhou) return <div role="img" aria-label={alt || "Imagem do evento"} className={`flex items-center justify-center bg-[var(--brand-green)] px-6 text-center font-display text-2xl font-semibold text-white ${objectClass} ${className}`}>Essência Feliz</div>;
  return <Image src={src} alt={alt} className={`${className} ${objectClass}`} sizes={sizes} fill={fill} width={fill ? undefined : width} height={fill ? undefined : height} onError={() => setFalhou(true)} />;
}
