"use client";
import { useState } from "react";
import type { PublicMap, PublicSeat } from "@essencia/shared/types";

export function classeEstadoAssento(state: PublicSeat["state"]): string {
  return { available: "available border-slate-300 bg-white", reserved: "reserved border-amber-400 bg-amber-100 text-amber-900", sold: "sold border-red-400 bg-red-100 text-red-900", blocked: "blocked border-slate-500 bg-slate-400 text-slate-800" }[state];
}
export function MapaAssentos({ map, checkoutHref, ticketTypeId }: { map: PublicMap; checkoutHref: string; ticketTypeId?: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const query = selected.length ? `?assentos=${encodeURIComponent(selected.join(","))}${ticketTypeId ? `&ticketTypeId=${encodeURIComponent(ticketTypeId)}` : ""}&sessionId=${encodeURIComponent(map.sessionId)}` : undefined;
  const target = query ? `${checkoutHref}${checkoutHref.includes("?") ? "&" : ""}${query.slice(1)}` : undefined;
  return <div><div className="mb-4 flex flex-wrap gap-3 text-xs" aria-label="Legenda dos assentos"><span className="rounded border border-slate-300 bg-white px-2 py-1">Disponível</span><span className="rounded border border-amber-400 bg-amber-100 px-2 py-1">Reservado</span><span className="rounded border border-red-400 bg-red-100 px-2 py-1">Vendido</span><span className="rounded border border-slate-500 bg-slate-400 px-2 py-1">Bloqueado</span></div><div className="grid grid-cols-4 gap-2 sm:grid-cols-6">{map.seats.map((seat) => { const available = seat.state === "available"; const active = selected.includes(seat.id); return <button key={seat.id} type="button" disabled={!available} aria-label={`Assento ${seat.rowLabel}-${seat.seatNumber}`} onClick={() => setSelected((current) => active ? current.filter((id) => id !== seat.id) : [...current, seat.id])} className={`rounded border px-2 py-3 text-sm ${classeEstadoAssento(seat.state)} ${active ? "ring-2 ring-blue-700" : ""}`}>{seat.rowLabel}-{seat.seatNumber}<span className="sr-only"> {seat.state}</span></button>; })}</div><a aria-disabled={!selected.length} href={target} className={`mt-5 inline-block rounded px-4 py-2 text-white ${selected.length ? "bg-blue-700" : "pointer-events-none bg-slate-400"}`}>Continuar para checkout</a></div>;
}
