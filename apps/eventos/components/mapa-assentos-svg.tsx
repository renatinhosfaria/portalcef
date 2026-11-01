"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import type { PublicMap, PublicSeat } from "@essencia/shared/types";
import type { AssentoSelecionado } from "./assentos-types";
import { calcularBoundsFileira, calcularBoundsMapa, calcularViewBoxMapa, type Bounds } from "./mapa-assentos-utils";

const estadoLabel: Record<PublicSeat["state"], string> = {
  available: "disponível",
  reserved: "reservado",
  sold: "vendido",
  blocked: "bloqueado",
};

function rotuloAssento(seat: PublicSeat): string {
  return `${seat.rowLabel}-${seat.seatNumber}`;
}

function descricaoAssento(seat: PublicSeat): string {
  const acessibilidade = seat.accessible ? ", assento acessível" : ", assento não acessível";
  return `Assento ${rotuloAssento(seat)}, ${estadoLabel[seat.state]}${acessibilidade}`;
}

function categoriaAssento(seat: PublicSeat): string {
  return seat.category?.trim() || "não informada";
}

function corAssento(seat: PublicSeat, selecionado: boolean): string {
  if (selecionado) return "#1d4ed8";
  if (seat.state === "available") return "#ffffff";
  if (seat.state === "reserved") return "#fef3c7";
  if (seat.state === "sold") return "#fee2e2";
  return "#cbd5e1";
}

function limitarTransform(transform: ZoomTransform, bounds: Bounds): ZoomTransform {
  const escala = Math.max(1, Math.min(4, transform.k));
  const minX = bounds.minX * (1 - escala) - bounds.width * escala;
  const maxX = bounds.minX + bounds.width;
  const minY = bounds.minY * (1 - escala) - bounds.height * escala;
  const maxY = bounds.minY + bounds.height;
  return zoomIdentity.scale(escala).translate(
    Math.max(minX, Math.min(maxX, transform.x / escala)),
    Math.max(minY, Math.min(maxY, transform.y / escala)),
  );
}

export function MapaAssentosSvg({ map, selection, focusRow, onToggleSeat }: { map: PublicMap; selection: AssentoSelecionado[]; focusRow?: string; onToggleSeat: (seat: PublicSeat) => void }): React.JSX.Element {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const grupoRef = useRef<SVGGElement | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const bounds = useMemo(() => calcularBoundsMapa(map.seats), [map.seats]);
  const viewBox = useMemo(() => calcularViewBoxMapa(bounds), [bounds]);
  const selectedIds = useMemo(() => new Set(selection.map((item) => item.seatId)), [selection]);

  const aplicarTransform = useCallback((transform: ZoomTransform) => {
    const svg = svgRef.current;
    const grupo = grupoRef.current;
    if (!svg || !grupo || !zoomRef.current) return;
    select(svg).call(zoomRef.current.transform, limitarTransform(transform, bounds));
  }, [bounds]);

  useEffect(() => {
    const svg = svgRef.current;
    const grupo = grupoRef.current;
    if (!svg || !grupo) return;
    const comportamento = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 4])
      .translateExtent([[bounds.minX, bounds.minY], [bounds.minX + bounds.width, bounds.minY + bounds.height]])
      .on("zoom", (event) => {
        grupo.setAttribute("transform", event.transform.toString());
      });
    zoomRef.current = comportamento;
    select(svg).call(comportamento);
    select(svg).call(comportamento.transform, zoomIdentity);
    return () => {
      select(svg).on(".zoom", null);
      zoomRef.current = null;
    };
  }, [bounds]);

  useEffect(() => {
    if (!focusRow) return;
    const fileira = calcularBoundsFileira(map.seats, focusRow);
    if (!fileira) return;
    const escala = Math.min(3, Math.max(1, Math.min(bounds.width / Math.max(fileira.width, 1), bounds.height / Math.max(fileira.height, 1)) * 0.8));
    const centroMapaX = bounds.minX + bounds.width / 2;
    const centroMapaY = bounds.minY + bounds.height / 2;
    const centroFileiraX = fileira.minX + fileira.width / 2;
    const centroFileiraY = fileira.minY + fileira.height / 2;
    aplicarTransform(zoomIdentity.translate(centroMapaX - escala * centroFileiraX, centroMapaY - escala * centroFileiraY).scale(escala));
  }, [aplicarTransform, bounds, focusRow, map.seats]);

  const ajustarZoom = (delta: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    select(svgRef.current).call(delta > 0 ? zoomRef.current.scaleBy : zoomRef.current.scaleBy, delta > 0 ? 1.35 : 1 / 1.35);
  };

  const centralizar = () => aplicarTransform(zoomIdentity);

  const ativarAssento = (seat: PublicSeat, event: React.KeyboardEvent<SVGGElement>) => {
    if (seat.state !== "available") return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggleSeat(seat);
    }
  };

  return <div className="relative w-full rounded-lg border border-slate-200 bg-slate-50 p-3">
    <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="Controles do mapa">
      <button type="button" tabIndex={0} aria-label="Aumentar zoom" onClick={() => ajustarZoom(1)} className="rounded border px-3 py-2 focus-visible:outline focus-visible:outline-2">+</button>
      <button type="button" tabIndex={0} aria-label="Reduzir zoom" onClick={() => ajustarZoom(-1)} className="rounded border px-3 py-2 focus-visible:outline focus-visible:outline-2">−</button>
      <button type="button" tabIndex={0} aria-label="Centralizar mapa" onClick={centralizar} className="rounded border px-3 py-2 focus-visible:outline focus-visible:outline-2">Centralizar</button>
    </div>
    <svg ref={svgRef} role="img" aria-label="Planta de assentos" viewBox={viewBox} className="h-96 w-full touch-none" preserveAspectRatio="xMidYMid meet">
      <title>Planta de assentos</title>
      <g ref={grupoRef}>
        {map.seats.map((seat) => {
          const selecionado = selectedIds.has(seat.id);
          const label = descricaoAssento(seat);
          const indisponivel = seat.state !== "available";
          return <g key={seat.id} data-seat-id={seat.id} role={indisponivel ? "img" : "button"} tabIndex={indisponivel ? -1 : 0} aria-label={`${label}, categoria ${categoriaAssento(seat)}`} aria-disabled={indisponivel ? "true" : undefined} aria-pressed={!indisponivel ? selecionado : undefined} className={`${selecionado ? "assento-selecionado" : ""} ${indisponivel ? "" : "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"}`} onClick={() => { if (!indisponivel) onToggleSeat(seat); }} onKeyDown={(event) => ativarAssento(seat, event)}>
            <rect x={seat.x} y={seat.y} width={Math.max(1, seat.width)} height={Math.max(1, seat.height)} rx={Math.min(2, Math.max(0, seat.height / 5))} fill={corAssento(seat, selecionado)} stroke={selecionado ? "#1e3a8a" : "#475569"} strokeWidth={selecionado ? 1.5 : 0.8} />
            <text x={seat.x + Math.max(1, seat.width) / 2} y={seat.y + Math.max(1, seat.height) / 2} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(2, Math.min(8, seat.height * 0.55))} fill={selecionado ? "#ffffff" : "#0f172a"}>{rotuloAssento(seat)}</text>
            <title>{`${label}, categoria ${categoriaAssento(seat)}`}</title>
          </g>;
        })}
      </g>
    </svg>
  </div>;
}
