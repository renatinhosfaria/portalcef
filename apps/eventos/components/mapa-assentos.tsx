"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { OfertaPrecoPublica, PublicEventTicketType, PublicMap, PublicSeat } from "@essencia/shared/types";
import { MapaAssentosSvg } from "./mapa-assentos-svg";
import { ResumoAssentos, ResumoAssentosFixo, type AssentoSelecionado } from "./resumo-assentos";
import { serializarSelecaoAssentos } from "./mapa-assentos-utils";

export function classeEstadoAssento(state: PublicSeat["state"]): string {
  return {
    available: "available border-slate-300 bg-white text-slate-900",
    reserved: "reserved border-amber-400 bg-amber-100 text-amber-900",
    sold: "sold border-red-400 bg-red-100 text-red-900",
    blocked: "blocked border-slate-500 bg-slate-400 text-slate-800",
  }[state];
}

const estadoLabel: Record<PublicSeat["state"], string> = { available: "disponível", reserved: "reservado", sold: "vendido", blocked: "bloqueado" };
const MAX_ASSENTOS_PEDIDO = 20;

function descricaoAssento(seat: PublicSeat) {
  return `Assento ${seat.rowLabel}-${seat.seatNumber}, ${estadoLabel[seat.state]}, categoria ${categoriaAssento(seat)}${seat.accessible ? ", assento acessível" : ", assento não acessível"}`;
}

function categoriaAssento(seat: PublicSeat) {
  return seat.category?.trim() || "não informada";
}

function rotuloAssento(seat: PublicSeat) {
  return `${seat.rowLabel}-${seat.seatNumber}`;
}

function normalizarSelecaoInicial(map: PublicMap, selection: AssentoSelecionado[], unavailableSeatIds: string[]) {
  const indisponiveis = new Set(unavailableSeatIds);
  const seatsById = new Map(map.seats.map((seat) => [seat.id, seat]));
  return selection.flatMap((item) => {
    const seat = seatsById.get(item.seatId);
    if (!seat || seat.state !== "available" || indisponiveis.has(seat.id)) return [];
    return [{
      ...item,
      label: item.label ?? rotuloAssento(seat),
      accessible: item.accessible ?? seat.accessible,
    }];
  }).slice(0, MAX_ASSENTOS_PEDIDO);
}

export type MapaAssentosProps = {
  map: PublicMap;
  checkoutHref: string;
  ticketTypes: PublicEventTicketType[];
  offers?: OfertaPrecoPublica[];
  initialTicketTypeId?: string;
  initialSelection?: AssentoSelecionado[];
  unavailableSeatIds?: string[];
  initialSelectionInvalid?: boolean;
};

