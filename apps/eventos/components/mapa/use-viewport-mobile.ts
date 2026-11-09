"use client";

import { useEffect, useState } from "react";

const CONSULTA_MOBILE = "(max-width: 767px)";

export function useViewportMobile(): boolean {
  const [ehMobile, setEhMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const consulta = window.matchMedia(CONSULTA_MOBILE);
    const atualizar = (evento?: MediaQueryListEvent) => setEhMobile(evento?.matches ?? consulta.matches);
    atualizar();
    if (typeof consulta.addEventListener === "function") consulta.addEventListener("change", atualizar);
    else if (typeof consulta.addListener === "function") consulta.addListener(atualizar);
    return () => {
      if (typeof consulta.removeEventListener === "function") consulta.removeEventListener("change", atualizar);
      else if (typeof consulta.removeListener === "function") consulta.removeListener(atualizar);
    };
  }, []);

  return ehMobile;
}
