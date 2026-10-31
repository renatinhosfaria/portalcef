"use client";

import React, { useMemo, useState } from "react";
import type { PublicEventTicketType, PublicMap, PublicSeat } from "@essencia/shared/types";
import { ResumoAssentos, ResumoAssentosFixo, type AssentoSelecionado } from "./resumo-assentos";
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

function categoriaAssento(seat: PublicSeat) {
  return seat.category?.trim() || "não informada";
}

function rotuloAssento(seat: PublicSeat) {
  return `${seat.rowLabel}-${seat.seatNumber}`;
}

export function MapaAssentos({ map, checkoutHref, ticketTypes, initialTicketTypeId }: { map: PublicMap; checkoutHref: string; ticketTypes: PublicEventTicketType[]; initialTicketTypeId?: string }): React.JSX.Element {
  const [selection, setSelection] = useState<AssentoSelecionado[]>([]);
  const bounds = useMemo(() => calcularBoundsMapa(map.seats), [map.seats]);
  const selectedIds = new Set(selection.map((item) => item.seatId));
  const fileiras = useMemo(() => Array.from(new Set(map.seats.map((seat) => seat.rowLabel))), [map.seats]);
  const fileirasComDisponibilidade = useMemo(() => fileiras.filter((fileira) => map.seats.some((seat) => seat.rowLabel === fileira && seat.state === "available")), [fileiras, map.seats]);
  const primeiraFileira = fileirasComDisponibilidade[0] ?? fileiras[0] ?? "";
  const [fileiraSelecionada, setFileiraSelecionada] = useState(primeiraFileira);
  const [modoVisualizacao, setModoVisualizacao] = useState<"lista" | "mapa">("lista");
  const fileiraAtiva = fileiras.includes(fileiraSelecionada) ? fileiraSelecionada : primeiraFileira;
  const assentosDaFileira = useMemo(() => map.seats.filter((seat) => seat.rowLabel === fileiraAtiva), [fileiraAtiva, map.seats]);
  const hasIncompleteSelection = selection.some((item) => !item.ticketTypeId);
  const query = selection.length && !hasIncompleteSelection
    ? `${serializarSelecaoAssentos(selection)}&sessionId=${encodeURIComponent(map.sessionId)}`
    : undefined;
  const target = query ? `${checkoutHref}${checkoutHref.includes("?") ? "&" : "?"}${query}` : undefined;

  function alternarAssento(seat: PublicSeat) {
    if (seat.state !== "available") return;
    setSelection((current) => selectedIds.has(seat.id)
      ? current.filter((item) => item.seatId !== seat.id)
      : [...current, { seatId: seat.id, ticketTypeId: initialTicketTypeId && ticketTypes.some((type) => type.id === initialTicketTypeId) ? initialTicketTypeId : ticketTypes[0]?.id ?? "", label: rotuloAssento(seat), accessible: seat.accessible }]);
  }

  function alterarTipoIngresso(seatId: string, ticketTypeId: string) {
    setSelection((current) => current.map((item) => item.seatId === seatId ? { ...item, ticketTypeId } : item));
  }

  function renderAssentoNoMapa(seat: PublicSeat) {
    const active = selectedIds.has(seat.id);
    const className = `absolute rounded border px-1 py-1 text-xs ${classeEstadoAssento(seat.state)} ${active ? "ring-2 ring-blue-700" : ""} motion-safe:transition-shadow motion-reduce:transition-none`;
    const label = descricaoAssento(seat);
    const content = <><span>{rotuloAssento(seat)}</span>{seat.accessible && <span className="sr-only"> assento acessível</span>}</>;
    if (seat.state === "available") return <button key={seat.id} type="button" aria-label={label} aria-pressed={active} onClick={() => alternarAssento(seat)} className={className} style={estiloAssento(seat, bounds)}>{content}</button>;
    return <span key={seat.id} role="checkbox" aria-label={label} aria-disabled="true" aria-checked="false" className={className} style={estiloAssento(seat, bounds)}>{content}</span>;
  }

  function renderMapaVisual(label: string) {
    return <div className="relative min-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3" aria-label={label}>
      <p className="mb-2 text-xs text-slate-600">Use a rolagem horizontal para visualizar toda a planta.</p>
      <div className="relative min-h-56 min-w-[24rem]" style={{ aspectRatio: `${bounds.width} / ${bounds.height}` }}>
        {map.seats.map(renderAssentoNoMapa)}
      </div>
    </div>;
  }

  function renderAssentoNaLista(seat: PublicSeat) {
    const selecionado = selectedIds.has(seat.id);
    const detalhe = `Estado: ${estadoLabel[seat.state]} · Categoria: ${categoriaAssento(seat)}${seat.accessible ? " · acessível" : ""}${selecionado ? " · selecionado" : ""}`;
    return <li key={`lista-${seat.id}`} className="rounded-lg border border-slate-200 bg-white p-3">
      {seat.state === "available" ? <button type="button" aria-label={descricaoAssento(seat)} aria-pressed={selecionado} onClick={() => alternarAssento(seat)} className={`flex min-h-12 w-full items-center justify-between gap-3 text-left ${selecionado ? "text-blue-800" : "text-slate-950"}`}>
        <span><span className="block font-semibold">Assento {rotuloAssento(seat)}</span><span className="mt-1 block text-sm text-slate-600">{detalhe}</span></span>
        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">Selecionar</span>
      </button> : <div className="flex min-h-12 items-center justify-between gap-3 text-slate-700" aria-label={descricaoAssento(seat)} aria-disabled="true">
        <span><span className="block font-semibold">Assento {rotuloAssento(seat)}</span><span className="mt-1 block text-sm text-slate-600">{detalhe}</span></span>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">Indisponível</span>
      </div>}
    </li>;
  }

  return <div className="pb-24 md:pb-0">
    <div className="mb-4 flex flex-wrap gap-3 text-xs" aria-label="Legenda dos assentos">
      <span className="rounded border border-slate-300 bg-white px-2 py-1">Disponível</span>
      <span className="rounded border border-amber-400 bg-amber-100 px-2 py-1">Reservado</span>
      <span className="rounded border border-red-400 bg-red-100 px-2 py-1">Vendido</span>
      <span className="rounded border border-slate-500 bg-slate-400 px-2 py-1">Bloqueado</span>
    </div>

    <section className="md:hidden" aria-label="Seleção de assentos no celular">
      <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Modo de visualização dos assentos">
        <button type="button" aria-pressed={modoVisualizacao === "lista"} onClick={() => setModoVisualizacao("lista")} className={`min-h-11 flex-1 rounded-md px-3 text-sm font-semibold ${modoVisualizacao === "lista" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"}`}>Lista</button>
        <button type="button" aria-pressed={modoVisualizacao === "mapa"} onClick={() => setModoVisualizacao("mapa")} className={`min-h-11 flex-1 rounded-md px-3 text-sm font-semibold ${modoVisualizacao === "mapa" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"}`}>Mapa</button>
      </div>

      <div className="mt-4">
        <label htmlFor="escolha-fileira" className="block text-sm font-semibold text-slate-950">Escolha uma fileira</label>
        <select id="escolha-fileira" aria-label="Escolha uma fileira" value={fileiraAtiva} onChange={(event) => setFileiraSelecionada(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base">
          {fileiras.length ? fileiras.map((fileira) => <option key={fileira} value={fileira}>{fileira}</option>) : <option value="">Nenhuma fileira</option>}
        </select>
      </div>

      <p className="mt-3 text-sm text-slate-600">Escolha uma fileira para conferir os lugares. O mapa rolável funciona melhor na horizontal.</p>

      {modoVisualizacao === "lista" ? <div className="mt-4">
        <h2 className="text-base font-semibold">Lista de assentos</h2>
        {assentosDaFileira.length ? <ul className="mt-3 space-y-2" aria-label={`Assentos da fileira ${fileiraAtiva}`}>{assentosDaFileira.map(renderAssentoNaLista)}</ul> : <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600" aria-live="polite">Nenhum assento disponível nesta fileira.</p>}
        {assentosDaFileira.length > 0 && !assentosDaFileira.some((seat) => seat.state === "available") && <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600" aria-live="polite">Nenhum assento disponível nesta fileira.</p>}
      </div> : <div className="mt-4">{renderMapaVisual("Planta de assentos móvel")}</div>}
    </section>

    <section className="hidden md:block" aria-label="Mapa de assentos para computador">
      {renderMapaVisual("Planta de assentos")}
    </section>

    <ResumoAssentos selection={selection} ticketTypes={ticketTypes} onChangeTicketType={alterarTipoIngresso} />
    <ResumoAssentosFixo selection={selection} ticketTypes={ticketTypes} checkoutHref={target} onChangeTicketType={alterarTipoIngresso} />
    <a aria-disabled={!target} href={target} className={`mt-5 inline-block rounded px-4 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${target ? "bg-blue-700" : "pointer-events-none bg-slate-400"}`}>Continuar para checkout</a>
    <p className="sr-only" aria-live="polite">{selection.length ? `${selection.length} assento(s) selecionado(s)` : "Nenhum assento selecionado"}</p>
  </div>;
}
