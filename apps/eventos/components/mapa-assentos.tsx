"use client";

import React, { useMemo, useState } from "react";
import type { PublicEventTicketType, PublicMap, PublicSeat } from "@essencia/shared/types";
import { ResumoAssentos, type AssentoSelecionado } from "./resumo-assentos";
import { calcularBoundsMapa, estiloAssento, serializarSelecaoAssentos } from "./mapa-assentos-utils";

export function classeEstadoAssento(state: PublicSeat["state"]): string {
  return {
    available: "available border-slate-300 bg-white text-slate-900",
    reserved: "reserved border-amber-400 bg-amber-100 text-amber-900",
    sold: "sold border-red-400 bg-red-100 text-red-900",
    blocked: "blocked border-slate-500 bg-slate-400 text-slate-800",
  }[state];
}

const estadoLabel: Record<PublicSeat["state"], string> = { available: "disponível", reserved: "reservado", sold: "vendido", blocked: "bloqueado" };

function descricaoAssento(seat: PublicSeat) {
  return `Assento ${seat.rowLabel}-${seat.seatNumber}, ${estadoLabel[seat.state]}${seat.accessible ? ", assento acessível" : ""}`;
}

export function MapaAssentos({ map, checkoutHref, ticketTypes, initialTicketTypeId }: { map: PublicMap; checkoutHref: string; ticketTypes: PublicEventTicketType[]; initialTicketTypeId?: string }): React.JSX.Element {
  const [selection, setSelection] = useState<AssentoSelecionado[]>([]);
  const bounds = useMemo(() => calcularBoundsMapa(map.seats), [map.seats]);
  const selectedIds = new Set(selection.map((item) => item.seatId));
  const hasIncompleteSelection = selection.some((item) => !item.ticketTypeId);
  const query = selection.length && !hasIncompleteSelection
    ? `${serializarSelecaoAssentos(selection)}&sessionId=${encodeURIComponent(map.sessionId)}`
    : undefined;
  const target = query ? `${checkoutHref}${checkoutHref.includes("?") ? "&" : "?"}${query}` : undefined;

  function alternarAssento(seat: PublicSeat) {
    if (seat.state !== "available") return;
    setSelection((current) => selectedIds.has(seat.id)
      ? current.filter((item) => item.seatId !== seat.id)
      : [...current, { seatId: seat.id, ticketTypeId: initialTicketTypeId && ticketTypes.some((type) => type.id === initialTicketTypeId) ? initialTicketTypeId : ticketTypes[0]?.id ?? "", label: `${seat.rowLabel}-${seat.seatNumber}`, accessible: seat.accessible }]);
  }

  return <div>
    <div className="mb-4 flex flex-wrap gap-3 text-xs" aria-label="Legenda dos assentos">
      <span className="rounded border border-slate-300 bg-white px-2 py-1">Disponível</span>
      <span className="rounded border border-amber-400 bg-amber-100 px-2 py-1">Reservado</span>
      <span className="rounded border border-red-400 bg-red-100 px-2 py-1">Vendido</span>
      <span className="rounded border border-slate-500 bg-slate-400 px-2 py-1">Bloqueado</span>
    </div>
    <div className="relative min-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3" aria-label="Planta de assentos">
      <div className="relative min-h-56 min-w-[24rem]" style={{ aspectRatio: `${bounds.width} / ${bounds.height}` }}>
        {map.seats.map((seat) => {
          const active = selectedIds.has(seat.id);
          const className = `absolute rounded border px-1 py-1 text-xs ${classeEstadoAssento(seat.state)} ${active ? "ring-2 ring-blue-700" : ""} motion-safe:transition-shadow motion-reduce:transition-none`;
          const label = descricaoAssento(seat);
          const content = <><span>{seat.rowLabel}-{seat.seatNumber}</span>{seat.accessible && <span className="sr-only"> assento acessível</span>}</>;
          if (seat.state === "available") return <button key={seat.id} type="button" aria-label={label} aria-pressed={active} onClick={() => alternarAssento(seat)} className={className} style={estiloAssento(seat, bounds)}>{content}</button>;
          return <span key={seat.id} role="checkbox" aria-label={label} aria-disabled="true" aria-checked="false" className={className} style={estiloAssento(seat, bounds)}>{content}</span>;
        })}
      </div>
    </div>
    <ResumoAssentos selection={selection} ticketTypes={ticketTypes} onChangeTicketType={(seatId, ticketTypeId) => setSelection((current) => current.map((item) => item.seatId === seatId ? { ...item, ticketTypeId } : item))} />
    <a aria-disabled={!target} href={target} className={`mt-5 inline-block rounded px-4 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${target ? "bg-blue-700" : "pointer-events-none bg-slate-400"}`}>Continuar para checkout</a>
    <p className="sr-only" aria-live="polite">{selection.length ? `${selection.length} assento(s) selecionado(s)` : "Nenhum assento selecionado"}</p>
  </div>;
}
