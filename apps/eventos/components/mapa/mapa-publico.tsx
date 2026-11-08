"use client";

import React, { useMemo, useRef, useState } from "react";
import type { PublicMap } from "@essencia/shared/types";
import { MapaEstiloB, type ControleMapa, type LugarMapa } from "@essencia/components/eventos/mapa-estilo-b";
import { dimensoesDoMapa, elementosDoMapa, paraLugaresPublicos, rotulosDoMapa, type LugarPublico } from "./adaptar-mapa";
import { LetrasLaterais } from "./letras-laterais";
import { Minimapa } from "./minimapa";

const CORES_LIVRE = { preenchimento: "#ffffff", contorno: "#9fb08a", numero: "#1f2a24" };
const CORES_SELECIONADO = { preenchimento: "#3f6f12", contorno: "#2a4d0a", numero: "#ffffff" };
const CORES_OCUPADO = { preenchimento: "#e4e6e1", contorno: "#c9cdc6", numero: "#8a918c" };
const CORES_ACESSIVEL = { preenchimento: "#eff6ff", contorno: "#3b82f6", numero: "#1e3a8a" };

export function coresPublicas(lugar: LugarPublico, selecionado: boolean): { preenchimento: string; contorno: string; numero: string } {
  if (selecionado) return CORES_SELECIONADO;
  if (!lugar.livre) return CORES_OCUPADO;
  if (lugar.acessivel) return CORES_ACESSIVEL;
  return CORES_LIVRE;
}

export function rotuloAcessivelPublico(lugar: LugarPublico, selecionado: boolean): string {
  const estado = lugar.livre ? "livre" : "ocupado";
  return `Fileira ${lugar.fileira}, assento ${lugar.numero}, ${estado}${lugar.acessivel ? ", acessível" : ""}${selecionado ? ", seu lugar" : ""}`;
}

function rotuloTooltip(lugar: LugarPublico): string {
  return `Fileira ${lugar.fileira} · Assento ${lugar.numero} · ${lugar.livre ? "Livre" : "Ocupado"}`;
}

export interface MapaPublicoProps {
  map: PublicMap;
  selecionados: ReadonlySet<string>;
  indisponiveis?: ReadonlySet<string>;
  onAlternar: (seatId: string) => void;
  className?: string;
}

export function MapaPublico({ map, selecionados, indisponiveis = new Set(), onAlternar, className }: MapaPublicoProps): React.JSX.Element {
  const controleRef = useRef<ControleMapa>(null);
  const [transformacao, setTransformacao] = useState({ x: 0, y: 0, k: 1 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const lugares = useMemo(() => paraLugaresPublicos(map, indisponiveis), [map, indisponiveis]);
  const dimensoes = useMemo(() => dimensoesDoMapa(map), [map]);
  const rotulos = useMemo(() => rotulosDoMapa(map), [map]);
  const elementos = useMemo(() => elementosDoMapa(map), [map]);
  const lugarPorId = useMemo(() => new Map(lugares.map((lugar) => [lugar.id, lugar])), [lugares]);
  const lugarHover = hoveredId ? lugarPorId.get(hoveredId) : undefined;

  function aoPassarMouse(evento: React.MouseEvent<HTMLDivElement>): void {
    const alvo = evento.target instanceof Element ? evento.target.closest<SVGGElement>("[data-lugar-id]") : null;
    setHoveredId(alvo?.getAttribute("data-lugar-id") ?? null);
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-[#e6e9e1] bg-[#faf9f5] ${className ?? ""}`} onMouseOver={aoPassarMouse} onMouseLeave={() => setHoveredId(null)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-3 pt-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Controles do mapa">
          <button type="button" aria-label="Aumentar zoom" onClick={() => controleRef.current?.aproximar()} className="min-h-10 min-w-10 rounded-lg border border-[#d9ddcf] bg-white px-3 text-lg font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#3f6f12]">+</button>
          <button type="button" aria-label="Reduzir zoom" onClick={() => controleRef.current?.afastar()} className="min-h-10 min-w-10 rounded-lg border border-[#d9ddcf] bg-white px-3 text-lg font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#3f6f12]">−</button>
          <button type="button" aria-label="Ver tudo" onClick={() => controleRef.current?.enquadrar()} className="min-h-10 rounded-lg border border-[#d9ddcf] bg-white px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#3f6f12]">Ver tudo</button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs" aria-label="Legenda do mapa">
          <span className="inline-flex items-center gap-1"><i aria-hidden="true" className="h-3 w-3 rounded-sm border border-[#9fb08a] bg-white" />Livre</span>
          <span className="inline-flex items-center gap-1"><i aria-hidden="true" className="h-3 w-3 rounded-sm border border-[#2a4d0a] bg-[#3f6f12]" />Seu lugar</span>
          <span className="inline-flex items-center gap-1"><i aria-hidden="true" className="h-3 w-3 rounded-sm border border-[#c9cdc6] bg-[#e4e6e1]" />Ocupado</span>
          <span className="inline-flex items-center gap-1"><i aria-hidden="true" className="h-3 w-3 rounded-sm border border-[#3b82f6] bg-[#eff6ff]" />Acessível</span>
        </div>
      </div>
      <div className="relative h-[min(70vh,38rem)] min-h-[20rem] px-2 pb-2" data-testid="mapa-publico">
        <MapaEstiloB
          largura={dimensoes.largura}
          altura={dimensoes.altura}
          lugares={lugares}
          rotulos={rotulos}
          elementos={elementos}
          rotuloAcessivel="Mapa público de assentos"
          selecionados={selecionados}
          coresDoLugar={(lugar, selecionado) => coresPublicas(lugarPorId.get(lugar.id) ?? (lugar as LugarPublico), selecionado)}
          rotuloDoLugar={(lugar) => rotuloAcessivelPublico(lugarPorId.get(lugar.id) ?? (lugar as LugarPublico), selecionados.has(lugar.id))}
          lugarDesabilitado={(lugar) => !(lugarPorId.get(lugar.id)?.livre ?? false)}
          escalaMinimaNumeros={3}
          controleRef={controleRef}
          onTransformacao={setTransformacao}
          onLugarClick={(id) => {
            if (lugarPorId.get(id)?.livre) onAlternar(id);
          }}
        />
        <LetrasLaterais lugares={lugares} transformacao={transformacao} largura={dimensoes.largura} altura={dimensoes.altura} />
        <Minimapa largura={dimensoes.largura} altura={dimensoes.altura} lugares={lugares} transformacao={transformacao} />
        {lugarHover ? <div role="tooltip" className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-full bg-[#1f2a24] px-3 py-1.5 text-xs font-semibold text-white shadow">{rotuloTooltip(lugarHover)}</div> : null}
      </div>
    </div>
  );
}

export type { LugarPublico, LugarMapa };
