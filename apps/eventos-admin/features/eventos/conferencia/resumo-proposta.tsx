"use client";

import React from "react";
import { resumoProposta, ROTULO_CATEGORIA, type CategoriaLugar } from "@essencia/shared/eventos/mapa-proposta";

type Resumo = ReturnType<typeof resumoProposta>;

const CATEGORIAS_EXIBIDAS: CategoriaLugar[] = ["COMUM", "CADEIRANTE", "OPCIONAL_CADEIRANTE", "OBESO"];

export function ResumoProposta({ resumo }: { resumo: Resumo }) {
  const itens: Array<{ valor: number; rotulo: string }> = [
    { valor: resumo.fileiras, rotulo: "fileiras" },
    { valor: resumo.blocos, rotulo: "blocos" },
    { valor: resumo.lugares, rotulo: "lugares" },
    ...CATEGORIAS_EXIBIDAS.map((categoria) => ({ valor: resumo.porCategoria[categoria], rotulo: ROTULO_CATEGORIA[categoria].toLowerCase() })),
    { valor: resumo.porCategoria.SEM_CATEGORIA, rotulo: "sem categoria" },
    { valor: resumo.acessoExterno, rotulo: "acesso externo" },
    { valor: resumo.naoVender, rotulo: "não vender" },
  ];
  return (
    <ul aria-label="Resumo da proposta" className="flex flex-wrap gap-2">
      {itens.map((item) => (
        <li key={item.rotulo} className="rounded-xl border border-[#e5e8df] bg-white px-3 py-2">
          <strong className="block font-[family-name:var(--font-display,Outfit),system-ui,sans-serif] text-lg text-[#24302c]">{item.valor}</strong>
          <span className="text-xs text-[#69736e]">{item.rotulo}</span>
        </li>
      ))}
    </ul>
  );
}