export function MapaAssentos({ map, checkoutHref, ticketTypes, offers = [], initialTicketTypeId, initialSelection = [], unavailableSeatIds = [], initialSelectionInvalid = false }: MapaAssentosProps): React.JSX.Element {
  const selecaoInicial = normalizarSelecaoInicial(map, initialSelection, unavailableSeatIds);
  const [selection, setSelection] = useState<AssentoSelecionado[]>(() => selecaoInicial);
  const [selectionInvalid, setSelectionInvalid] = useState(initialSelectionInvalid);
  const [selectionLimitReached, setSelectionLimitReached] = useState(initialSelection.length > MAX_ASSENTOS_PEDIDO);
  const [fileiraSelecionada, setFileiraSelecionada] = useState("");
  const [modoVisualizacao, setModoVisualizacao] = useState<"lista" | "mapa">("lista");

  useEffect(() => {
    const media = typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(min-width: 768px)")
      : undefined;
    if (!media) return undefined;
    const atualizarModo = (event?: MediaQueryListEvent) => setModoVisualizacao((event?.matches ?? media.matches) ? "mapa" : "lista");
    atualizarModo();
    media.addEventListener?.("change", atualizarModo);
    media.addListener?.(atualizarModo);
    return () => {
      media.removeEventListener?.("change", atualizarModo);
      media.removeListener?.(atualizarModo);
    };
  }, []);

  const selectedIds = useMemo(() => new Set(selection.map((item) => item.seatId)), [selection]);
  const fileiras = useMemo(() => Array.from(new Set(map.seats.map((seat) => seat.rowLabel))), [map.seats]);
  const indisponiveis = useMemo(() => new Set(unavailableSeatIds), [unavailableSeatIds]);
  const fileirasComDisponibilidade = useMemo(() => fileiras.filter((fileira) => map.seats.some((seat) => seat.rowLabel === fileira && seat.state === "available" && !indisponiveis.has(seat.id))), [fileiras, indisponiveis, map.seats]);
  const primeiraFileira = fileirasComDisponibilidade[0] ?? fileiras[0] ?? "";
  const fileiraAtiva = fileiras.includes(fileiraSelecionada) ? fileiraSelecionada : primeiraFileira;
  const assentosDaFileira = useMemo(() => map.seats.filter((seat) => seat.rowLabel === fileiraAtiva), [fileiraAtiva, map.seats]);
  const conflitos = useMemo(() => unavailableSeatIds.map((id) => map.seats.find((seat) => seat.id === id)).filter((seat): seat is PublicSeat => Boolean(seat)), [map.seats, unavailableSeatIds]);
  const hasIncompleteSelection = selection.some((item) => !item.ticketTypeId || !ticketTypes.some((type) => type.id === item.ticketTypeId));
  const query = selection.length && !hasIncompleteSelection
    ? `${serializarSelecaoAssentos(selection)}&sessionId=${encodeURIComponent(map.sessionId)}`
    : undefined;
  const target = query && !selectionInvalid ? `${checkoutHref}${checkoutHref.includes("?") ? "&" : "?"}${query}` : undefined;

  function alternarAssento(seat: PublicSeat) {
    if (seat.state !== "available" || indisponiveis.has(seat.id)) return;
    if (!selectedIds.has(seat.id) && selection.length >= MAX_ASSENTOS_PEDIDO) {
      setSelectionLimitReached(true);
      return;
    }
    setSelectionLimitReached(false);
    if (!selectedIds.has(seat.id)) setSelectionInvalid(false);
    setSelection((current) => {
      if (current.some((item) => item.seatId === seat.id)) return current.filter((item) => item.seatId !== seat.id);
      const ticketTypeId = initialTicketTypeId && ticketTypes.some((type) => type.id === initialTicketTypeId) ? initialTicketTypeId : ticketTypes[0]?.id ?? "";
      return [...current, { seatId: seat.id, ticketTypeId, label: rotuloAssento(seat), accessible: seat.accessible }];
    });
  }

  function alterarTipoIngresso(seatId: string, ticketTypeId: string) {
    if (ticketTypes.some((type) => type.id === ticketTypeId)) setSelectionInvalid(false);
    setSelection((current) => current.map((item) => item.seatId === seatId ? { ...item, ticketTypeId } : item));
  }

  function renderAssentoNaLista(seat: PublicSeat) {
    const selecionado = selectedIds.has(seat.id);
    const detalhe = `Estado: ${estadoLabel[seat.state]} · Categoria: ${categoriaAssento(seat)}${seat.accessible ? " · acessível" : ""}${selecionado ? " · selecionado" : ""}`;
    return <li key={`lista-${seat.id}`} className="rounded-lg border border-slate-200 bg-white p-3">
      {seat.state === "available" && !indisponiveis.has(seat.id) ? <button type="button" aria-label={descricaoAssento(seat)} aria-pressed={selecionado} onClick={() => alternarAssento(seat)} className={`flex min-h-12 w-full items-center justify-between gap-3 text-left ${selecionado ? "text-blue-800" : "text-slate-950"}`}>
        <span><span className="block font-semibold">Assento {rotuloAssento(seat)}</span><span className="mt-1 block text-sm text-slate-600">{detalhe}</span></span>
        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">{selecionado ? "Selecionado" : "Selecionar"}</span>
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

    {conflitos.length > 0 && <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      {conflitos.map((seat) => <p key={`conflito-${seat.id}`}>Assento {rotuloAssento(seat)} ficou indisponível e foi removido da seleção.</p>)}
    </div>}
    {selectionInvalid && <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-950">Não foi possível restaurar a seleção de assentos. Revise os lugares antes de continuar.</p>}

    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Modo de visualização dos assentos">
        <button type="button" aria-pressed={modoVisualizacao === "lista"} onClick={() => setModoVisualizacao("lista")} className={`min-h-11 rounded-md px-4 text-sm font-semibold ${modoVisualizacao === "lista" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"}`}>Lista</button>
        <button type="button" aria-pressed={modoVisualizacao === "mapa"} onClick={() => setModoVisualizacao("mapa")} className={`min-h-11 rounded-md px-4 text-sm font-semibold ${modoVisualizacao === "mapa" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"}`}>Mapa</button>
      </div>
      <label htmlFor="escolha-fileira" className="text-sm font-semibold text-slate-950">Escolha uma fileira</label>
      <select id="escolha-fileira" aria-label="Escolha uma fileira" value={fileiraAtiva} onChange={(event) => setFileiraSelecionada(event.target.value)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-base">
        {fileiras.length ? fileiras.map((fileira) => <option key={fileira} value={fileira}>{fileira}</option>) : <option value="">Nenhuma fileira</option>}
      </select>
    </div>

    <p className="mb-3 text-sm text-slate-600">Escolha uma fileira para localizar os lugares. No mapa, use zoom, rolagem horizontal e teclado para navegar; o mapa rolável funciona melhor na horizontal.</p>

    <section aria-label="Lista de assentos" hidden={modoVisualizacao !== "lista"} aria-hidden={modoVisualizacao !== "lista"}>
      <h2 className="text-base font-semibold">Lista de assentos</h2>
      {assentosDaFileira.length ? <ul className="mt-3 space-y-2" aria-label={`Assentos da fileira ${fileiraAtiva}`}>{assentosDaFileira.map(renderAssentoNaLista)}</ul> : <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600" aria-live="polite">Nenhum assento disponível nesta fileira.</p>}
      {assentosDaFileira.length > 0 && !assentosDaFileira.some((seat) => seat.state === "available" && !indisponiveis.has(seat.id)) && <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600" aria-live="polite">Nenhum assento disponível nesta fileira.</p>}
    </section>

    <section aria-label="Mapa de assentos" hidden={modoVisualizacao !== "mapa"} aria-hidden={modoVisualizacao !== "mapa"}>
      <MapaAssentosSvg map={map} selection={selection} focusRow={fileiraAtiva} unavailableSeatIds={unavailableSeatIds} onToggleSeat={alternarAssento} />
    </section>

    {selectionLimitReached && <p role="status" aria-live="assertive" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Você pode selecionar no máximo 20 assentos por pedido.</p>}
    <ResumoAssentos selection={selection} ticketTypes={ticketTypes} offers={offers} onChangeTicketType={alterarTipoIngresso} />
    <ResumoAssentosFixo selection={selection} ticketTypes={ticketTypes} offers={offers} checkoutHref={target} onChangeTicketType={alterarTipoIngresso} />
    <a aria-disabled={!target} href={target} className={`mt-5 inline-block rounded px-4 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${target ? "bg-blue-700" : "pointer-events-none bg-slate-400"}`}>Continuar para checkout</a>
    <p className="sr-only" aria-live="polite">{selection.length ? `${selection.length} assento(s) selecionado(s)` : "Nenhum assento selecionado"}</p>
  </div>;
}
